// Dynasty history archive. Runs after build-player-stats.mjs on every sync and keeps
// a permanent record of the dynasty, filed by league so a new dynasty starts clean:
//
//   data/history/<league_id>/seasons/<year>.json   games, champions, awards (archived per season)
//   data/history/<league_id>/players-<year>.json   every FBS player's season stats (frozen when the season ends)
//   data/history/<league_id>/coaches.json          user coach careers: W-L, rivalries, titles, CFP, stints, H2H
//   data/history/<league_id>/careers/<n>.json      player careers (season rows + awards), sharded by player_key % 64
//   data/history/<league_id>/leaders.json          career and single-season leaders
//   data/history/<league_id>/index.json            league, seasons, last build
//
// Env: DYNASTY_API_KEY. Optional files: discord.config.json (coach_names), rivalries.json.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { currentGames } from "./current-games.mjs";

const API = (process.env.DYNASTY_API_BASE || "https://dynasty.prestonchoate.dev/v1").replace(/\/$/, "");
const KEY = process.env.DYNASTY_API_KEY;
const SHARDS = 64;
const NY6 = new Set(["Peach Bowl", "Rose Bowl", "Fiesta Bowl", "Cotton Bowl", "Orange Bowl", "Sugar Bowl"]);
const STAT_KEYS = ["gamesPlayed", "passCompletion", "passAttempts", "passYards", "passTD", "passINT", "rushAttempts", "rushYards", "rushTD",
  "receiveReceptions", "receivingYards", "receiveTouchdowns", "defenseTotalTackles", "defenseTacklesForLoss", "defenseSacks", "defenseInterceptions",
  "defensePassDeflections", "defenseFumbleForced", "defenseTouchdowns", "kickFieldGoalsMade", "kickFieldGoalAttempts", "kickXPMade", "punts", "puntYards",
  "kickReturnYards", "puntReturnYards", "kickReturnTouchdowns", "puntReturnTouchdown"];
const LEADER_CATS = { passYards: "Passing yards", passTD: "Passing TD", rushYards: "Rushing yards", rushTD: "Rushing TD",
  receivingYards: "Receiving yards", receiveReceptions: "Receptions", receiveTouchdowns: "Receiving TD",
  defenseTotalTackles: "Tackles", defenseSacks: "Sacks", defenseInterceptions: "Interceptions", kickFieldGoalsMade: "Field goals" };

const log = (...a) => console.log(...a);
const readJson = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
async function api(path, tries = 5) {
  for (let i = 1; ; i++) {
    let r;
    try { r = await fetch(API + path, { headers: { Authorization: `Bearer ${KEY}` } }); }
    catch (err) { // dropped connection (ECONNRESET etc.): back off and retry like a 5xx
      if (i >= tries) throw err;
      console.warn(`${path} → ${err.cause?.code || err.message}, retrying in ${5 * i}s`);
      await new Promise((res) => setTimeout(res, 5000 * i)); continue;
    }
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) { await new Promise((s) => setTimeout(s, (Number(r.headers.get("retry-after")) || 5 * i) * 1000)); continue; }
    throw new Error(`API ${path} → ${r.status}`);
  }
}
const slim = (s = {}) => Object.fromEntries(STAT_KEYS.filter((k) => s[k]).map((k) => [k, s[k]]));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const confKey = (c) => (String(c || "").startsWith("Sun Belt") ? "Sun Belt" : c || "");

function gameType(g) {
  const b = g.bowl_name || "";
  if (b === "National Championship") return "natty";
  if (b.startsWith("CFP") || NY6.has(b)) return "cfp";
  if (/Championship$/.test(b)) return "confchamp";
  if (b) return "bowl";
  return "reg";
}

async function main() {
  if (!KEY) throw new Error("DYNASTY_API_KEY must be set");
  const leagueRes = await api("/league"), league = { ...leagueRes.data, data_version: leagueRes.data_version }; // data_version is on the response, not .data
  const LID = league.league_id, DIR = `data/history/${LID}`;
  const cur = league.current_period;
  const index = await readJson(`${DIR}/index.json`, {});
  if (index.last_period_id === cur.id && index.last_data_version === league.data_version && !process.env.FORCE) { log("History up to date."); return; }
  await mkdir(`${DIR}/seasons`, { recursive: true });
  await mkdir(`${DIR}/careers`, { recursive: true });

  const cfg = await readJson("discord.config.json", {});
  const rivalries = (await readJson("rivalries.json", { rivalries: [] })).rivalries;
  const rivalOf = new Map();
  for (const [a, b, name] of rivalries) { rivalOf.set(`${norm(a)}|${norm(b)}`, name); rivalOf.set(`${norm(b)}|${norm(a)}`, name); }

  const [seasonsR, historyR, periodsR] = await Promise.all([api("/seasons"), api("/history"), api("/periods")]);
  const seasons = (seasonsR.data || []).map((s) => (typeof s === "object" ? s.season ?? s.year : s)).filter(Boolean).sort();
  const history = historyR.data || [];

  /* ---------- archive each season ---------- */
  // Past seasons don't include standings, so conferences come from the current lineup.
  const curStandings = await api("/standings").catch(() => ({ data: [] }));
  const curTeams = curStandings.data.map((t) => ({ team_key: t.team_key, name: t.name, conference: t.conference }));
  // The current season's schedule can still hold last season's tail (e.g. the title game). Those games
  // belong to the previous season's archive, not this one.
  const curSch = await api(`/schedule?season=${cur.season}`).catch(() => ({ data: [] }));
  const curKeep = new Set(currentGames(curSch.data || [], cur.season));
  const leftovers = (curSch.data || []).filter((g) => !curKeep.has(g) && g.played);
  for (const year of seasons) {
    const file = `${DIR}/seasons/${year}.json`;
    const prev = await readJson(file);
    if (prev?.final && year !== cur.season) continue; // finished seasons are frozen (the current one never is)
    const [sch, st, aw, aa] = await Promise.all([
      api(`/schedule?season=${year}`), year === cur.season ? api("/standings") : null,
      api(`/awards?season=${year}`).catch(() => ({ data: [] })), api(`/awards/all-american?season=${year}`).catch(() => ({ data: [] })),
    ]);
    const conf = new Map((st?.data || prev?.teams || []).map((t) => [t.team_key, { name: t.name, conference: t.conference }]));
    const side = (s) => ({ k: s.team_key, t: s.team, s: s.score, u: s.user_name && s.user_name !== "CPU" ? s.user_name : null, r: s.rank_at_game > 0 && s.rank_at_game <= 25 ? s.rank_at_game : null });
    // Past seasons come back with played=false even when final scores exist, so trust the score line.
    const wasPlayed = (g) => !!g.played || (year < cur.season && (g.home.score || 0) + (g.away.score || 0) > 0);
    let raw = sch.data || [];
    if (year === cur.season) raw = currentGames(raw, year);
    if (year === cur.season - 1 && leftovers.length) { const have = new Set(raw.map((g) => `${g.week}|${g.home.team_key}|${g.away.team_key}`)); raw = [...raw, ...leftovers.filter((g) => !have.has(`${g.week}|${g.home.team_key}|${g.away.team_key}`))]; }
    const games = raw.map((g) => ({ key: g.key, w: g.week, label: g.bowl_name || g.displayed_week, type: gameType(g), played: wasPlayed(g), a: side(g.away), h: side(g.home) }));
    // final only when the title game AND every other game is done (a leftover natty from last season must not freeze a new season)
    const nattyPlayed = games.some((g) => g.type === "natty" && g.played) && games.length > 1 && (year < cur.season || games.every((g) => g.played));
    const out = {
      season: year, final: nattyPlayed,
      teams: st ? st.data.map((t) => ({ team_key: t.team_key, name: t.name, conference: t.conference, record: t.record, rank: t.rank, user: !!t.user_controlled })) : prev?.teams?.length ? prev.teams : curTeams,
      games,
      champions: history.filter((h) => h.season === year && h.kind !== "award"),
      annual_awards: history.filter((h) => h.season === year && h.kind === "award"),
      weekly_awards: (aw.data || []).map((a) => ({ w: a.week, award: a.award, conf: a.conference, k: a.player_key, n: a.name, p: a.position, t: a.team_key, tn: a.team_name, line: a.stat_line })),
      all_americans: (aa.data || []).map((x) => ({ team: x.team, conf: x.conference, players: (x.players || []).map((p) => ({ k: p.player_key, n: p.name, p: p.position, t: p.team_key, tn: p.team_name })) })),
    };
    // remember team conferences for seasons archived after their standings are gone
    if (!out.teams.length) out.teams = [...conf.entries()].map(([k, v]) => ({ team_key: k, ...v }));
    await writeFile(file, JSON.stringify(out));
    log(`season ${year}: ${games.length} games${out.final ? " (final)" : ""}`);

    // player season stats: current season comes from the all-FBS builder; past seasons keep their frozen copy
    const pfile = `${DIR}/players-${year}.json`;
    if (year === cur.season) {
      const all = await readJson("data/player-stats-all.json");
      if (all) await writeFile(pfile, JSON.stringify({ season: year, data: all.data.map((p) => ({ k: p.player_key, n: p.name, f: p.first_name, l: p.last_name, p: p.position, t: p.team_key, u: !!p.user_team, s: slim(p.stats) })) }));
    } else if (!(await readJson(pfile))) {
      // a season that ended before archiving started: fall back to the last snapshot of user-team stats
      const last = (periodsR.data || []).filter((p) => p.season === year).sort((a, b) => b.id - a.id)[0];
      const ps = last ? await api(`/player-stats?period=${last.id}`).catch(() => null) : null;
      if (ps) await writeFile(pfile, JSON.stringify({ season: year, partial: true, data: ps.data.map((p) => ({ k: p.player_key, n: p.name, f: p.first_name, l: p.last_name, p: p.position, t: p.team_key, u: true, s: slim(p.stats) })) }));
    }
  }

  /* ---------- load the whole archive ---------- */
  const S = [];
  for (const y of seasons) { const s = await readJson(`${DIR}/seasons/${y}.json`); if (s) S.push(s); }
  const teamName = new Map(); for (const s of S) for (const t of s.teams) teamName.set(t.team_key, t.name);

  /* ---------- coaches ---------- */
  const coachNames = { ...(index.learned_names || {}) };
  const C = new Map();
  const coach = (u) => {
    if (!C.has(u)) C.set(u, { gamertag: u, w: 0, l: 0, t: 0, conf_w: 0, conf_l: 0, ranked_w: 0, ranked_l: 0, rival_w: 0, rival_l: 0, bowl_w: 0, bowl_l: 0,
      cc_apps: 0, cc_wins: 0, cfp_apps: 0, cfp_w: 0, cfp_l: 0, natty_apps: 0, natty_wins: 0, seasons: {}, h2h: {}, titles: [], rivalry_games: {} });
    return C.get(u);
  };
  for (const s of S) {
    const confOf = new Map(s.teams.map((t) => [t.team_key, confKey(t.conference)]));
    const cfpSeason = new Set();
    for (const g of s.games) {
      if (!g.played) continue;
      for (const [me, op] of [[g.a, g.h], [g.h, g.a]]) {
        if (!me.u) continue;
        const c = coach(me.u);
        const res = me.s > op.s ? "w" : me.s < op.s ? "l" : "t";
        const row = (c.seasons[s.season] ??= { team: me.t, team_key: me.k, w: 0, l: 0, t: 0, conf_w: 0, conf_l: 0, notes: [] });
        row.team = me.t; row.team_key = me.k; row[res]++; c[res]++;
        const isConf = g.type === "reg" && confOf.get(me.k) && confOf.get(me.k) === confOf.get(op.k) && confOf.get(me.k) !== "Independent";
        if (isConf && res !== "t") { c[`conf_${res}`]++; row[`conf_${res}`]++; }
        if (op.r && res !== "t") c[`ranked_${res}`]++;
        const rival = rivalOf.get(`${norm(me.t)}|${norm(op.t)}`);
        if (rival && res !== "t") { c[`rival_${res}`]++; const rg = (c.rivalry_games[rival] ??= { w: 0, l: 0, vs: op.t }); rg[res]++; }
        if (g.type === "bowl" && res !== "t") { c[`bowl_${res}`]++; row.notes.push(`${g.label} ${res === "w" ? "W" : "L"}`); }
        if (g.type === "confchamp") { c.cc_apps++; if (res === "w") { c.cc_wins++; c.titles.push({ season: s.season, title: g.label, team: me.t }); row.notes.push(`🏆 ${g.label}`); } else row.notes.push(`${g.label} L`); }
        if (g.type === "cfp" || g.type === "natty") { cfpSeason.add(me.u); if (res !== "t") c[`cfp_${res}`]++; row.notes.push(`${g.label} ${res === "w" ? "W" : "L"}`); }
        if (g.type === "natty") { c.natty_apps++; if (res === "w") { c.natty_wins++; c.titles.push({ season: s.season, title: "National Championship", team: me.t }); } }
        if (op.u) { const h = (c.h2h[op.u] ??= { w: 0, l: 0, t: 0, games: [] }); h[res]++; (h.games ??= []).push({ y: s.season, wk: g.label || `Week ${g.w}`, w: g.w, key: g.key, me: me.t, op: op.t, ms: me.s, os: op.s, res, type: g.type }); }
      }
    }
    for (const u of cfpSeason) coach(u).cfp_apps++;
    // learn created-coach names from League History (champions list the coach's in-game name)
    for (const ch of s.champions) {
      const g = s.games.find((x) => (x.type === "confchamp" || x.type === "natty") && x.played && (x.a.k === ch.team?.team_key || x.h.k === ch.team?.team_key));
      const side = g && (g.a.k === ch.team.team_key ? g.a : g.h);
      if (side?.u && ch.coach) coachNames[side.u] = ch.coach;
    }
  }
  const nameFor = (u) => cfg.coach_names?.[u] || coachNames[u] || null;
  const coaches = [...C.values()].map((c) => {
    const yrs = Object.keys(c.seasons).map(Number).sort();
    const stints = [];
    for (const y of yrs) {
      const r = c.seasons[y], last = stints[stints.length - 1];
      if (last && last.team_key === r.team_key && last.to === y - 1) { last.to = y; last.w += r.w; last.l += r.l; last.t += r.t; }
      else stints.push({ team: r.team, team_key: r.team_key, from: y, to: y, w: r.w, l: r.l, t: r.t });
    }
    const gp = c.w + c.l + c.t;
    return { ...c, name: nameFor(c.gamertag), pct: gp ? (c.w + c.t / 2) / gp : 0, first: yrs[0], last: yrs[yrs.length - 1], n_seasons: yrs.length, stints,
      current_team: stints[stints.length - 1]?.team || null };
  }).sort((a, b) => b.w - a.w || b.pct - a.pct);
  await writeFile(`${DIR}/coaches.json`, JSON.stringify({ league: league.name, updated: new Date().toISOString(), coaches }));

  /* ---------- player careers + leaders ---------- */
  const careers = new Map();
  const seasonRows = [];
  for (const y of seasons) {
    const pf = await readJson(`${DIR}/players-${y}.json`); if (!pf) continue;
    for (const p of pf.data) {
      if (!p.s?.gamesPlayed && !Object.keys(p.s || {}).length) continue;
      const c = careers.get(p.k) || { k: p.k, n: p.n, f: p.f, l: p.l, p: p.p, seasons: [], awards: [] };
      c.n = p.n || c.n; c.f = p.f || c.f; c.l = p.l || c.l; c.p = p.p || c.p;
      c.seasons.push({ y, t: p.t, tn: teamName.get(p.t) || "", p: p.p, s: p.s, partial: !!pf.partial });
      careers.set(p.k, c);
      seasonRows.push({ k: p.k, n: p.n, p: p.p, y, t: p.t, tn: teamName.get(p.t) || "", s: p.s });
    }
  }
  const award = (k, a) => { const c = careers.get(k); if (c) c.awards.push(a); };
  for (const s of S) {
    for (const a of s.weekly_awards) award(a.k, { y: s.season, w: a.w, award: `${a.conf === "National" ? "National" : a.conf} ${a.award}`, team: a.tn, line: a.line });
    for (const team of s.all_americans) for (const p of team.players) award(p.k, { y: s.season, award: team.conf === "National" ? team.team : `${team.conf} ${team.team.replace("All-American", "All-Conference")}`, team: p.tn });
    for (const a of s.annual_awards) {
      if (/HC|OC|DC/.test(a.position || "")) continue; // coaching awards
      const hit = [...careers.values()].find((c) => c.seasons.some((r) => r.y === s.season && r.t === a.team?.team_key) && (norm(`${c.f}${c.l}`) === norm(a.name) || norm(c.n) === norm(a.name)));
      if (hit) hit.awards.push({ y: s.season, award: a.title, team: a.team?.name, major: true });
    }
  }
  const shards = Array.from({ length: SHARDS }, () => ({}));
  for (const c of careers.values()) {
    c.totals = {}; for (const r of c.seasons) for (const [k, v] of Object.entries(r.s)) c.totals[k] = (c.totals[k] || 0) + v;
    shards[c.k % SHARDS][c.k] = c;
  }
  for (let i = 0; i < SHARDS; i++) await writeFile(`${DIR}/careers/${i}.json`, JSON.stringify(shards[i]));

  const top = (rows, k, n = 25) => rows.filter((r) => r.s[k]).sort((a, b) => b.s[k] - a.s[k]).slice(0, n);
  const careerRows = [...careers.values()].map((c) => ({ k: c.k, n: c.n, p: c.p, span: `${c.seasons[0].y}${c.seasons.length > 1 ? "–" + c.seasons[c.seasons.length - 1].y : ""}`,
    tn: [...new Set(c.seasons.map((r) => r.tn))].join(" / "), t: c.seasons[c.seasons.length - 1].t, y: c.seasons[c.seasons.length - 1].y, s: c.totals }));
  const leaders = { career: {}, season: {}, cats: LEADER_CATS, seasons };
  for (const k of Object.keys(LEADER_CATS)) {
    leaders.career[k] = top(careerRows, k).map((r) => ({ k: r.k, n: r.n, p: r.p, span: r.span, tn: r.tn, v: r.s[k], g: r.s.gamesPlayed || 0 }));
    leaders.season[k] = top(seasonRows, k, 50).map((r) => ({ k: r.k, n: r.n, p: r.p, y: r.y, tn: r.tn, v: r.s[k], g: r.s.gamesPlayed || 0 }));
  }
  await writeFile(`${DIR}/leaders.json`, JSON.stringify(leaders));

  // real NCAA FBS records this dynasty has passed. first_seen sticks so the site and the AI desk know when each fell.
  const ncaa = await readJson("data/ncaa-records.json");
  if (ncaa) {
    const prev = new Map(((await readJson(`${DIR}/records.json`))?.broken || []).map((b) => [`${b.scope}:${b.cat}:${b.k}:${b.y}`, b]));
    const broken = [];
    for (const scope of ["season", "career"]) for (const [cat, rec] of Object.entries(ncaa[scope] || {})) {
      for (const r of scope === "season" ? seasonRows : careerRows) {
        const v = r.s[cat] || 0; if (v <= rec.value) continue;
        const y = r.y, was = prev.get(`${scope}:${cat}:${r.k}:${scope === "season" ? y : ""}`);
        broken.push({ scope, cat, label: LEADER_CATS[cat], k: r.k, n: r.n, p: r.p, t: r.t, tn: r.tn, y: scope === "season" ? y : "", span: r.span || String(y), v,
          old: { holder: rec.holder, school: rec.school, years: rec.years, value: rec.value },
          first_seen_period: was?.first_seen_period ?? cur.id, first_seen_at: was?.first_seen_at ?? new Date().toISOString(), first_v: was?.first_v ?? v });
      }
    }
    broken.sort((a, b) => String(b.first_seen_at).localeCompare(String(a.first_seen_at)));
    await writeFile(`${DIR}/records.json`, JSON.stringify({ through: ncaa.through, broken }));
    if (broken.length) log(`Records: ${broken.length} NCAA mark(s) passed in this dynasty.`);
  }

  await writeFile(`${DIR}/index.json`, JSON.stringify({ league_id: LID, league: league.name, seasons, current_season: cur.season, last_period_id: cur.id,
    last_data_version: league.data_version, updated: new Date().toISOString(), learned_names: coachNames, shards: SHARDS }));
  log(`History: ${S.length} seasons, ${coaches.length} coaches, ${careers.size} player careers.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
