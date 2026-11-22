// thedynastycfb.com — serves the static site (./public) and a small API for the
// Breakaway arcade game's league-wide leaderboard.
//
//   GET  /api/breakaway/scores  -> { top: [{ name, yards, tds, t }], runs }
//   POST /api/breakaway/scores  { name, yards, tds, ms } -> { ok, rank, best, prevBest, newBest, top, runs }
//
// Scores live in one SQLite-backed Durable Object (no KV/D1 setup needed).
// The board keeps each name's best run (names are matched case-insensitively).

import { DurableObject } from "cloudflare:workers";

const API_PATH = "/api/breakaway/scores";
const TOP_N = 25;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export class Leaderboard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS best (name_key TEXT PRIMARY KEY, name TEXT NOT NULL, yards INTEGER NOT NULL, tds INTEGER NOT NULL, t INTEGER NOT NULL)"
    );
    this.sql.exec("CREATE TABLE IF NOT EXISTS stats (k TEXT PRIMARY KEY, v INTEGER NOT NULL)");
    this.lastByIp = new Map();
  }

  top() {
    return this.sql
      .exec("SELECT name, yards, tds, t FROM best ORDER BY yards DESC, t ASC LIMIT ?", TOP_N)
      .toArray();
  }

  runs() {
    const r = this.sql.exec("SELECT v FROM stats WHERE k = 'runs'").toArray();
    return r.length ? r[0].v : 0;
  }

  async fetch(request) {
    if (request.method === "GET") return json({ top: this.top(), runs: this.runs() });
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

    // light flood protection: one submission per IP every 3 seconds
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const now = Date.now();
    if ((this.lastByIp.get(ip) || 0) > now - 3000) return json({ error: "slow down" }, 429);
    this.lastByIp.set(ip, now);
    if (this.lastByIp.size > 5000) this.lastByIp.clear();

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }

    const name = String(body.name || "")
      .replace(/[\u0000-\u001f\u007f<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 14);
    const yards = Math.floor(Number(body.yards));
    const tds = Math.floor(Number(body.tds));
    const ms = Number(body.ms);

    if (!name) return json({ error: "name required" }, 400);
    if (!Number.isFinite(yards) || yards < 0 || yards > 100000) return json({ error: "bad yards" }, 400);
    if (!Number.isFinite(ms) || ms <= 0) return json({ error: "bad time" }, 400);
    // top speed in the game is 40 yds/sec, so a run can't gain more than that per second played
    if (yards > (ms / 1000) * 41 + 5) return json({ error: "run rejected" }, 400);
    const maxTds = yards + 20 >= 100 ? Math.floor((yards + 20 - 100) / 110) + 1 : 0;
    if (!Number.isFinite(tds) || tds < 0 || tds > maxTds) return json({ error: "bad touchdowns" }, 400);

    const key = name.toLowerCase();
    const prev = this.sql.exec("SELECT yards FROM best WHERE name_key = ?", key).toArray();
    const prevBest = prev.length ? prev[0].yards : 0;

    this.sql.exec(
      `INSERT INTO best (name_key, name, yards, tds, t) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name_key) DO UPDATE SET name = excluded.name, yards = excluded.yards, tds = excluded.tds, t = excluded.t
       WHERE excluded.yards > best.yards`,
      key, name, yards, tds, now
    );
    this.sql.exec(
      "INSERT INTO stats (k, v) VALUES ('runs', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1"
    );

    const best = Math.max(prevBest, yards);
    const rank = this.sql.exec("SELECT COUNT(*) AS c FROM best WHERE yards > ?", best).one().c + 1;
    return json({ ok: true, rank, best, prevBest, newBest: yards > prevBest, top: this.top(), runs: this.runs() });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === API_PATH) {
      const stub = env.LEADERBOARD.get(env.LEADERBOARD.idFromName("breakaway"));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
