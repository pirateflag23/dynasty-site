// League engagement posts for discord-feed.mjs: Game of the Week, Pick'em (slate + standings), Coach Power Rankings,
// and the coach-vs-coach series used on matchup previews. Everything here gets its data from the feed's context (x).
import { readFile, writeFile, mkdir } from "node:fs/promises";

const lg = () => import("./graphics/league.mjs");
const RED = 0xc8102e, GOLD = 0xf2b134;

// first 12:00 Eastern at least `hours` after the advance (same rule as dispatch/worker.js)
export function prTarget(since, hours = 30) {
  const t0 = since + hours * 3600e3;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t0)).map((q) => [q.type, q.value]));
  return t0 + ((12 - (Number(p.hour) + Number(p.minute) / 60) + 24) % 24) * 3600e3;
}

/* ---------------- coach-vs-coach series ---------------- */
let coachesFile = null;
async function coaches(lid) {
  if (coachesFile) return coachesFile;
  try { coachesFile = JSON.parse(await readFile(`data/history/${lid}/coaches.json`, "utf8")).coaches || []; } catch { coachesFile = []; }
  return coachesFile;
}
const lc = (s) => String(s || "").toLowerCase();
// series between the away and home coaches of game g, oriented away/home; null unless both teams are coached
export async function seriesFor(x, g) {
  const ua = g.away.user_name, uh = g.home.user_name;
  if (!ua || !uh || ua === "CPU" || uh === "CPU" || g.kind !== "user_vs_user") return null;
  const c = (await coaches(x.lid)).find((q) => lc(q.gamertag) === lc(ua));
  const key = c && Object.keys(c.h2h || {}).find((k) => lc(k) === lc(uh));
  const h = key ? c.h2h[key] : { w: 0, l: 0, t: 0, games: [] };
  const an = x.coachName(g.away.team_key) || ua, hn = x.coachName(g.home.team_key) || uh;
  const games = [...(h.games || [])].sort((a, b) => a.y - b.y || a.w - b.w);
  let streak = "";
  if (games.length) {
    const last = games[games.length - 1].res; let n = 0;
    for (let i = games.length - 1; i >= 0 && games[i].res === last; i--) n++;
    if (last !== "t" && n >= 2) streak = `${last === "w" ? an : hn} has won ${n} straight`;
  }
  const lm = games[games.length - 1];
  const sc = (m) => (m.ms >= m.os ? `${m.ms}-${m.os}` : `${m.os}-${m.ms}`);
  const winT = (m) => x.short(m.res === "w" ? m.me : m.res === "l" ? m.op : "Tie");
  return {
    away_w: h.w, home_w: h.l, ties: h.t, away_coach: an, home_coach: hn,
    lead: h.w > h.l ? `${an} leads ${h.w}-${h.l}${h.t ? `-${h.t}` : ""}` : h.l > h.w ? `${hn} leads ${h.l}-${h.w}${h.t ? `-${h.t}` : ""}` : `Series tied ${h.w}-${h.l}${h.t ? `-${h.t}` : ""}`,
    last: lm ? `Last meeting: ${lm.y} ${lm.wk}, ${winT(lm)} ${sc(lm)}` : "", streak,
    meetings: [...games].reverse().map((m) => ({ y: m.y, wk: m.wk.replace(/^Week /, "Wk "), win: winT(m), score: sc(m), aw: m.res === "w" })),
  };
}

/* ---------------- shared bits ---------------- */
async function cfpOdds(lid) {
  try { const s = JSON.parse(await readFile(`data/stories/${lid}/latest.json`, "utf8")); return s.cfp || null; } catch { return null; }
}
const side = (x, t, map) => { const k = t.team_key, tm = x.teams.get(k) || {}; return { name: t.team, key: k, rank: tm.rank, record: tm.record, conf: tm.conference, coach: x.coachName(k), logo: x.logoFor(t.team, map) }; };
const png = (name, data, title, color, url) => ({ embeds: [{ title, url, color, image: { url: `attachment://${name}` } }], files: [{ name, data }] });

/* ---------------- Game of the Week ---------------- */
export async function gameOfTheWeek(x, weekGames, label) {
  const ch = x.pickChannel(x.cfg.channels.gotw);
  if (!ch || !weekGames.length) return;
  await x.once(`gotw:${x.cur.season}:${label}`, "gotw", ch, async () => {
    const cfp = await cfpOdds(x.lid), make = new Map((cfp?.teams || []).map((t) => [t.team, t.make]));
    const rank = (k) => { const r = x.teams.get(k)?.rank; return r > 0 && r <= 25 ? r : 0; };
    const pct = (k) => { const t = x.teams.get(k) || {}; const n = (t.wins || 0) + (t.losses || 0); return n ? t.wins / n : 0.5; };
    const score = (g) => [g.home, g.away].reduce((a, t) => a + (rank(t.team_key) ? 26 - rank(t.team_key) : 0) + pct(t.team_key) * 20 + (make.get(t.team_key) || 0) / 5, 0)
      + (g.kind === "user_vs_user" ? 100 : 0) + (x.rivalryName(g) ? 15 : 0);
    const g = [...weekGames].sort((a, b) => score(b) - score(a))[0];
    const map = await x.logoMap();
    const A = { ...side(x, g.away, map), make: make.get(g.away.team_key) ?? null }, H = { ...side(x, g.home, map), make: make.get(g.home.team_key) ?? null };
    const series = await seriesFor(x, g);
    const stakes = [];
    if (A.rank && H.rank) stakes.push(`Top-25 showdown: No. ${A.rank} ${A.name} vs No. ${H.rank} ${H.name}.`);
    else if (A.rank || H.rank) { const [r, u] = A.rank ? [A, H] : [H, A]; stakes.push(`${u.name} gets a shot at No. ${r.rank} ${r.name}.`); }
    const sw = (cfp?.games || []).find((q) => q.game === g.key);
    if (sw) { if (sw.away_swing >= 10) stakes.push(`A win is worth about ${sw.away_swing} points of playoff odds to ${A.name}.`); if (sw.home_swing >= 10) stakes.push(`A win is worth about ${sw.home_swing} points of playoff odds to ${H.name}.`); }
    if (A.conf && A.conf === H.conf && !/independent/i.test(A.conf)) stakes.push(`${A.conf} game. It counts in the conference race.`);
    const strk = (k) => { const r = x.lastResults(k, 5); let n = 0; for (const z of r) { if (z !== r[0]) break; n++; } return n >= 3 ? `${x.tName(k)} has ${r[0] === "W" ? "won" : "lost"} ${n} straight.` : ""; };
    for (const k of [g.away.team_key, g.home.team_key]) { const s = strk(k); if (s) stakes.push(s); }
    const tag = x.rivalryName(g) || (g.kind === "user_vs_user" ? "Coach vs coach" : "");
    const text = { embeds: [{ title: `⭐ Game of the Week · ${x.rk(A.rank)}${A.name} at ${x.rk(H.rank)}${H.name}`, url: x.site(`game/${g.key}`), color: GOLD,
      description: [series?.lead, ...stakes].filter(Boolean).join("\n") }] };
    if (x.cfg.graphics?.gotw === false) return text;
    try {
      const { renderGOTW } = await lg();
      const img = await renderGOTW({ week: label, date: `${x.cur.season} season`, tag, away: A, home: H, series, stakes: stakes.slice(0, 4), siteLogo: x.siteLogo(), colors: await x.colors() });
      return png("gotw.png", img, text.embeds[0].title, GOLD, text.embeds[0].url);
    } catch (e) { x.log(`GOTW graphic failed: ${e.message}`); return text; }
  });
}

/* ---------------- Pick'em ---------------- */
export async function pickem(x, weekGames, label, weekNum) {
  const ch = x.pickChannel(x.cfg.channels.pickem);
  if (!ch) return;
  const st = (x.state.pickem ??= { rounds: {}, totals: {}, history: [] });
  const round = `${x.cur.season}-w${weekNum}`;
  const key = `pickem:${round}`;
  if (x.seen(key) && !x.replay("pickem")) return;
  if (x.seeding && !x.replay("pickem")) { x.mark(key); return; }

  // 1) grade every earlier round whose games are all played
  let recap = null;
  for (const [rid, r] of Object.entries(st.rounds)) {
    if (r.done || rid === round) continue;
    const gs = r.games.map((k) => x.games.find((g) => g.key === k)).filter(Boolean);
    if (gs.some((g) => !g.played)) continue;
    const picks = await fetchPicks(x, rid);
    if (!picks) continue; // bot unreachable: try again next sync
    const scores = {};
    for (const [uid, p] of Object.entries(picks)) {
      let c = 0, n = 0;
      for (const g of gs) {
        const pk = p.picks?.[g.key]; if (pk == null) continue;
        n++; const win = g.home.score > g.away.score ? g.home.team_key : g.away.score > g.home.score ? g.away.team_key : null;
        if (win != null && String(win) === String(pk)) c++;
      }
      if (!n) continue;
      const t = (st.totals[uid] ??= { name: p.name, w: 0, l: 0 }); t.name = p.name; t.w += c; t.l += n - c;
      scores[uid] = [c, n];
    }
    r.done = true;
    st.history.push({ round: rid, label: r.label, games: gs.length, scores });
    const best = Object.entries(scores).sort((a, b) => b[1][0] - a[1][0]);
    if (best.length) recap = { label: r.label, best: best.filter((s) => s[1][0] === best[0][1][0]).map(([u]) => st.totals[u].name), score: `${best[0][1][0]}/${gs.length}`, n: best.length };
  }
  st.history = st.history.slice(-40);
  const lastH = st.history[st.history.length - 1];
  const rows = Object.entries(st.totals).map(([uid, t]) => ({ uid, ...t })).sort((a, b) => b.w - a.w || a.l - b.l || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i && rows[i - 1].w === r.w && rows[i - 1].l === r.l ? rows[i - 1].rank : i + 1; const s = lastH?.scores?.[r.uid]; r.last = s ? `${s[0]}/${s[1]}` : ""; r.perfect = !!s && s[0] === lastH.games && s[1] === lastH.games; });
  await mkdir(`data/pickem`, { recursive: true });
  await writeFile(`data/pickem/${x.lid}.json`, JSON.stringify({ updated: new Date().toISOString(), season: x.cur.season, rows: rows.map(({ uid, ...r }) => r), history: st.history.slice(-12).map((h) => ({ round: h.round, label: h.label, games: h.games, best: Math.max(0, ...Object.values(h.scores).map((s) => s[0])) })) }));

  // 2) standings (once something's been graded)
  if (rows.length) {
    let post = { embeds: [{ title: "🏈 Pick'em standings", color: GOLD, description: rows.slice(0, 25).map((r) => `\`${String(r.rank).padStart(2)}\` **${r.name}** ${r.w}-${r.l}${r.last ? ` · last week ${r.last}` : ""}`).join("\n") }] };
    if (x.cfg.graphics?.pickem !== false) try { const { renderPickBoard } = await lg(); post = png("pickem-standings.png", await renderPickBoard({ label: `${x.cur.season} season`, rows: rows.slice(0, 32), recap, siteLogo: x.siteLogo() }), "🏈 Pick'em standings", GOLD); } catch (e) { x.log(`Pick'em standings graphic failed: ${e.message}`); }
    await x.send(ch, post);
  }

  // 3) this week's slate with buttons (5 games per message)
  const list = [...weekGames].sort((a, b) => (a.kind === "user_vs_user" ? 0 : 1) - (b.kind === "user_vs_user" ? 0 : 1));
  if (!list.length) { x.mark(key); return; }
  st.rounds[round] = { label, games: list.map((g) => g.key), done: false };
  const map = await x.logoMap();
  const G = list.map((g) => ({ key: g.key, away: side(x, g.away, map), home: side(x, g.home, map), uvu: g.kind === "user_vs_user" }));
  const btn = (g, i, t) => ({ type: 2, style: 2, label: `${i + 1} · ${x.short(t.name)}`.slice(0, 80), custom_id: `pk|${round}|${g.key}|${t.key}|${x.short(t.name)}`.slice(0, 100) });
  const rowsFor = (from) => G.slice(from, from + 5).map((g, j) => ({ type: 1, components: [btn(g, from + j, g.away), btn(g, from + j, g.home)] }));
  let head = { content: `**${label} Pick'em** · pick the winner of every league game. Picks lock when each game is played.` };
  if (x.cfg.graphics?.pickem !== false) try { const { renderPickSlate } = await lg(); head = { ...png("pickem.png", await renderPickSlate({ week: label, sub: `${G.length} games · ${x.cur.season} season`, games: G, siteLogo: x.siteLogo(), colors: await x.colors() }), `🏈 Pick'em · ${label}`, GOLD) }; } catch (e) { x.log(`Pick'em slate graphic failed: ${e.message}`); }
  if (!(await x.send(ch, { ...head, components: rowsFor(0) }))) return;
  for (let i = 5; i < G.length; i += 5) await x.send(ch, { content: `Games ${i + 1}–${Math.min(G.length, i + 5)}`, components: rowsFor(i) });
  x.mark(key); x.log(`posted ${key}`);
}
async function fetchPicks(x, round) {
  if (x.DRY) return {};
  const base = (x.cfg.bot_url || "").replace(/\/$/, ""); if (!base) return null;
  try { const r = await fetch(`${base}/pickem?round=${encodeURIComponent(round)}`); return r.ok ? (await r.json()).picks || {} : null; } catch { return null; }
}

/* ---------------- Coach Power Rankings ---------------- */
export async function powerRankings(x) {
  const ch = x.pickChannel(x.cfg.channels.power_rankings);
  if (!ch) return;
  const hours = x.cfg.power_rankings?.after_hours ?? 30;
  const advancedAt = Date.parse(x.cur.first_seen_at || "") || 0;
  if (!x.replay("power") && (!advancedAt || Date.now() < prTarget(advancedAt, hours))) return;
  await x.once(`power:${x.cur.id}`, "power", ch, async () => {
    const cfp = await cfpOdds(x.lid), make = new Map((cfp?.teams || []).map((t) => [t.team, t.make]));
    const users = [...x.userTeams].filter((k) => x.teams.has(k));
    if (!users.length) return null;
    const rows = users.map((k) => {
      const t = x.teams.get(k), gp = (t.wins || 0) + (t.losses || 0), r = t.rank > 0 && t.rank <= 25 ? t.rank : 0;
      const res = x.lastResults(k, 5), mk = make.get(k) ?? 0;
      let streak = 0; for (const z of res) { if (z !== res[0]) break; streak++; }
      const s = (gp ? t.wins / gp : 0.5) * 40 + (r ? (26 - r) * 1.2 : 0) + mk * 0.25 + (gp ? ((t.points_for - t.points_against) / gp) * 0.5 : 0) + (t.overall || 70) * 0.3 + (res[0] === "W" ? 2 : res[0] === "L" ? -2 : 0);
      const tag = mk >= 95 ? "Playoff lock" : res[0] && streak >= 3 ? (res[0] === "W" ? `Won ${streak} straight` : `Lost ${streak} straight`) : mk >= 25 && mk <= 75 ? "On the bubble" : "";
      return { k, s, name: t.name, record: t.record, rank: r, coach: x.coachName(k), last: x.lastResult(k) || "", next: x.nextOpp(k), make: mk, tag };
    }).sort((a, b) => b.s - a.s);
    const prev = x.state.power?.ranks || {};
    rows.forEach((r, i) => { r.pos = i + 1; r.move = prev[r.k] != null ? prev[r.k] - r.pos : null; });
    const blurbs = await writeBlurbs(x, rows);
    rows.forEach((r) => { r.blurb = blurbs[r.k] || [r.last && `Last: ${r.last}.`, r.next && `Next: ${r.next}.`].filter(Boolean).join(" "); });
    x.state.power = { period: x.cur.id, ranks: Object.fromEntries(rows.map((r) => [r.k, r.pos])) };
    await mkdir("data", { recursive: true });
    await writeFile(`data/power-rankings-${x.lid}.json`, JSON.stringify({ updated: new Date().toISOString(), label: x.nowWeek(), rows: rows.map(({ s, ...r }) => r) }));
    const title = `📊 Coach Power Rankings · ${x.nowWeek()}`;
    const text = { embeds: [{ title, color: RED, description: rows.map((r) => `\`${String(r.pos).padStart(2)}\` **${r.name}** (${r.coach}) ${r.record} · ${r.blurb}`).join("\n").slice(0, 3900) }] };
    if (x.cfg.graphics?.power_rankings === false) return text;
    try {
      const { renderPowerRankings } = await lg(); const map = await x.logoMap();
      const img = await renderPowerRankings({ label: x.nowWeek(), sub: `${x.cur.season} season`, siteLogo: x.siteLogo(), colors: await x.colors(),
        rows: rows.map((r) => ({ rank: r.pos, move: r.move, name: r.name, logo: x.logoFor(r.name, map), coach: r.coach, record: r.record, tag: r.tag, blurb: r.blurb })) });
      return png("power-rankings.png", img, title, RED);
    } catch (e) { x.log(`Power rankings graphic failed: ${e.message}`); return text; }
  });
}

// One line per coach from the AI desk; falls back to plain facts if the key is missing or the call fails.
async function writeBlurbs(x, rows) {
  const key = process.env.ANTHROPIC_API_KEY; if (!key || x.DRY && !process.env.PR_AI) return {};
  const facts = rows.map((r) => ({ id: r.k, rank: r.pos, team: r.name, coach: r.coach, record: r.record, ap_rank: r.rank || null, last_game: r.last, next_game: r.next, playoff_odds: r.make, movement: r.move, tag: r.tag }));
  const sys = "You write The Dynasty's weekly Coach Power Rankings: one punchy line per coach, beat-writer voice, 14-26 words. Be opinionated and a little sarcastic where it fits (rib a coach who lost or slid), warm where they earned it. Use only the facts given; never invent scores, stats or names. Refer to coaches by the name given. Reply with JSON only: {\"lines\": {\"<id>\": \"...\"}}.";
  try {
    const r = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, { method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.WRITER_MODEL || "claude-sonnet-5-5", max_tokens: 2500, system: sys, messages: [{ role: "user", content: JSON.stringify(facts) }] }) });
    if (!r.ok) throw new Error(`${r.status}`);
    const t = (await r.json()).content?.map((c) => c.text || "").join("") || "";
    return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)).lines || {};
  } catch (e) { x.log(`Power rankings blurbs fell back to plain facts: ${e.message}`); return {}; }
}
