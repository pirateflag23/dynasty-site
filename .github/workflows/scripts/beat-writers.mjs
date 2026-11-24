// Beat writers: every league coach gets his own local beat writer, one per coach + school.
// A coach who takes a new job gets a different writer (new personality) at the new school.
//
// Each sync this writes 200-250 word articles for league teams when something happens:
//   game   every finished game a league team plays (recap, take, why they won or lost)
//   hire   a league coach takes over a school (the new writer's first column on him)
//   exit   a league coach leaves a school or the league (the old writer's send-off)
//   opener a season preview for every league team before its first game of the season
//          (every season, including the very first sync of a brand-new league)
//   recruit commits, flips and signings for a league team (one column per team per advance:
//          big gets, class rankings, or a skeptical take: scheme fit, invented character concerns)
//
// Files (data/stories/<league>/):
//   beat-writers.json   who covers whom, each writer's running notes, which events are done
//   beat-<season>.json  every beat article of the season (the site's article pages and team pages read this)
// Staff list: beat-writers.json at the repo root (names, outlets, personalities; all fictional).
//
// Facts (scores, stats, records, rankings, who coaches where) come from the Dynasty API and stay true.
// Opinions, bias, delusion, sources, rumors and the coach's quotes are the writer's own.
// Needs DYNASTY_API_KEY and ANTHROPIC_API_KEY; without the Claude key nothing is written.
// Testing: BEAT_FIXTURES=<dir> reads API responses from <dir>/<path>.json; BEAT_FAKE_AI=1 skips Claude.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { currentGames } from "./current-games.mjs";

const API = (process.env.DYNASTY_API_BASE || "https://dynasty.prestonchoate.dev/v1").replace(/\/$/, "");
const DKEY = process.env.DYNASTY_API_KEY, AKEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.BEAT_MODEL || process.env.WRITER_MODEL || "claude-sonnet-5-5";
const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
const FIX = process.env.BEAT_FIXTURES, FAKE = process.env.BEAT_FAKE_AI === "1";
const MAX_PER_SYNC = +(process.env.BEAT_MAX || 40);
const log = (...a) => console.log("[beat]", ...a);
const readJson = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const lastName = (n) => String(n || "").replace(/^[A-Z]\.\s*/, "").split(" ").slice(-1)[0];
const lc = (s) => String(s || "").toLowerCase();

async function api(path, tries = 4) {
  if (FIX) { const f = `${FIX}/${path.replace(/^\//, "").replace(/[/?=&]/g, "_")}.json`; const j = await readJson(f); if (!j) throw new Error(`fixture missing: ${f}`); return j; }
  for (let i = 1; ; i++) {
    let r;
    try { r = await fetch(API + path, { headers: { Authorization: `Bearer ${DKEY}` } }); }
    catch (e) { if (i >= tries) throw e; await new Promise((s) => setTimeout(s, 4000 * i)); continue; }
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) { await new Promise((s) => setTimeout(s, 4000 * i)); continue; }
    throw new Error(`API ${path} → ${r.status}`);
  }
}
async function claude(system, user) {
  for (let i = 1; ; i++) {
    const r = await fetch(`${BASE}/v1/messages`, { method: "POST",
      headers: { "x-api-key": AKEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, messages: [{ role: "user", content: user }] }) });
    if (r.ok) { const j = await r.json(); return j.content.filter((c) => c.type === "text").map((c) => c.text).join(""); }
    if ((r.status === 429 || r.status >= 500) && i < 4) { await new Promise((s) => setTimeout(s, 5000 * i)); continue; }
    throw new Error(`Claude API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}
const parseJson = (t) => { const m = String(t).match(/\{[\s\S]*\}/); if (!m) throw new Error("no JSON in reply"); return JSON.parse(m[0]); };
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j]); } })); return out; }

const SYSTEM = `You write for "The Dynasty", a 32-coach online College Football 27 dynasty league run on Discord. Each league coach is a real league member running one school; every other team is CPU-controlled. You are one specific local beat writer covering one league coach's program. You'll get your persona, the facts, and your own notes from earlier columns.

Write ONE article of 200-250 words, fully in your persona's voice. You are a beat writer, not a box score: bias, favoritism, delusion, grudges, hot takes, being way too hard (or way too easy) on the coach are all fair game, exactly like real beat writers. The league's radio show will quote these columns, so make them human, opinionated and memorable: a clear take, a moment, a line people will repeat.

Rules:
- FACTS STAY TRUE. Scores, stats, records, rankings, opponents, who coaches where come only from the fact sheet. Never change them and never invent new numbers. Your OPINION about the facts can be as biased or delusional as your persona (a homer can call a 30-point loss "closer than it looked"), but the numbers themselves are never wrong.
- Season preview columns: an outlook for the year from your persona, ending with a predicted record. Name the games you've circled and the players who matter.
- Recruiting columns: the fact sheet gives a suggested_angle. Take it unless your persona would obviously see it differently. Stirring the pot is the point: a skeptical column about a "great get" is as welcome as a celebration. Recruits are fictional, game-generated prospects; criticism of them stays about football and mild school-age stuff.
- Explain why it happened from the stats when it's a game (turnovers, third downs, the run game, a quarter that got away), filtered through your persona.
- Invented color is fine: unnamed sources, booster grumbling, a sideline moment, the mood in the stadium, what the coach said in the postgame presser, what a recruit's camp is saying. Quotes may come ONLY from the league coach (use the name given), recruits and their families or high school coaches, unnamed sources, fans, or the writer himself. Never invent quotes from current college players or from CPU coaches.
- League coaches are fair game for football drama (hot seat, play-calling, recruiting, feuds, ribbing). Nothing about anyone's real life (health, family, money, crimes, sex), no slurs, no profanity beyond "hell" or "damn".
- Stay consistent with your earlier notes when they fit (your running takes, grudges, predictions). If a past prediction went wrong, your persona decides whether to admit it.
- Use first person sparingly. No headers, no bullet points, no emojis. 3 to 5 paragraphs.

Reply with ONLY a JSON object:
{"kick":"<2-3 word kicker>","h":"<headline in your voice, max 14 words>","dek":"<one sentence, max 30 words>","body":["<paragraph>","..."],"note":"<one line to yourself for next time: your running take on this coach/program, max 25 words>"}`;

function outletFor(w, t) { return String(w.outlet || "The {Team} Courier").replace(/\{Team\}/g, t.name).replace(/\{Nick\}/g, t.nickname || t.name); }

async function main() {
  if (!FIX && !DKEY) throw new Error("DYNASTY_API_KEY must be set");
  if (!AKEY && !FAKE) { log("No ANTHROPIC_API_KEY: skipping beat writers"); return; }
  const staff = (await readJson("beat-writers.json", { writers: [] })).writers;
  if (staff.length < 2) throw new Error("beat-writers.json needs writers");
  const cfg = await readJson("discord.config.json", {});
  const discordNames = await readJson("data/coach-names.json", {});
  const discordName = (gt) => Object.entries(discordNames).find(([k]) => lc(k) === lc(gt))?.[1]?.replace(/\s*\p{Extended_Pictographic}/gu, "").trim() || null;

  const league = (await api("/league")).data, LID = league.league_id, cur = league.current_period;
  const DIR = `data/stories/${LID}`; await mkdir(DIR, { recursive: true });
  const hist = await readJson(`data/history/${LID}/index.json`, {});
  const coachHist = (await readJson(`data/history/${LID}/coaches.json`, { coaches: [] })).coaches;
  const inGameName = (gt) => cfg.coach_names?.[gt] || hist.learned_names?.[gt] || coachHist.find((c) => lc(c.gamertag) === lc(gt))?.name || null;
  const coachLabel = (gt) => { const n = inGameName(gt), d = discordName(gt); return n ? `${n}${d ? ` (${d})` : ""}` : d || gt; };
  const coachShort = (gt) => { const n = inGameName(gt); return n ? `Coach ${lastName(n)}` : discordName(gt) || gt; };

  const [schedule, standings, members] = await Promise.all([api("/schedule"), api("/standings"), api("/members")]);
  const team = new Map(standings.data.map((t) => [t.team_key, t]));
  const tInfo = (tk) => team.get(tk) || { name: "?", team_key: tk };
  const rk = (r) => (r > 0 && r <= 25 ? r : null);
  const nowMem = members.data.filter((m) => m.user_name && m.user_name !== "CPU" && m.team_key);
  const rivalries = (await readJson("rivalries.json", { rivalries: [] })).rivalries;
  const nk = (s) => lc(s).replace(/[^a-z0-9]/g, "");
  const rivalOf = new Map(); for (const [a, b, n] of rivalries) { rivalOf.set(nk(a) + "|" + nk(b), n); rivalOf.set(nk(b) + "|" + nk(a), n); }

  // ---- assignments: one writer per coach + school ----
  const stFile = `${DIR}/beat-writers.json`;
  const state = await readJson(stFile, null) || { assignments: {}, done: [] };
  const done = new Set(state.done || []);
  const akey = (gt, tk) => `${lc(gt)}@${tk}`;
  function assign(gt, tk) {
    const k = akey(gt, tk);
    if (state.assignments[k]) return state.assignments[k];
    const busy = new Set(Object.values(state.assignments).filter((a) => !a.ended).map((a) => a.writer));
    const coveredTeam = new Set(Object.values(state.assignments).filter((a) => String(a.team) === String(tk)).map((a) => a.writer));
    const coveredCoach = new Set(Object.values(state.assignments).filter((a) => lc(a.gt) === lc(gt)).map((a) => a.writer));
    const ranked = [...staff].sort((a, b) => hash(k + a.id) - hash(k + b.id));
    const w = ranked.find((x) => !busy.has(x.id) && !coveredTeam.has(x.id) && !coveredCoach.has(x.id)) || ranked.find((x) => !busy.has(x.id)) || ranked[0];
    const t = tInfo(tk);
    return (state.assignments[k] = { gt, team: tk, team_name: t.name, writer: w.id, outlet: outletFor(w, t), since: cur.season_text, notes: [] });
  }
  for (const m of nowMem) assign(m.user_name, m.team_key);
  const writerOf = (a) => staff.find((w) => w.id === a.writer) || staff[0];

  // ---- events ----
  const events = [];
  const games = currentGames(schedule.data || [], cur.season).filter((g) => g.played);
  const latestWeek = games.length ? Math.max(...games.map((g) => g.week)) : null;
  const userKeys = new Set(nowMem.map((m) => m.team_key));
  const gtOf = new Map(nowMem.map((m) => [m.team_key, m.user_name]));
  // never backfill: the first time we see a season, start from its latest played week
  if (latestWeek != null && state.start?.season !== cur.season) state.start = { season: cur.season, week: latestWeek };
  for (const g of games) {
    if (state.start?.season === cur.season && g.week < state.start.week) continue;
    for (const side of [g.home, g.away]) {
      if (!userKeys.has(side.team_key)) continue;
      const id = `beat:g:${g.key}:${side.team_key}`;
      if (!done.has(id)) events.push({ id, kind: "game", g, tk: side.team_key, gt: gtOf.get(side.team_key) });
    }
  }
  // coaching moves logged by build-stories.mjs (carousel.json): this period and the one before
  const car = await readJson(`${DIR}/carousel.json`, { moves: [] });
  const recent = (car.moves || []).filter((m) => m.period >= cur.id - 1 && Date.now() - Date.parse(m.at) < 10 * 86400e3);
  for (const m of recent) {
    if (m.kind === "move" || m.kind === "leave") {
      const id = `beat:exit:${lc(m.gt)}:${m.from}:${m.period}`;
      const a = state.assignments[akey(m.gt, m.from)] || assign(m.gt, m.from);
      a.ended = a.ended || cur.season_text;
      if (!done.has(id)) events.push({ id, kind: "exit", tk: m.from, gt: m.gt, move: m });
    }
    if (m.kind === "move" || m.kind === "join") {
      const id = `beat:hire:${lc(m.gt)}:${m.to}:${m.period}`;
      if (!done.has(id)) events.push({ id, kind: "hire", tk: m.to, gt: m.gt, move: m });
    }
  }
  // season openers: once per season per coach + school, while the team hasn't played yet this season
  const seasonGames = currentGames(schedule.data || [], cur.season).filter((g) => !g.season || g.season === cur.season);
  for (const m of nowMem) {
    const mine = seasonGames.filter((g) => g.home.team_key === m.team_key || g.away.team_key === m.team_key);
    if (!mine.length || mine.some((g) => g.played)) continue;
    const id = `beat:open:${cur.season}:${lc(m.user_name)}:${m.team_key}`;
    if (!done.has(id)) events.push({ id, kind: "opener", tk: m.team_key, gt: m.user_name, sched: mine.sort((a, b) => a.week - b.week) });
  }
  // recruiting: commits, flips and signings this period, one column per league team (the biggest move leads)
  const [commitsR, commitsT, committed, classes] = await Promise.all([
    api("/recruits/commits?type=recruits").catch(() => ({ data: [] })), api("/recruits/commits?type=transfers").catch(() => ({ data: [] })),
    api("/recruits?type=overall&committed=true").catch(() => ({ data: [] })), api("/recruits/classes").catch(() => ({ data: [] }))]);
  const keyOf = (sch) => (sch ? standings.data.find((t) => t.name === sch.name)?.team_key ?? null : null);
  const recInfo = new Map((committed.data || []).map((r) => [r.prospect_key, r]));
  const recEv = new Map(); // team -> { gets: [], losses: [] }
  for (const e of [...(commitsR.data || []), ...(commitsT.data || [])].filter((x) => x.period_id === cur.id)) {
    const toK = e.kind === "decommit" ? null : keyOf(e.school), fromK = keyOf(e.previous_school || (e.kind === "decommit" ? e.school : null));
    if (toK && userKeys.has(toK)) { const b = recEv.get(toK) || { gets: [], losses: [] }; b.gets.push(e); recEv.set(toK, b); }
    if (fromK && userKeys.has(fromK) && fromK !== toK) { const b = recEv.get(fromK) || { gets: [], losses: [] }; b.losses.push(e); recEv.set(fromK, b); }
  }
  for (const [tk, b] of recEv) {
    const id = `beat:rec:${tk}:${cur.id}`;
    if (!done.has(id)) events.push({ id, kind: "recruit", tk, gt: gtOf.get(tk), rec: b });
  }
  // a coach who left without a logged move (assignment still open, coach no longer there)
  for (const a of Object.values(state.assignments)) if (!a.ended && !nowMem.some((m) => akey(m.user_name, m.team_key) === akey(a.gt, a.team))) a.ended = cur.season_text;

  const todo = events.slice(0, MAX_PER_SYNC);
  log(`${events.length} beat events${events.length > todo.length ? ` (writing ${todo.length} now, rest next sync)` : ""}`);
  // who covers each league team right now (site + Temperature read this)
  const saveState = async () => {
    state.current = Object.fromEntries(nowMem.map((m) => { const a = state.assignments[akey(m.user_name, m.team_key)], w = writerOf(a); return [m.team_key, { writer: w.id, by: w.name, outlet: a.outlet, since: a.since, coach: coachShort(m.user_name) }]; }));
    state.seasons = [...new Set([...(state.seasons || []), cur.season])].sort((x, y) => y - x);
    state.done = [...done].slice(-3000); state.updated = new Date().toISOString();
    await writeFile(stFile, JSON.stringify(state, null, 1));
  };
  if (!todo.length) { await saveState(); return; }

  // box scores for the games we need
  const boxes = new Map();
  await pool([...new Set(todo.filter((e) => e.g).map((e) => e.g.key))], 4, async (k) => { try { boxes.set(k, (await api(`/games/${k}`)).data?.box_score || null); } catch { boxes.set(k, null); } });
  const latest = await readJson(`${DIR}/latest.json`, {});
  const untok = (s) => String(s || "").replace(/\[\[\w:[^|\]]*\|([^\]]*)\]\]/g, "$1");
  const wireFor = (gk, tk) => (latest.games || []).filter((s) => (gk && s.game === gk) || (!gk && s.team === tk)).slice(0, 4).map((s) => `${untok(s.h)}: ${untok(s.d)}`);
  const careerAt = (gt, tk) => { const c = coachHist.find((x) => lc(x.gamertag) === lc(gt)); if (!c) return null;
    const ss = Object.entries(c.seasons || {}).filter(([, s]) => String(s.team_key) === String(tk));
    if (!ss.length) return null; const w = ss.reduce((a, [, s]) => a + (s.w || 0), 0), l = ss.reduce((a, [, s]) => a + (s.l || 0), 0);
    return { seasons: ss.length, record: `${w}-${l}`, notes: ss.flatMap(([y, s]) => (s.notes || []).map((n) => `${y}: ${n}`)).slice(-6) }; };
  const careerAll = (gt) => { const c = coachHist.find((x) => lc(x.gamertag) === lc(gt)); return c ? { record: `${c.w}-${c.l}`, national_titles: c.natty_wins || 0, cfp_trips: c.cfp_apps || 0 } : null; };
  const streakOf = (tk) => { let n = 0, kind = null; for (const g of [...games].sort((a, b) => b.week - a.week)) { if (g.home.team_key !== tk && g.away.team_key !== tk) continue; const me = g.home.team_key === tk ? g.home : g.away, o = me === g.home ? g.away : g.home; const r = me.score > o.score ? "W" : "L"; if (!kind) kind = r; if (r !== kind) break; n++; } return kind ? `${kind}${n}` : null; };
  const weekWord = (w) => (w >= 16 ? "postseason" : `Week ${w}`);

  function teamStats(S = {}) {
    const pick = ["totalYardsGained", "passYards", "rushYards", "offFirstdown", "turnovers", "thirdDowns", "thirdDownConversions", "fourthDowns", "fourthDownConversions", "penalties", "penaltyYards", "possessionSeconds", "sacks"];
    return Object.fromEntries(pick.filter((k) => S[k] != null).map((k) => [k, S[k]]));
  }
  function playersFor(b, tk, n = 4) {
    const ps = (b?.Players || []).filter((p) => p.Team === tk).map((p) => { const s = p.Stats || {}; const parts = [];
      if (s.passAttempts) parts.push(`${s.passCompletion}/${s.passAttempts} ${s.passYards} pass yds ${s.passTD} TD ${s.passINT} INT`);
      if (s.rushAttempts) parts.push(`${s.rushAttempts} rushes ${s.rushYards} yds ${s.rushTD} TD`);
      if (s.receiveReceptions) parts.push(`${s.receiveReceptions} catches ${s.receivingYards} yds ${s.receiveTouchdowns} TD`);
      if (s.defenseTotalTackles || s.defenseSacks || s.defenseInterceptions) parts.push(`${s.defenseTotalTackles || 0} tackles ${s.defenseSacks || 0} sacks ${s.defenseInterceptions || 0} INT`);
      const impact = (s.passYards || 0) / 2 + (s.rushYards || 0) + (s.receivingYards || 0) + (s.passTD || 0) * 30 + (s.rushTD || 0) * 30 + (s.receiveTouchdowns || 0) * 30 + (s.defenseSacks || 0) * 30 + (s.defenseInterceptions || 0) * 40 - (s.passINT || 0) * 25 + (s.defenseTotalTackles || 0) * 4;
      return { name: p.Name, line: parts.join("; "), impact }; }).filter((p) => p.line).sort((a, b) => b.impact - a.impact);
    return ps.slice(0, n).map((p) => `${p.name}: ${p.line}`);
  }

  async function factSheet(e) {
    const t = tInfo(e.tk), a = state.assignments[akey(e.gt, e.tk)];
    const base = { league_coach: { name: coachLabel(e.gt), call_him: coachShort(e.gt), career_at_school: careerAt(e.gt, e.tk), career_overall: careerAll(e.gt) },
      school: t.name, nickname: t.nickname || null, conference: t.conference || null, record: t.record || null, conference_record: t.conference_record || null,
      ranking: rk(t.rank) ? `No. ${t.rank}` : "unranked", streak: streakOf(e.tk), season_stage: cur.season_text };
    if (e.kind === "game") {
      const g = e.g, me = g.home.team_key === e.tk ? g.home : g.away, op = me === g.home ? g.away : g.home, b = boxes.get(g.key);
      const MB = b ? (me === g.home ? b.Home : b.Away) : null, OB = b ? (me === g.home ? b.Away : b.Home) : null;
      const opGt = gtOf.get(op.team_key);
      return { ...base, event: "game result", week: weekWord(g.week),
        result: `${me.score > op.score ? "WON" : me.score < op.score ? "LOST" : "TIED"} ${me.score}-${op.score} ${me === g.home ? "vs" : "at"} ${rk(op.rank_at_game) ? `No. ${op.rank_at_game} ` : ""}${op.team}`,
        your_team_rank_at_kickoff: rk(me.rank_at_game) ? `No. ${me.rank_at_game}` : "unranked",
        opponent: { name: op.team, record: tInfo(op.team_key).record || null, coach: opGt ? `league coach ${coachLabel(opGt)}` : "CPU team" },
        rivalry: rivalOf.get(nk(me.team) + "|" + nk(op.team)) || null,
        score_by_quarter: MB?.Quarters && OB?.Quarters ? { [me.team]: MB.Quarters, [op.team]: OB.Quarters } : null,
        team_stats: MB ? { [me.team]: teamStats(MB.Stats), [op.team]: teamStats(OB.Stats) } : null,
        top_players: b ? { [me.team]: playersFor(b, me.team_key), [op.team]: playersFor(b, op.team_key, 2) } : null,
        other_coverage: wireFor(g.key, e.tk) };
    }
    if (e.kind === "hire") {
      const m = e.move;
      return { ...base, event: m.kind === "join" ? `${coachLabel(e.gt)} joins The Dynasty as the new head coach at ${t.name}` : `${coachLabel(e.gt)} was hired away from ${m.from_name} to coach ${t.name}`,
        previous_job: m.from_name || null, previous_job_record: m.from ? careerAt(e.gt, m.from) : null,
        note: "This is your first column on him. Introduce yourself through your take: welcome him, doubt him, or set the bar." };
    }
    if (e.kind === "opener") {
      const prev = coachHist.find((x) => lc(x.gamertag) === lc(e.gt))?.seasons?.[cur.season - 1];
      const opp = e.sched.map((g) => { const me = g.home.team_key === e.tk ? g.home : g.away, op = me === g.home ? g.away : g.home, ot = tInfo(op.team_key);
        return { week: weekWord(g.week), opponent: `${me === g.home ? "vs" : "at"} ${rk(ot.rank) ? `No. ${ot.rank} ` : ""}${op.team}`, league_coach: gtOf.has(op.team_key) ? coachShort(gtOf.get(op.team_key)) : null,
          rivalry: rivalOf.get(nk(t.name) + "|" + nk(op.team)) || null }; });
      const cls = (classes.data || []).find((c) => String(c.team_key) === String(e.tk));
      const ros = (await api(`/rosters?team=${e.tk}`).catch(() => ({ data: [] }))).data || [];
      const stars = [...ros].sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 6).map((p) => `${p.name}, ${p.position}, ${p.overall} OVR, ${p.class_year || ""}${p.dev_trait && p.dev_trait !== "Normal" ? `, ${p.dev_trait}` : ""}`);
      const qb = ros.filter((p) => p.position === "QB").sort((a, b) => (b.overall || 0) - (a.overall || 0))[0];
      return { ...base, event: `season preview for ${cur.season}`, preseason_ranking: rk(t.rank) ? `No. ${t.rank}` : "unranked",
        team_ratings: { overall: t.overall ?? null, offense: t.offense ?? null, defense: t.defense ?? null, prestige_stars: t.prestige_stars ?? null },
        last_season_under_this_coach: prev && String(prev.team_key) === String(e.tk) ? { record: `${prev.w}-${prev.l}`, notes: prev.notes || [] } : prev ? `he coached ${prev.team} last season (${prev.w}-${prev.l})` : coachHist.some((x) => lc(x.gamertag) === lc(e.gt) && Object.keys(x.seasons || {}).length) ? "didn't coach in the league last season" : "first season in The Dynasty",
        best_players: stars, starting_qb: qb ? `${qb.name}, ${qb.overall} OVR ${qb.class_year || ""}` : null,
        schedule: opp, recruiting_class_now: cls ? { national_rank: cls.rank, commits: cls.commits?.total ?? null } : null,
        note: "Season preview column: set the stakes for the year, size up the roster and the schedule (circle the games that matter), and finish with your prediction for the record. The prediction is your opinion and can be as optimistic or as bleak as your persona would make it." };
    }
    if (e.kind === "recruit") {
      const STARS = ["", "1-star", "2-star", "3-star", "4-star", "5-star"];
      const POSW = { HB: "running back", FB: "fullback", WR: "receiver", TE: "tight end", LT: "offensive tackle", RT: "offensive tackle", LG: "guard", RG: "guard", C: "center", LEDG: "edge rusher", REDG: "edge rusher", DT: "defensive tackle", SAM: "linebacker", WILL: "linebacker", MIKE: "middle linebacker", CB: "cornerback", FS: "safety", SS: "safety", K: "kicker", P: "punter", ATH: "athlete" };
      const who = (x) => { const r = recInfo.get(x.prospect_key) || {};
        const beat = (r.top_schools || []).filter((s) => s.name !== x.school?.name && s.influence > 0).slice(0, 3).map((s) => s.name);
        return { name: x.name, prospect: `${STARS[x.stars] || ""} ${POSW[x.position] || x.position}${x.national_rank ? `, No. ${x.national_rank} nationally` : ""}`.trim(), type: x.transfer ? "transfer portal" : "high school recruit",
          move: x.kind === "sign" ? "signed" : x.kind === "decommit" ? "decommitted" : x.previous_school ? `flipped from ${x.previous_school.name} to ${x.school?.name}` : "committed",
          archetype: r.archetype || null, hometown: r.hometown ? `${r.hometown}${r.state ? `, ${r.state}` : ""}` : null, top_priority: r.dealbreaker || null, other_finalists: beat }; };
      const order = (a, c) => (c.stars - a.stars) || ((a.national_rank || 9999) - (c.national_rank || 9999));
      const gets = [...e.rec.gets].sort(order), losses = [...e.rec.losses].sort(order);
      const cls = (classes.data || []), mine = cls.find((c) => String(c.team_key) === String(e.tk));
      const confRank = mine && t.conference ? cls.filter((c) => tInfo(c.team_key).conference === t.conference).findIndex((c) => String(c.team_key) === String(e.tk)) + 1 : 0;
      const lg = [...games].filter((g) => g.home.team_key === e.tk || g.away.team_key === e.tk).sort((a, c) => c.week - a.week)[0];
      const lastGame = lg ? (() => { const me = lg.home.team_key === e.tk ? lg.home : lg.away, op = me === lg.home ? lg.away : lg.home; return `${me.score > op.score ? "won" : "lost"} ${me.score}-${op.score} ${me === lg.home ? "vs" : "at"} ${rk(op.rank_at_game) ? `No. ${op.rank_at_game} ` : ""}${op.team} (${weekWord(lg.week)})`; })() : null;
      // the writer's angle this time: mostly his persona's call, nudged so the feed isn't all good news
      const top = gets[0], elite = top && (top.stars >= 4 || (top.national_rank || 999) <= 150);
      const ANG = [
        ["big get", "Celebrate (or grudgingly admit) the biggest get and what it says about the coach's pull on the trail.", 3 + (elite ? 3 : 0)],
        ["the win sealed it", "Tie the commitment to the team's last result (a win sealed it, or he committed in spite of a loss).", lastGame ? 2 : 0],
        ["class rankings", "Where the class now sits nationally and in the conference, who's ahead, who's behind, what's still missing.", mine ? 3 : 0],
        ["scheme fit doubts", "Skeptical: question whether the top get fits this staff's scheme or depth chart. Make the case with conviction.", top ? 2 : 0],
        ["culture risk", "Skeptical: invent a mild off-field concern about the top get from high school (a team-rules suspension his senior year, clashing with his high school coach, transferring high schools twice, a social media spat with a rival, effort questions on film) and wonder aloud if he's a culture risk. Frame it as what you're hearing; keep it mild and football-related.", top ? 2 : 0],
        ["overrated?", "Skeptical: argue the ranking oversells him, or that the staff reached while better players went elsewhere.", top ? 1 : 0],
        ["the one that got away", "Lead with the recruit who flipped or decommitted away from this program and what it means.", losses.length ? 6 : 0],
      ].filter((a) => a[2] > 0);
      const tot = ANG.reduce((n, a) => n + a[2], 0); let roll = hash(e.id + "angle") % tot, angle = ANG[0];
      for (const a of ANG) { if (roll < a[2]) { angle = a; break; } roll -= a[2]; }
      return { ...base, event: gets.some((x) => x.kind === "sign") && gets.every((x) => x.kind === "sign") ? "signings" : "recruiting moves this week",
        additions: gets.slice(0, 6).map(who), more_additions: Math.max(0, gets.length - 6), lost_to_other_schools: losses.slice(0, 3).map(who),
        recruiting_class: mine ? { national_rank: mine.rank, conference_rank: confRank || null, commits: mine.commits?.total ?? null, five_stars: mine.commits?.five_star ?? null, four_stars: mine.commits?.four_star ?? null } : null,
        last_game: lastGame, suggested_angle: `${angle[0]}: ${angle[1]}`,
        note: "Recruits and their families, high school coaches and anonymous recruiting sources may be quoted (invented). Keep any criticism of a recruit to football and mild school-age stuff: never crimes, drugs, violence, sex, health or family problems." };
    }
    const m = e.move;
    return { ...base, event: m.kind === "leave" ? `${coachLabel(e.gt)} is out at ${t.name}; the program goes back to the CPU (he retired or left the league)` : `${coachLabel(e.gt)} is leaving ${t.name} to take the ${m.to_name} job`,
      destination: m.to_name || null, note: "This is your last column covering him. Send-off, good riddance, or betrayal: your call." };
  }

  async function write(e) {
    const a = state.assignments[akey(e.gt, e.tk)] || assign(e.gt, e.tk), w = writerOf(a), t = tInfo(e.tk);
    const facts = await factSheet(e);
    let out;
    const user = `YOUR PERSONA: ${w.name}, ${a.outlet}. ${w.style}
You've covered ${coachShort(e.gt)} at ${t.name} since ${a.since}.
Your notes from earlier columns: ${a.notes?.length ? a.notes.slice(-5).map((n) => `\n- ${n}`).join("") : "none yet (this is your first column on him)"}

FACT SHEET:
${JSON.stringify(facts, null, 1)}`;
    if (process.env.BEAT_DUMP) console.log(user);
    if (FAKE) out = { kick: e.kind === "game" ? "Postgame" : e.kind === "hire" ? "New era" : e.kind === "recruit" ? "Recruiting" : e.kind === "opener" ? "Season preview" : "Farewell", h: `[test] ${w.name} on ${t.name}: ${facts.result || facts.suggested_angle || facts.event}`, dek: `Test dek for ${t.name}.`,
      body: ["Test paragraph one. " + JSON.stringify(facts).slice(0, 300), "Test paragraph two.", "Test paragraph three."], note: "test note" };
    else {
      out = parseJson(await claude(SYSTEM, user));
    }
    const body = (Array.isArray(out.body) ? out.body : String(out.body || "").split(/\n+/)).map((p) => String(p).trim()).filter(Boolean);
    if (!out.h || !body.length) throw new Error("empty article");
    const g = e.g;
    const art = { id: e.id.replace(/^beat:/, "").replace(/[^a-z0-9]+/gi, "-"), kind: e.kind, team: e.tk, team_name: t.name, gt: e.gt, coach: coachShort(e.gt),
      writer: w.id, by: w.name, outlet: a.outlet, kick: String(out.kick || "").slice(0, 28), h: String(out.h).slice(0, 160), dek: String(out.dek || "").slice(0, 260), body,
      words: body.join(" ").split(/\s+/).length, game: g?.key, week: g?.week, opp: g ? (g.home.team_key === e.tk ? g.away.team : g.home.team) : undefined,
      result: g ? (() => { const me = g.home.team_key === e.tk ? g.home : g.away, op = me === g.home ? g.away : g.home; return `${me.score > op.score ? "W" : me.score < op.score ? "L" : "T"} ${me.score}-${op.score}`; })() : undefined,
      period: cur.id, season: cur.season, season_text: cur.season_text, at: new Date().toISOString() };
    if (out.note) a.notes = [...(a.notes || []), `${cur.season_text}: ${String(out.note).slice(0, 200)}`].slice(-6);
    return art;
  }

  const written = (await pool(todo, 4, async (e) => { try { const r = await write(e); done.add(e.id); return r; } catch (err) { log(`${e.id} failed: ${err.message}`); return null; } })).filter(Boolean);
  const file = `${DIR}/beat-${cur.season}.json`;
  const arc = await readJson(file, { season: cur.season, articles: [] });
  const have = new Set(arc.articles.map((x) => x.id));
  for (const x of written) if (!have.has(x.id)) arc.articles.push(x);
  arc.articles.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  arc.updated = new Date().toISOString();
  await writeFile(file, JSON.stringify(arc));
  await saveState();
  log(`wrote ${written.length} article(s) → ${file}${FAKE ? " (fake AI)" : ` with ${MODEL}`}`);
}
main().catch((e) => { console.error("[beat] failed:", e.message); process.exit(0); });
