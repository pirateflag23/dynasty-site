// Builds data/player-stats-all.json: season player stats for EVERY FBS player,
// in the same shape as the API's /v1/player-stats (which only covers user teams).
//
// How: user-team players come straight from /player-stats (authoritative).
// CPU-team players are summed from every played game's box score (/games/{key}),
// then named/positioned from /rosters?scope=all (League Pro).
//
// Env: DYNASTY_API_KEY (required), DYNASTY_API_BASE (optional), OUT (optional)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const BASE = (process.env.DYNASTY_API_BASE || "https://dynasty.prestonchoate.dev/v1").replace(/\/$/, "");
const KEY = process.env.DYNASTY_API_KEY;
const OUT = process.env.OUT || "data/player-stats-all.json";
const CONCURRENCY = 4;

if (!KEY) { console.error("DYNASTY_API_KEY is not set"); process.exit(1); }

async function api(path, tries = 5) {
  for (let i = 1; ; i++) {
    const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${KEY}` } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) {
      const wait = Number(r.headers.get("retry-after")) || 5 * i;
      console.warn(`${path} → ${r.status}, retrying in ${wait}s`);
      await new Promise((res) => setTimeout(res, wait * 1000));
      continue;
    }
    throw new Error(`${path} → ${r.status} ${await r.text()}`);
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const j = i++; out[j] = await fn(items[j]); }
  }));
  return out;
}

const div = (a, b) => (b ? a / b : 0);
const MAX_KEYS = ["passLongest", "rushLong", "receiveLongReception", "kickReturnLong",
  "puntReturnLong", "puntsLong", "kickFieldGoalLong", "defenseIntReturnLong"];

// Rate stats, recomputed from totals. Each formula was checked against the API's
// own /player-stats values for every user-team player.
function finish(s) {
  s.passCompPerc = Math.floor(div(100 * s.passCompletion, s.passAttempts));
  s.passerRating = s.passAttempts
    ? Math.floor((8.4 * s.passYards + 330 * s.passTD + 100 * s.passCompletion - 200 * s.passINT) / s.passAttempts * 10) / 10 : 0;
  s.passYardsPerAttempt = div(s.passYards, s.passAttempts);
  s.passYardsPerGame = div(s.passYards, s.gamesPlayed);
  s.passTDRate = div(100 * s.passTD, s.passAttempts);
  s.passINTRate = div(100 * s.passINT, s.passAttempts);
  s.passSackRate = div(100 * s.passSacks, s.passAttempts + s.passSacks);
  s.passTDToINT = s.passINT ? s.passTD / s.passINT : s.passTD;
  s.rushAvg = div(s.rushYards, s.rushAttempts);
  s.rushYardsPerGame = div(s.rushYards, s.gamesPlayed);
  s.rushYardsBeforeContact = s.rushYards - s.rushYardsAfterFirstHit;
  s.rushYardsBeforeContactAvg = div(s.rushYardsBeforeContact, s.rushAttempts);
  s.rushYardsAfterContactAvg = div(s.rushYardsAfterFirstHit, s.rushAttempts);
  s.receiveAvgYdsPerReception = div(s.receivingYards, s.receiveReceptions);
  s.receiveYardsAfterCatchAverage = div(s.receiveYardsAfterCatch, s.receiveReceptions);
  s.receiveYardsPerGame = div(s.receivingYards, s.gamesPlayed);
  s.kickFieldGoalPercentage = Math.floor(div(100 * s.kickFieldGoalsMade, s.kickFieldGoalAttempts));
  s.kickXPPercentage = Math.floor(div(100 * s.kickXPMade, s.kickXPAttempts));
  s.kickTouchbackRate = div(100 * s.kickTouchbacks, s.kickoffs);
  s.kickReturnAverage = div(s.kickReturnYards, s.kickReturnAttempts);
  s.puntReturnAverage = div(s.puntReturnYards, s.puntReturnAttempts);
  s.puntsAverage = div(s.puntYards, s.punts);
  s.puntsNetAverage = div(s.puntsNetYards, s.punts);
  s.defenseIntReturnAverage = div(s.defenseIntReceptionYards, s.defenseInterceptions);
  // Not derivable from box scores (needs sack yards / targets); left out for CPU players:
  // passNetYardsPerAttempt, passAdjNetYardsPerAttempt, receiveCatchPercentage.
  delete s.receiveCatchPercentage;
  return s;
}

const slim = (stats) => Object.fromEntries(Object.entries(stats).filter(([, v]) => v));

async function main() {
  const [userStats, schedule] = await Promise.all([api("/player-stats"), api("/schedule?played=true")]);
  const gameKeys = schedule.data.filter((g) => g.has_box_score).map((g) => g.key);

  // Skip the expensive part if nothing changed since the last build.
  try {
    const prev = JSON.parse(await readFile(OUT, "utf8"));
    if (prev.source?.period_id === userStats.period?.id && prev.source?.games === gameKeys.length
        && prev.source?.data_version === userStats.data_version && !process.env.FORCE) {
      console.log("No new games since last build; nothing to do."); return;
    }
  } catch { /* first run */ }

  console.log(`Fetching ${gameKeys.length} box scores…`);
  const games = await pool(gameKeys, CONCURRENCY, async (k) => (await api(`/games/${k}`)).data);

  const userKeys = new Set(userStats.data.map((p) => p.player_key));
  const agg = new Map();
  for (const g of games) {
    for (const p of g.box_score?.Players || []) {
      if (userKeys.has(p.Key)) continue;
      let a = agg.get(p.Key);
      if (!a) agg.set(p.Key, (a = { key: p.Key, name: p.Name, team: p.Team, stats: { gamesPlayed: 0 } }));
      a.team = p.Team; // latest game wins (handles mid-season moves)
      const s = a.stats;
      if (p.Stats.genDownsPlayed > 0) s.gamesPlayed++;
      for (const [k, v] of Object.entries(p.Stats)) {
        if (typeof v !== "number") continue;
        if (MAX_KEYS.includes(k)) s[k] = Math.max(s[k] ?? 0, v);
        else s[k] = (s[k] || 0) + v;
      }
    }
  }

  console.log("Fetching all rosters for names/positions…");
  const rosters = await api("/rosters?scope=all");
  const info = new Map(rosters.data.map((r) => [r.player_key, r]));

  const cpu = [...agg.values()].filter((a) => a.stats.gamesPlayed > 0).map((a) => {
    const r = info.get(a.key) || {};
    return {
      player_key: a.key, team_key: a.team, name: r.name || a.name,
      first_name: r.first_name, last_name: r.last_name, position: r.position,
      jersey: r.jersey, overall: r.overall, user_team: false, stats: finish(a.stats),
    };
  });
  const users = userStats.data.map((p) => ({ ...p, user_team: true }));
  const all = [...users, ...cpu];

  const statKeys = [...new Set(all.flatMap((p) => Object.keys(p.stats)))].sort();
  const out = {
    league_id: userStats.league_id,
    period: userStats.period,
    generated_at: new Date().toISOString(),
    source: { period_id: userStats.period?.id, data_version: userStats.data_version, games: gameKeys.length },
    // Zero-valued stats are dropped to keep the file small. Fill them back in with
    // stat_keys on load (see loadAllPlayerStats in the site snippet).
    stat_keys: statKeys,
    data: all.map((p) => ({ ...p, stats: slim(p.stats) })),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out));
  console.log(`Wrote ${OUT}: ${users.length} user-team + ${cpu.length} CPU players from ${games.length} games.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
