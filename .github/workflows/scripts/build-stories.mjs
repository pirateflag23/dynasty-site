// TD Wire: data-driven storylines for the site and Discord.
//
// Every sync this reads the dynasty and writes data/stories/<league_id>/latest.json:
//   recruiting  commits, flips, decommits, signings and hot recruiting battles, each with a
//               reason drawn from the data (dealbreaker vs. school grades, depth chart, NIL,
//               distance from home, recent big wins) and the schools he passed on
//   games       stories from the latest week's box scores: upsets, comebacks, 4th-down gambles,
//               interception nightmares, monster days, penalty meltdowns, streaks
//
// Text uses link tokens the site/Discord turn into links:
//   [[t:<team_key>|Name]]  [[r:<prospect_key>|Name]]  [[p:<player_key>|Name]]  [[c:<gamertag>|Name]]  [[g:<game_key>|text]]
//
// Quote policy: CFB27 rosters start with real players and real CPU head coaches, so they never
// get invented quotes, only narration. Quotes come only from generated recruits and league coaches.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { buildOutlook } from "./stories-outlook.mjs";

const API = (process.env.DYNASTY_API_BASE || "https://dynasty.prestonchoate.dev/v1").replace(/\/$/, "");
const KEY = process.env.DYNASTY_API_KEY;
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
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j]); } })); return out; }

/* ---------- deterministic variety: same story text every run for the same event ---------- */
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (seed, arr) => arr[hash(seed) % arr.length];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const T = (k, n) => `[[t:${k}|${n}]]`, R = (k, n) => `[[r:${k}|${n}]]`, P = (k, n) => `[[p:${k}|${n}]]`, G = (k, s) => `[[g:${k}|${s}]]`;
const STARS = ["", "one-star", "two-star", "three-star", "four-star", "five-star"];
// NIL amounts come in thousands: 520 -> "520K", 1250 -> "1.25 million"
const money = (k) => { const n = Number(k) || 0; return Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(2)} million` : `${n}K`; };
const num = (n) => ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
const ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const list = (a) => (a.length <= 1 ? a.join("") : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${num(n)} times`);
const plural = (n, w) => `${num(n)} ${w}${n === 1 ? "" : "s"}`;
// capitalize the first visible letter, even when the headline starts with a link token
const capH = (s) => s.replace(/^((?:\[\[\w:[^|]*\|)?)([a-z])/, (m, a, c) => a + c.toUpperCase());
// "an 87-overall", "an SMU team": article from how the word sounds
const an = (w) => (/^(8|11|18)\d*\b/.test(String(w)) || /^[aeiou]/i.test(String(w)) || /^(SMU|UAB|UCF|UCLA|UNLV|USC|USF|UTEP|UTSA|UL|LSU|FIU|NC|NMSU|MTSU)\b/.test(String(w)) ? "an" : "a");
const lastName = (n) => String(n || "").replace(/^[A-Z]\.\s*/, "").split(" ").slice(-1)[0];

const TEAM_STATE = { "Air Force": "CO", Akron: "OH", Alabama: "AL", "Appalachian State": "NC", Arizona: "AZ", "Arizona State": "AZ", Arkansas: "AR", "Arkansas State": "AR", Army: "NY", Auburn: "AL", BYU: "UT", "Ball State": "IN", Baylor: "TX", "Boise State": "ID", "Boston College": "MA", "Bowling Green": "OH", Buffalo: "NY", California: "CA", "Central Michigan": "MI", Charlotte: "NC", Cincinnati: "OH", Clemson: "SC", "Coastal Carolina": "SC", Colorado: "CO", "Colorado State": "CO", Delaware: "DE", Duke: "NC", "East Carolina": "NC", "Eastern Michigan": "MI", Florida: "FL", "Florida Atlantic": "FL", "Florida International": "FL", "Florida State": "FL", "Fresno State": "CA", Georgia: "GA", "Georgia Southern": "GA", "Georgia State": "GA", "Georgia Tech": "GA", "Hawai'i": "HI", Houston: "TX", Illinois: "IL", Indiana: "IN", Iowa: "IA", "Iowa State": "IA", "Jacksonville State": "AL", "James Madison": "VA", Kansas: "KS", "Kansas State": "KS", "Kennesaw State": "GA", "Kent State": "OH", Kentucky: "KY", LSU: "LA", Liberty: "VA", Louisiana: "LA", "Louisiana Tech": "LA", Louisville: "KY", Marshall: "WV", Maryland: "MD", Massachusetts: "MA", Memphis: "TN", Miami: "FL", "Miami University": "OH", Michigan: "MI", "Michigan State": "MI", "Middle Tennessee": "TN", Minnesota: "MN", "Mississippi State": "MS", Missouri: "MO", "Missouri State": "MO", "NC State": "NC", Navy: "MD", Nebraska: "NE", Nevada: "NV", "New Mexico": "NM", "New Mexico State": "NM", "North Carolina": "NC", "North Dakota State": "ND", "North Texas": "TX", "Northern Illinois": "IL", Northwestern: "IL", "Notre Dame": "IN", Ohio: "OH", "Ohio State": "OH", Oklahoma: "OK", "Oklahoma State": "OK", "Old Dominion": "VA", "Ole Miss": "MS", Oregon: "OR", "Oregon State": "OR", "Penn State": "PA", Pittsburgh: "PA", Purdue: "IN", Rice: "TX", Rutgers: "NJ", SMU: "TX", "Sacramento State": "CA", "Sam Houston": "TX", "San Diego State": "CA", "San Jose State": "CA", "South Alabama": "AL", "South Carolina": "SC", "Southern Mississippi": "MS", Stanford: "CA", Syracuse: "NY", TCU: "TX", Temple: "PA", Tennessee: "TN", Texas: "TX", "Texas A&M": "TX", "Texas State": "TX", "Texas Tech": "TX", Toledo: "OH", Troy: "AL", Tulane: "LA", Tulsa: "OK", UAB: "AL", UCF: "FL", UCLA: "CA", UConn: "CT", "UL Monroe": "LA", UNLV: "NV", USC: "CA", USF: "FL", UTEP: "TX", UTSA: "TX", Utah: "UT", "Utah State": "UT", Vanderbilt: "TN", Virginia: "VA", "Virginia Tech": "VA", "Wake Forest": "NC", Washington: "WA", "Washington State": "WA", "West Virginia": "WV", "Western Kentucky": "KY", "Western Michigan": "MI", Wisconsin: "WI", Wyoming: "WY" };
const NEIGHBORS = { CA: ["NV", "AZ", "OR"], TX: ["OK", "LA", "NM", "AR"], FL: ["GA", "AL"], GA: ["FL", "AL", "SC", "TN", "NC"], OH: ["MI", "IN", "PA", "KY", "WV"], PA: ["OH", "NY", "NJ", "MD", "WV", "DE"], NC: ["SC", "VA", "TN", "GA"], AL: ["GA", "MS", "TN", "FL"], LA: ["TX", "MS", "AR"], MS: ["LA", "AL", "TN", "AR"], TN: ["KY", "GA", "AL", "MS", "NC", "VA", "AR", "MO"], VA: ["NC", "MD", "WV", "KY", "TN", "DC"], MD: ["VA", "PA", "DE", "DC", "WV"], NJ: ["NY", "PA", "DE"], NY: ["NJ", "PA", "CT", "MA"], MI: ["OH", "IN", "WI"], IL: ["IN", "WI", "IA", "MO", "KY"], IN: ["IL", "OH", "MI", "KY"], AZ: ["CA", "NV", "UT", "NM"], WA: ["OR", "ID"], OR: ["WA", "CA", "ID"], OK: ["TX", "KS", "AR", "MO"], SC: ["NC", "GA"], KY: ["OH", "IN", "TN", "WV", "VA", "IL", "MO"], MO: ["KS", "IL", "IA", "AR", "OK", "TN", "KY", "NE"] };
const STATE_NAME = { AL: "Alabama", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawai'i", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", NE: "Nebraska", NV: "Nevada", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", SC: "South Carolina", TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "D.C." };

// recruit position -> roster positions, starters at those spots, pro-potential group, playing-style label
const POS = {
  QB: [["QB"], 1, "QB", "QB"], HB: [["HB"], 1, "RB", "HB"], FB: [["FB"], 1, "RB", "FB"], WR: [["WR"], 3, "WR", "WR"], TE: [["TE"], 1, "TE", "TE"],
  LT: [["LT", "RT"], 2, "OL", "OT"], RT: [["LT", "RT"], 2, "OL", "OT"], LG: [["LG", "RG"], 2, "OL", "G"], RG: [["LG", "RG"], 2, "OL", "G"], C: [["C"], 1, "OL", "C"],
  LEDG: [["LEDG", "REDG"], 2, "DL", "EDGE"], REDG: [["LEDG", "REDG"], 2, "DL", "EDGE"], DT: [["DT"], 2, "DL", "DT"],
  SAM: [["SAM", "WILL"], 2, "LB", "OLB"], WILL: [["SAM", "WILL"], 2, "LB", "OLB"], MIKE: [["MIKE"], 1, "LB", "MIKE"],
  CB: [["CB"], 2, "DB", "CB"], FS: [["FS", "SS"], 2, "DB", "S"], SS: [["FS", "SS"], 2, "DB", "S"], K: [["K"], 1, "K", "KP"], P: [["P"], 1, "P", "KP"],
  ATH: [["HB", "WR", "CB", "SS", "FS"], 3, null, null],
};
const POS_WORD = { QB: "quarterback", HB: "running back", FB: "fullback", WR: "receiver", TE: "tight end", LT: "tackle", RT: "tackle", LG: "guard", RG: "guard", C: "center",
  LEDG: "edge rusher", REDG: "edge rusher", DT: "defensive tackle", SAM: "linebacker", WILL: "linebacker", MIKE: "middle linebacker", CB: "cornerback", FS: "safety", SS: "safety", K: "kicker", P: "punter", ATH: "athlete" };

async function main() {
  if (!KEY) throw new Error("DYNASTY_API_KEY must be set");
  const leagueRes = await api("/league"), league = leagueRes.data;
  const LID = league.league_id, cur = league.current_period, DIR = `data/stories/${LID}`;
  const prevIdx = await readJson(`${DIR}/latest.json`, {});
  const schedule = await api("/schedule");
  const games = schedule.data;
  const playedCount = games.filter((g) => g.played).length;
  const STORY_V = 4; // bump when the story code changes so the next sync rebuilds without forcing every box score
  const sig = `${cur.id}:${leagueRes.data_version}:${playedCount}:v${STORY_V}`; // data_version sits on the response, not league.data
  if (prevIdx.sig === sig && !process.env.FORCE) { log("Stories up to date."); return; }
  await mkdir(DIR, { recursive: true });

  const cfg = await readJson("discord.config.json", {});
  const hist = await readJson(`data/history/${LID}/index.json`, {});
  const coachHist = (await readJson(`data/history/${LID}/coaches.json`, { coaches: [] })).coaches;
  const rivalries = (await readJson("rivalries.json", { rivalries: [] })).rivalries;
  const nk = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rivalOf = new Map(); for (const [a, b, n] of rivalries) { rivalOf.set(nk(a) + "|" + nk(b), n); rivalOf.set(nk(b) + "|" + nk(a), n); }

  const [standings, teamStats, members, grades, proPot, style, classes, commitsR, commitsT, board, committed] = await Promise.all([
    api("/standings"), api("/team-stats"), api("/members"), api("/school-grades").catch(() => ({ data: [] })),
    api("/school-grades/pro-potential").catch(() => ({ data: [] })), api("/school-grades/playing-style").catch(() => ({ data: [] })),
    api("/recruits/classes").catch(() => ({ data: [] })), api("/recruits/commits?type=recruits").catch(() => ({ data: [] })),
    api("/recruits/commits?type=transfers").catch(() => ({ data: [] })), api("/recruits?type=recruits&committed=false").catch(() => ({ data: [] })),
    api("/recruits?type=overall&committed=true").catch(() => ({ data: [] })),
  ]);
  const team = new Map(standings.data.map((t) => [t.team_key, t]));
  const ts = new Map(teamStats.data.map((t) => [t.team_key, t]));
  const byTid = new Map(teamStats.data.map((t) => [t.team_id, t.team_key]));
  const keyOfSchool = (s) => (s ? byTid.get(s.team_id) ?? standings.data.find((t) => t.name === s.name)?.team_key : null);
  const userTeams = new Set(members.data.map((m) => m.team_key));
  const memberOf = new Map(members.data.map((m) => [m.team_key, m]));
  const coachName = (gt) => cfg.coach_names?.[gt] || hist.learned_names?.[gt] || coachHist.find((c) => c.gamertag === gt)?.name || null;
  const coachTok = (teamKey) => { const m = memberOf.get(teamKey); if (!m) return null; const n = coachName(m.user_name); return `[[c:${m.user_name}|${n ? `Coach ${lastName(n)}` : m.user_name}]]`; };
  const coachSays = (teamKey) => { const m = memberOf.get(teamKey); if (!m) return null; const n = coachName(m.user_name); return n ? `Coach ${lastName(n)}` : m.user_name; };
  const nilRank = new Map([...teamStats.data].sort((a, b) => (b.nil_spend?.total || 0) - (a.nil_spend?.total || 0)).map((t, i) => [t.team_key, i + 1]));
  const gradeOf = (name, teamKey) => { const g = grades.data.find((x) => x.grade === name); const row = g?.rows?.find((r) => r.team_key === teamKey || r.name === team.get(teamKey)?.conference); return row ? { rank: row.rank, letter: row.letter, of: g.rows.length } : null; };
  const goodLetter = (l) => /^(A|B\+)/.test(l || "");
  const playedGames = games.filter((g) => g.played).sort((a, b) => a.week - b.week);
  const lastGame = (tk) => [...playedGames].reverse().find((g) => g.home.team_key === tk || g.away.team_key === tk);
  const streak = (tk) => { let n = 0, kind = null; for (const g of [...playedGames].reverse()) { if (g.home.team_key !== tk && g.away.team_key !== tk) continue; const me = g.home.team_key === tk ? g.home : g.away, o = me === g.home ? g.away : g.home; const r = me.score > o.score ? "W" : "L"; if (!kind) kind = r; if (r !== kind) break; n++; } return { kind, n }; };
  const recOf = (tk) => team.get(tk)?.record || "";
  const winPct = (tk) => { const t = team.get(tk); return t && t.wins + t.losses ? t.wins / (t.wins + t.losses) : 0.5; };
  const ranked = (tk) => { const r = team.get(tk)?.rank; return r > 0 && r <= 25 ? r : null; };
  const tName = (tk) => team.get(tk)?.name || ts.get(tk)?.name || "?";
  const tTok = (tk) => T(tk, tName(tk));

  // rosters for depth-chart angles, fetched once per team that needs them
  const rosterCache = new Map();
  const roster = async (tk) => { if (!rosterCache.has(tk)) rosterCache.set(tk, api(`/rosters?team=${tk}`).then((r) => r.data || []).catch(() => [])); return rosterCache.get(tk); };

  /* ===================== RECRUITING ===================== */
  const recruitInfo = new Map([...committed.data, ...board.data].map((r) => [r.prospect_key, r]));
  const events = [...commitsR.data, ...commitsT.data].filter((e) => e.period_id === cur.id);
  const recruiting = [];

  async function reasonsFor(r, tk, seed) {
    const out = [];
    const dealbreaker = r?.dealbreaker || "";
    const sState = TEAM_STATE[tName(tk)], home = r?.state;
    const nm = lastName(r?.name);
    // proximity
    if (home && sState) {
      const close = sState === home ? "same" : (NEIGHBORS[home] || []).includes(sState) ? "near" : "far";
      if (close !== "far") out.push({ k: "home", w: dealbreaker === "Proximity To Home" ? (close === "same" ? 10 : 8) : close === "same" ? 4 : 3,
        line: close === "same" ? `${nm} stays home in ${STATE_NAME[home] || home}, and ${pick(seed + "h", ["family was always going to be part of the decision", "he never seriously considered leaving the state", "his parents will be able to make every home game"])}.`
          : `${tName(tk)} is a short drive from ${r.hometown || "home"}, which mattered.`,
        quote: pick(seed + "hq", [`My mom gets to see me play every Saturday. That was huge for me.`, `I wanted to stay close to home. ${tName(tk)} just felt like family.`, `I'm representing ${r.hometown || "my city"}. Staying close was always the plan.`]) });
      else if (dealbreaker === "Proximity To Home") out.push({ k: "far", w: 3, line: `Interesting twist: ${nm} listed proximity to home as a dealbreaker and still chose a school ${pick(seed, ["across the country", "hundreds of miles away", "far from home"])}.`, quote: `It was hard to leave home, but this is about my future.` });
    }
    // playing time from depth chart
    const map = POS[r?.position];
    if (map) {
      const ros = await roster(tk);
      const at = ros.filter((p) => map[0].includes(p.position)).sort((a, b) => b.overall - a.overall);
      const keepers = at.filter((p) => p.class_year !== "SR");
      const starters = keepers.slice(0, map[1]);
      const leaving = at.slice(0, map[1]).filter((p) => p.class_year === "SR");
      const thin = keepers.length <= map[1] || (starters.length && starters[starters.length - 1].overall < 76);
      if (thin || dealbreaker === "Playing Time") out.push({ k: "time", w: dealbreaker === "Playing Time" ? (thin ? 10 : 5) : 6,
        line: leaving.length ? `With ${leaving.map((p) => `${P(p.player_key, p.name)} (SR)`).join(" and ")} out of eligibility after this season, the ${POS_WORD[r.position]} room at ${tName(tk)} is wide open.`
          : thin ? `${tName(tk)} has just ${num(keepers.length)} returning ${POS_WORD[r.position]}${keepers.length === 1 ? "" : "s"} on the roster. The path to the field is short.` : `${tName(tk)} sold him on competing for a job right away.`,
        quote: pick(seed + "tq", [`I believe I can come in and start right away. That's what I wanted.`, `They told me the job is mine to win. I'm not waiting three years.`, `I looked at the depth chart. I see a chance to play early.`]) });
    }
    // pro potential
    if (map?.[2]) {
      const g = proPot.data.find((x) => x.position_group === map[2]); const row = g?.rows?.find((x) => x.team_key === tk);
      if (row && row.rank <= 15) { const p = row.picks || {}; const total = (p.round1 || 0) + (p.round2 || 0) + (p.round3 || 0) + (p.round4_7 || 0);
        out.push({ k: "pro", w: dealbreaker === "Pro Potential" ? 10 : 4, line: `${tName(tk)} ranks ${ord(row.rank)} nationally in pro potential at ${map[2]}${total ? `, with ${num(total)} draft pick${total === 1 ? "" : "s"} at the position in four years` : ""}${p.round1 ? `, ${num(p.round1)} in the first round` : ""}.`,
          quote: pick(seed + "pq", [`I want to play on Sundays. They put guys in the league.`, `They showed me the draft board. That's where I'm going.`, `The NFL is the goal, and ${tName(tk)} develops ${map[2] === "DB" ? "DBs" : POS_WORD[r.position] + "s"} better than anybody.`]) }); }
    }
    // playing style fit
    if (map?.[3] && r?.archetype) {
      const key = `${map[3]} - ${r.archetype}`; const g = style.data.find((x) => (x.archetypes || []).includes(key)); const row = g?.rows?.find((x) => x.team_key === tk);
      if (row && row.rank <= 20) out.push({ k: "style", w: dealbreaker === "Playing Style" ? 10 : 3, line: `The scheme fits: ${tName(tk)} ranks ${ord(row.rank)} in ${String(g.stat).toLowerCase()}${row.stat_value != null ? ` (${row.stat_value})` : ""}, exactly what a ${r.archetype.toLowerCase()} wants to hear.`,
        quote: `The way they ${/pass/i.test(g.stat) ? "throw it around" : /rush/i.test(g.stat) ? "run the ball" : "use guys like me"}, I fit perfect.` });
    }
    // school grades tied to a dealbreaker
    for (const [db, gname, phr] of [["Championship Contender", "Championship Contender", "a shot at a title"], ["Brand Exposure", "Brand Exposure", "the national spotlight"], ["Coach Prestige", "Coach Prestige", "the coaching staff"], ["Conference Prestige", "Conference Prestige", "playing in a power conference"]]) {
      const gr = gradeOf(gname, tk);
      if (gr && goodLetter(gr.letter) && (dealbreaker === db || gr.rank <= 10)) out.push({ k: "grade:" + db, w: dealbreaker === db ? 9 : 2,
        line: `${tName(tk)} grades out ${/^A/.test(gr.letter) ? "an" : "a"} ${gr.letter} in ${gname.toLowerCase()}, and ${nm} wanted ${phr}.`,
        quote: pick(seed + db, db === "Championship Contender" ? [`I want rings. Simple as that.`, `I'm trying to win a natty. They're built for it.`] : db === "Brand Exposure" ? [`Every week we're on TV. That matters for my brand.`, `Big stage, big brand. I want the lights.`] : db === "Coach Prestige" ? [`You trust the guys who've done it. This staff has done it.`, `${coachSays(tk) || "The head coach"} was real with me from day one.`] : [`I want to play the best every week.`]) });
    }
    // momentum from a recent big result
    const lg = lastGame(tk);
    if (lg) { const me = lg.home.team_key === tk ? lg.home : lg.away, o = me === lg.home ? lg.away : lg.home;
      if (me.score > o.score && ((o.rank_at_game > 0 && o.rank_at_game <= 25) || rivalOf.get(nk(me.team) + "|" + nk(o.team)) || me.score - o.score >= 28))
        out.push({ k: "win", w: 5, line: `The timing helped: ${tName(tk)} is coming off ${o.rank_at_game > 0 && o.rank_at_game <= 25 ? `a win over No. ${o.rank_at_game} ${T(o.team_key, o.team)}` : `a ${me.score}-${o.score} ${rivalOf.get(nk(me.team) + "|" + nk(o.team)) ? "rivalry " : ""}win over ${T(o.team_key, o.team)}`}.`,
          quote: pick(seed + "wq", [`Watching that ${o.team} game sealed it for me.`, `That win over ${o.team}? I was in the stands. That's when I knew.`, `They beat ${o.team} and I texted the coach right after. I was ready.`]) }); }
    // winning culture
    if (ranked(tk) && winPct(tk) >= 0.75) out.push({ k: "winning", w: 3, line: `${tName(tk)} is ${recOf(tk)} and ranked No. ${ranked(tk)}. Winning recruits itself.`, quote: `They win. I want to win. Easy.` });
    // NIL
    const nr = nilRank.get(tk);
    if (nr && nr <= 15 && r?.desired_nil) out.push({ k: "nil", w: r.desired_nil >= 250 ? 5 : 2, line: `Money talks: ${tName(tk)} ranks ${ord(nr)} in NIL spending, and ${nm}'s asking price was a reported $${money(r.desired_nil)}.`, quote: pick(seed + "nq", [`I'm taking care of my family. They understood that.`, `It's a business too. They made it make sense.`]) });
    // league coach relationship
    if (userTeams.has(tk)) out.push({ k: "coach", w: 3, line: `${coachTok(tk)} closed this one personally.`, quote: `${coachSays(tk)} was in my living room. He wanted me more than anybody.` });
    return out.sort((a, b) => b.w - a.w);
  }

  for (const e of events) {
    const r = recruitInfo.get(e.prospect_key) || {};
    const toK = e.kind === "decommit" ? null : keyOfSchool(e.school), fromK = keyOfSchool(e.previous_school || (e.kind === "decommit" ? e.school : null));
    const sw = STARS[e.stars] || "", pos = e.position, nm = e.name, seed = `${e.prospect_key}${e.kind}`;
    const rT = R(e.prospect_key, nm), elite = e.stars >= 5 || e.national_rank <= 25, notable = elite || e.stars >= 4 || userTeams.has(toK) || userTeams.has(fromK);
    if (!notable) continue;
    const others = (r.top_schools || []).filter((s) => s.team_id !== e.school?.team_id && s.influence > 0).slice(0, 2);
    const othersTok = others.map((s) => { const k = keyOfSchool(s); return k ? T(k, s.name) : s.name; });
    const top = r.top_schools || [], lead = top[0], second = top[1];
    const margin = lead && second ? (lead.influence - second.influence) / Math.max(lead.influence, 1) : 1;
    const rank = e.national_rank ? `No. ${e.national_rank} overall` : `${sw} ${pos}`;
    let kick, h, d, quote = null, score = (6 - e.stars) * -10 + 60 - Math.min(e.national_rank || 999, 300) / 10 + (userTeams.has(toK) || userTeams.has(fromK) ? 25 : 0);
    const reasons = toK ? await reasonsFor({ ...r, name: nm, position: pos }, toK, seed) : [];
    const main = reasons[0], second2 = reasons.find((x) => x !== main && x.k !== main?.k);

    if (e.kind === "commit" && !fromK) {
      kick = elite ? "Big get" : userTeams.has(toK) ? "Recruiting win" : "Commitment";
      h = pick(seed, [
        `${T(toK, e.school.name)} lands ${sw} ${pos} ${rT}`,
        ...(othersTok.length ? [`${rT} picks ${T(toK, e.school.name)} over ${list(othersTok)}`] : []),
        ...(main?.k === "home" ? [`${cap(sw)} ${pos} ${rT} stays home, commits to ${T(toK, e.school.name)}`] : []),
        ...(margin < 0.15 && othersTok.length ? [`${T(toK, e.school.name)} wins the tug-of-war for ${sw} ${pos} ${rT}`] : []),
        ...(margin > 0.6 && othersTok.length ? [`It was never close: ${rT} commits to ${T(toK, e.school.name)}`] : []),
        ...(elite ? [`${cap(rank)} ${rT} is headed to ${T(toK, e.school.name)}`] : []),
      ]);
      const battle = second && lead ? (margin < 0.15 ? `${e.school.name} edged ${second.name} at the wire, ${lead.influence} to ${second.influence} in influence.` : margin > 0.6 ? `${e.school.name} built a commanding lead, more than tripling ${second.name}'s influence.` : `${e.school.name} pulled away from ${second.name} down the stretch.`) : "";
      d = [main?.line, second2?.line, battle].filter(Boolean).slice(0, 2).join(" ");
      if (main?.quote) quote = { text: main.quote, by: `${nm}, ${sw} ${pos}` };
    } else if (e.kind === "commit" && fromK) {
      kick = "Flip"; score += 20;
      const fromRec = recOf(fromK), skid = streak(fromK);
      h = pick(seed, [`FLIP: ${rT} jumps from ${T(fromK, e.previous_school.name)} to ${T(toK, e.school.name)}`, `${T(toK, e.school.name)} steals ${sw} ${pos} ${rT} away from ${T(fromK, e.previous_school.name)}`, `${rT} has a change of heart, flips to ${T(toK, e.school.name)}`]);
      const why = skid.kind === "L" && skid.n >= 2 ? `${e.previous_school.name} has dropped ${num(skid.n)} straight and sits at ${fromRec}. The phone started ringing.` : winPct(fromK) < 0.5 ? `A ${fromRec} start at ${e.previous_school.name} opened the door.` : `${e.school.name} never stopped recruiting him.`;
      d = [why, main?.line].filter(Boolean).join(" ");
      quote = { text: pick(seed + "fq", [`I prayed on it. ${e.school.name} is home.`, `It wasn't personal. I had to do what's best for me.`, main?.quote || `This is where I'm supposed to be.`]), by: `${nm}, ${sw} ${pos}` };
      if (userTeams.has(fromK)) d += ` ${coachTok(fromK)} will feel this one.`;
    } else if (e.kind === "decommit") {
      kick = "Decommit"; score += 10;
      const skid = fromK ? streak(fromK) : { n: 0 };
      h = pick(seed, [`${rT} reopens his recruitment, backs off ${fromK ? tTok(fromK) : "his pledge"}`, `Blow to ${fromK ? tTok(fromK) : "his school"}: ${sw} ${pos} ${rT} decommits`]);
      d = fromK && skid.kind === "L" && skid.n >= 2 ? `The losing streak (${num(skid.n)} straight) didn't help.` : `Sources say other programs have been in his ear for weeks.`;
      quote = { text: pick(seed + "dq", [`I just want to make sure I get this right.`, `Nothing's off the table. I'm open again.`]), by: `${nm}, ${sw} ${pos}` };
    } else if (e.kind === "sign") {
      kick = "Signed"; score -= 10;
      h = pick(seed, [`It's official: ${rT} signs with ${T(toK, e.school.name)}`, `${T(toK, e.school.name)} seals the deal with ${sw} ${pos} ${rT}`]);
      d = main?.line || `Ink is dry.`;
    } else continue;
    if (e.transfer) { kick = "Portal"; h = h.replace(/stays home, commits to/, "transfers to"); }
    recruiting.push({ id: seed, cat: "recruiting", kind: e.kind, kick, h, d, quote, score, team: toK ?? fromK, recruit: e.prospect_key, user: userTeams.has(toK) || userTeams.has(fromK) });
  }

  // hottest uncommitted battles among top prospects
  const battles = board.data.filter((r) => (r.top_schools || []).length >= 2 && r.top_schools[1].influence > 0 && r.stars >= 4)
    .map((r) => ({ r, m: (r.top_schools[0].influence - r.top_schools[1].influence) / Math.max(r.top_schools[0].influence, 1) }))
    .filter((x) => x.m < 0.12).sort((a, b) => a.r.national_rank - b.r.national_rank).slice(0, 6);
  for (const { r } of battles) {
    const [a, b, c] = r.top_schools, ak = keyOfSchool(a), bk = keyOfSchool(b), seed = r.prospect_key + "battle";
    const fav = r.dealbreaker ? await (async () => { const [ra, rb] = await Promise.all([reasonsFor(r, ak, seed + "a"), reasonsFor(r, bk, seed + "b")]); const sa = ra.filter((x) => x.w >= 8).reduce((t, x) => t + x.w, 0), sb = rb.filter((x) => x.w >= 8).reduce((t, x) => t + x.w, 0); return sa === sb ? null : sa > sb ? { k: ak, why: ra[0] } : { k: bk, why: rb[0] }; })() : null;
    recruiting.push({ id: seed, cat: "recruiting", kind: "battle", kick: "Battle", score: 70 - r.national_rank / 5 + ((userTeams.has(ak) || userTeams.has(bk)) ? 25 : 0),
      h: pick(seed, [`${ak ? T(ak, a.name) : a.name} vs. ${bk ? T(bk, b.name) : b.name}: the fight for ${STARS[r.stars]} ${r.position} ${R(r.prospect_key, r.name)} goes down to the wire`, `Neck and neck: ${a.name} and ${b.name} are separated by ${a.influence - b.influence} points for ${R(r.prospect_key, r.name)}`]),
      d: `${a.name} leads ${a.influence} to ${b.influence}${c?.influence ? `, with ${c.name} lurking at ${c.influence}` : ""}. His dealbreaker is ${String(r.dealbreaker || "undisclosed").toLowerCase()}${fav ? `, which could tip it toward ${T(fav.k, tName(fav.k))}. ${fav.why.line}` : "."} ${pick(seed + "close", ["Official visits could decide this one.", "Expect both staffs to empty the playbook this week.", "One more strong week could end it.", `${b.name} isn't going quietly.`, "Somebody's heart is getting broken on signing day."])}`,
      recruit: r.prospect_key, team: ak, user: userTeams.has(ak) || userTeams.has(bk) });
  }

  /* ===================== PORTAL WATCH (in-season speculation) ===================== */
  // Rosters don't carry a dealbreaker for current players, so "fit" is judged from data:
  // scheme vs. archetype, depth chart, NIL pay vs. market, rating jumps, team record, stats.
  const portal = [];
  const allRos = (await api("/rosters?scope=all").catch(() => ({ data: [] }))).data || [];
  // Draft inputs: keep every Pro Potential read (draft picks per school, per position group, by round band) and the
  // last in-season roster of each year, so the offseason draft can diff them.
  try {
    const pp = await api("/school-grades/pro-potential");
    const ppDir = `data/draft/${LID}/pro-potential`, f = `${ppDir}/${pp.period?.id ?? "x"}.json`;
    if (!(await readJson(f))) { await mkdir(ppDir, { recursive: true }); await writeFile(f, JSON.stringify({ period: pp.period, data: pp.data })); log(`Draft: saved Pro Potential read ${pp.period?.season_text}`); }
  } catch (e) { log(`Draft: Pro Potential read failed: ${e.message}`); }
  const statsFile = await readJson("data/player-stats-all.json", { data: [], stat_keys: [] });
  const statOf = new Map(statsFile.data.map((x) => [x.player_key, x.stats || {}]));
  // weekly overall snapshots (every FBS player) to spot rating jumps between advances
  const snaps = (prevIdx.snaps || []).filter((id) => id !== cur.id);
  const prevSnapId = snaps.sort((a, b) => b - a)[0];
  const prevSnap = prevSnapId ? await readJson(`${DIR}/ovr-${prevSnapId}.json`, {}) : {};
  // NIL per player each period ([team, nil]) so offseason stages can be compared stage to stage (retention raises, portal paydays).
  if (allRos.length) await writeFile(`${DIR}/nil-${cur.id}.json`, JSON.stringify(Object.fromEntries(allRos.map((x) => [x.player_key, [x.team_key, x.nil_compensation ?? 0]]))));
  if (allRos.length && process.env.FORCE) { const f = {}; for (const x of allRos) for (const [k, v] of Object.entries(x)) if (k !== "ratings" && !(k in f) && v != null && v !== false && v !== "") f[k] = JSON.stringify(v).slice(0, 80); console.log("Roster fields:", JSON.stringify(f)); }
  if (allRos.length) await writeFile(`${DIR}/ovr-${cur.id}.json`, JSON.stringify(Object.fromEntries(allRos.map((x) => [x.player_key, x.overall]))));
  const snapIds = allRos.length ? [...snaps, cur.id].sort((a, b) => a - b).slice(-40) : snaps;
  // league teams also have week-by-week overall history right now
  const seasonStart = new Map();
  for (const tk of userTeams) {
    const sk = await api(`/rosters/skills?team=${tk}`).catch(() => ({ data: [] }));
    for (const x of sk.data || []) { const h = (x.history || []).filter((e) => e.overall != null); if (h.length > 1) seasonStart.set(x.player_key, { ovr: h[0].overall, when: h[0].season_text }); }
  }
  // NIL market: what players at the same position and rating are paid across FBS
  const byPos = new Map(); for (const x of allRos) { if (x.nil_compensation == null) continue; (byPos.get(x.position) || byPos.set(x.position, []).get(x.position)).push(x); }
  const market = (x) => { const pool = (byPos.get(x.position) || []).filter((y) => Math.abs(y.overall - x.overall) <= 2).map((y) => y.nil_compensation).sort((a, b) => a - b); return pool.length >= 5 ? pool[Math.floor(pool.length / 2)] : null; };
  const STARTERS = { QB: 1, HB: 1, FB: 1, WR: 3, TE: 1, LT: 1, RT: 1, LG: 1, RG: 1, C: 1, LEDG: 1, REDG: 1, DT: 2, SAM: 1, WILL: 1, MIKE: 1, CB: 2, FS: 1, SS: 1, K: 1, P: 1 };
  const depth = new Map(); for (const x of allRos) { const k = `${x.team_key}|${x.position}`; (depth.get(k) || depth.set(k, []).get(k)).push(x); }
  for (const v of depth.values()) v.sort((a, b) => b.overall - a.overall);
  const teamGames = (tk) => playedGames.filter((g) => g.home.team_key === tk || g.away.team_key === tk).length;
  const styleRank = (x) => { const lab = POS[x.position]?.[3]; if (!lab || !x.archetype) return null; const g = style.data.find((y) => (y.archetypes || []).includes(`${lab} - ${x.archetype}`)); const row = g?.rows?.find((y) => y.team_key === x.team_key); return row ? { rank: row.rank, of: g.rows.length, stat: g.stat } : null; };
  const yr = { FR: "freshman", SO: "sophomore", JR: "junior", SR: "senior" };
  for (const x of allRos) {
    if (x.class_year === "SR" || !x.team_key) continue;
    const tk = x.team_key, PT = P(x.player_key, x.name), TT = tTok(tk), seed = x.player_key + "pw", st = statOf.get(x.player_key) || {};
    const pos = POS_WORD[x.position] || x.position, mkt = market(x), nil = x.nil_compensation ?? 0, gp = teamGames(tk);
    const ov = `${an(x.overall)} ${x.overall}-overall`, archPos = x.archetype ? `${x.archetype.toLowerCase()} ${({ LEDG: "edge", REDG: "edge", HB: "back", FB: "fullback", WR: "receiver", TE: "tight end", CB: "corner", FS: "safety", SS: "safety", MIKE: "linebacker", WILL: "linebacker", SAM: "linebacker" })[x.position] || x.position}` : pos, pay = nil ? `making ${money(nil)}` : "making nothing in NIL";
    const rank = (depth.get(`${tk}|${x.position}`) || []).findIndex((y) => y.player_key === x.player_key) + 1, starter = rank > 0 && rank <= (STARTERS[x.position] || 1);
    const boost = (userTeams.has(tk) ? 25 : 0) + (ranked(tk) ? 5 : 0) + (x.overall - 80);
    const nilR = nilRank.get(tk) || 99;
    const afford = nilR > 60 ? `${tName(tk)} ranks ${ord(nilR)} in NIL spending, and bidding wars aren't its game.` : nilR <= 15 ? `${tName(tk)} has deep NIL pockets (${ord(nilR)} nationally), which helps.` : "";
    const add = (o) => portal.push({ id: `${x.player_key}:${o.kind}`, cat: "portal", player: x.player_key, team: tk, user: userTeams.has(tk), ...o });
    // 1) rating jump: price tag rising
    const prev = prevSnap[x.player_key], start = seasonStart.get(x.player_key);
    const jump = prev != null ? { d: x.overall - prev, when: "last week" } : start ? { d: x.overall - start.ovr, when: start.when } : null;
    if (jump && jump.d >= 3 && x.overall >= 75) add({ kind: "breakout", kick: "Price tag rising", score: 50 + jump.d * 6 + boost,
      h: mkt && nil < mkt * 0.75 ? pick(seed + "b", [`${PT} is up to ${x.overall} overall. Can ${TT} still afford him next year?`, `${PT}'s stock is soaring, and so is his price: will ${TT} pay up?`]) : `${PT} jumps to ${x.overall} overall, and ${TT} has a raise to budget for`,
      d: `The ${yr[x.class_year] || ""} ${pos} is up ${jump.d} point${jump.d === 1 ? "" : "s"} since ${jump.when}${x.dev_trait && x.dev_trait !== "Normal" ? ` (${x.dev_trait} dev)` : ""}. He's ${nil ? `earning ${money(nil)} in NIL` : "earning nothing in NIL"}${mkt ? `; ${pos}s rated around ${x.overall} draw a median of ${money(mkt)} across FBS` : ""}. ${afford || pick(seed + "b2", ["Expect collectives around the country to take notice.", "Keeping him could get expensive."])}` });
    // 2) underpaid star
    else if (mkt && x.overall >= 84 && nil <= mkt * 0.5 && mkt - nil >= 40) add({ kind: "underpaid", kick: "Underpaid", score: 40 + (mkt - nil) / 4 + boost,
      h: ([`${PT} is one of the best bargains in college football. How long can ${TT} keep it that way?`, `Rival collectives are circling ${TT}'s ${PT}`, `${PT} is playing like a star and getting paid like a backup`, `Somebody is going to back up the truck for ${PT}. Will it be ${TT}?`]),
      d: `${cap(ov)} ${pos} ${pay}, while players at his position and rating command around ${money(mkt)}. ${afford || "That gap tends to close in the portal."}` });
    // 3) scheme mismatch
    const sr = styleRank(x);
    if (sr && x.overall >= 80 && sr.rank > sr.of * 0.75 && starter && !["K", "P"].includes(x.position)) add({ kind: "fit", kick: "Bad fit?", score: 35 + (sr.rank / sr.of) * 20 + boost,
      h: ([`${cap(an(archPos))} ${archPos} in the wrong system? ${PT} could be a portal name to watch`, `${PT} and ${TT}'s scheme aren't a match. Will he look elsewhere this offseason?`]),
      d: `${tName(tk)} ranks ${ord(sr.rank)} of ${sr.of} in ${String(sr.stat).toLowerCase()}, not where ${ov} ${archPos} wants to be. Players with that kind of mismatch often test the market.` });
    // 4) buried on the depth chart
    const downs = st.genDownsPlayed || 0;
    if (x.overall >= 80 && !starter && gp >= 3 && downs / gp < 15 && x.class_year !== "FR") add({ kind: "buried", kick: "Buried", score: 30 + (x.overall - 80) * 3 + boost,
      h: ([`${PT} is too good to sit. Is a transfer coming?`, `Stuck at No. ${rank} on the ${tName(tk)} depth chart, ${PT} might not wait around`]),
      d: `${cap(ov)} ${yr[x.class_year]} ${pos} with ${downs} snaps in ${gp} games. Someone in the portal market would start him tomorrow.` });
    // 5) struggling star
    let bad = null;
    if (starter && x.overall >= 85 && (st.gamesPlayed || 0) >= 3) {
      // QB: needs a genuinely poor line. A 42-8 season with a few picks is not "under fire".
      const tdInt = st.passINT ? st.passTD / st.passINT : st.passTD;
      if (x.position === "QB" && st.passAttempts >= 60 && ((st.passerRating < 115 && tdInt < 2.5) || st.passINT > st.passTD || (st.passINT >= 10 && tdInt < 1.5))) bad = `${st.passCompletion}-of-${st.passAttempts}, ${st.passYards} yards, ${st.passTD} TD, ${st.passINT} INT (${st.passerRating?.toFixed?.(1) ?? st.passerRating} rating)`;
      if (x.position === "HB" && st.rushAttempts >= 40 && st.rushYards / st.rushAttempts < 4) bad = `${st.rushAttempts} carries for ${st.rushYards} yards (${(st.rushYards / st.rushAttempts).toFixed(1)} a carry)`;
      if (x.position === "WR" && (st.receivingYards || 0) / st.gamesPlayed < 35) bad = `${st.receiveReceptions || 0} catches for ${st.receivingYards || 0} yards in ${st.gamesPlayed} games`;
      if (x.position === "K" && st.kickFieldGoalAttempts >= 5 && st.kickFieldGoalsMade / st.kickFieldGoalAttempts < 0.65) bad = `${st.kickFieldGoalsMade}-of-${st.kickFieldGoalAttempts} on field goals`;
    }
    // winning teams don't put their stars on blast: skip top-10 / 75%+ teams unless the numbers are truly ugly
    if (bad && (winPct(tk) >= 0.75 || (ranked(tk) && ranked(tk) <= 10)) && !(x.position === "QB" && st.passerRating < 100)) bad = null;
    const offSzn = /OFF/i.test(cur?.season_text || "");
    if (bad) add({ kind: "struggling", kick: "Under fire", score: 45 + (x.overall - 85) * 3 + boost,
      h: ([`Is ${TT} ready to go a different direction than ${PT}?`, `${PT} was supposed to be a star. The numbers say otherwise`, `Ratings say ${x.overall}. The stat sheet says something else for ${PT}`]),
      d: `${bad}. For ${ov} ${pos}${ranked(tk) ? ` on a ranked team` : ""}, that won't cut it. ${pick(seed + "s2", offSzn ? ["The staff has a big decision to make before next season.", "Don't be surprised if the coaches shop the portal at his position.", "He'll have to win the job back in camp."] : ["The staff will have a big decision this offseason.", "Don't be surprised if the coaches shop the portal at his position.", "One more rough month and the whispers get louder."])}` });
    // 6) star on a sinking ship
    if (x.overall >= 88 && ["SO", "JR"].includes(x.class_year) && gp >= 3 && winPct(tk) <= 0.35) add({ kind: "sinking", kick: "Sinking ship", score: 40 + (x.overall - 88) * 4 + boost,
      h: ([`${PT} deserves better than ${recOf(tk)}. Contenders will be calling`, `Wasted on ${an(recOf(tk))} ${recOf(tk)} team? ${PT} would be the portal's top prize`]),
      d: `${cap(ov)} ${yr[x.class_year]} ${pos} stuck on ${an(tName(tk))} ${tName(tk)} team that's ${recOf(tk)}. ${pick(seed + "k2", ["Every contender in the country knows his name.", "If he hits the portal, it'll be the story of the offseason."])}` });
  }
  const pCaps = { breakout: 5, underpaid: 4, fit: 3, buried: 3, struggling: 4, sinking: 3 }, pUsed = {}, pSeen = new Set(), pRot = {};
  const portalStories = portal.sort((a, b) => b.score - a.score).filter((s) => { if (pSeen.has(s.player)) return false; pUsed[s.kind] = (pUsed[s.kind] || 0) + 1; if (pUsed[s.kind] > (pCaps[s.kind] || 3)) return false; pSeen.add(s.player); return true; })
    .slice(0, 18).map((s, i) => { const v = Array.isArray(s.h) ? s.h[(pRot[s.kind] = (pRot[s.kind] ?? hash(s.player) % s.h.length) + 1) % s.h.length] : s.h; return { ...s, h: capH(v.replace(/\.(\]\])?\./g, ".$1")) }; });

  /* ===================== RETENTION: once the portal opens, who Portal Watch flagged and whether he stayed ===================== */
  // The game's "players leaving" persuasion odds aren't in the API, so the flight-risk read is TD Wire's own:
  // how many weeks he sat on Portal Watch and why (buried, underpaid, sinking ship …), plus any NIL raise since
  // the season ended. Flagged + still on the roster once the portal is open = he was kept. Flagged + in the portal = gone.
  const retention = [];
  if (/OFF/i.test(cur.season_text || "") && allRos.length) try {
    const tp = (await api("/recruits?type=transfers").catch(() => ({ data: [] }))).data || [];
    const inPortal = new Set(tp.filter((r) => r.transfer_from?.name).map((r) => `${nk(r.first_name)}${nk(r.last_name)}|${r.position}|${nk(r.transfer_from.name)}`));
    const arc = await readJson(`${DIR}/news-${cur.season}.json`, { stories: [] });
    const flags = new Map();
    for (const st of arc.stories) {
      if (st.cat !== "portal" || !st.player || !["breakout", "underpaid", "fit", "buried", "sinking", "struggling"].includes(st.kind)) continue;
      const f = flags.get(st.player) || flags.set(st.player, { kinds: new Set(), periods: new Set(), team: st.team }).get(st.player);
      f.kinds.add(st.kind); f.periods.add(st.first_period ?? st.period); f.team ??= st.team;
    }
    const endRos = ((await readJson(`data/draft/${LID}/roster-${cur.season}.json`, null)) ?? (await readJson(`data/draft/${LID}/roster-${cur.season - 1}.json`, {})))?.p || {}; // offseason: the roster was saved under last season
    const now = new Map(allRos.map((x) => [x.player_key, x]));
    const W = { underpaid: 3, sinking: 3, buried: 3, fit: 2, breakout: 2, struggling: 1 };
    const WHY = { underpaid: "underpaid for his rating", sinking: "stuck on a losing team", buried: "buried on the depth chart", fit: "a bad fit for the scheme", breakout: "about to get expensive after a rating jump", struggling: "under fire for his numbers" };
    const portalOpen = tp.some((r) => r.transfer_from?.name);
    if (portalOpen) for (const [pk, f] of flags) {
      const was = endRos[pk], x = now.get(+pk), tk = x?.team_key ?? was?.[0] ?? f.team; if (!tk) continue;
      const first = x?.first_name ? `${nk(x.first_name)}${nk(x.last_name)}` : null;
      const name = x?.name || was?.[5] || "", pos = x?.position || was?.[3] || "";
      // roster names look like "T.St. Clair"; portal rows carry first + last name
      const ini = nk(name.split(".")[0]).slice(0, 1), last = nk(name.slice(name.indexOf(".") + 1));
      const gone = (first && inPortal.has(`${first}|${pos}|${nk(tName(tk))}`)) || (!!last && [...inPortal].some((k) => { const [nm, ps, sc] = k.split("|"); return ps === pos && sc === nk(tName(tk)) && nm.endsWith(last) && nm.startsWith(ini); }));
      if (!x && !gone) continue; // graduated, drafted or otherwise off the books
      if (x && x.team_key !== tk) continue;
      const kinds = [...f.kinds].sort((a, b) => W[b] - W[a]), weeks = f.periods.size;
      const risk = W[kinds[0]] + Math.min(weeks, 6) * 0.5 + (kinds.length > 1 ? 1 : 0); // ~2 … 7.5
      const level = risk >= 5 ? "high" : risk >= 3.5 ? "medium" : "low";
      const nilWas = was?.[2] ?? null, nilNow = x?.nil_compensation ?? null, raise = nilWas != null && nilNow != null && nilNow - nilWas >= 25 ? nilNow - nilWas : 0;
      const PT = P(pk, name), TT = tTok(tk), user = userTeams.has(tk), seed = pk + "ret" + cur.season, why = kinds.slice(0, 2).map((k) => WHY[k]).join(" and ");
      const wk = `${weeks} week${weeks === 1 ? "" : "s"}`;
      if (!gone) retention.push({ id: `${pk}:stayed:${cur.season}`, cat: "portal", kind: "stayed", player: +pk, team: tk, user, risk: level,
        kick: level === "high" ? "Against the odds" : "Staying put", score: 60 + risk * 8 + (user ? 30 : 0) + (raise ? 10 : 0),
        h: capH(level === "high" ? pick(seed, [`Against the odds, ${TT} keeps ${PT}`, `${PT} was a flight risk. ${TT} talked him into staying`, `Nobody gave ${TT} much of a chance to keep ${PT}. He's staying`])
          : pick(seed, [`${PT} is staying at ${TT}`, `${TT} keeps ${PT} out of the portal`, `Portal Watch had ${PT} on the list. He isn't going anywhere`])),
        d: `${PT} spent ${wk} on TD Wire's Portal Watch, ${why}${level === "high" ? ", and our read had him as one of the likelier names to leave" : ""}. The portal is open and he's still on the ${TT} roster.${raise ? ` The money helped: his NIL went from ${money(nilWas)} to ${money(nilNow)}.` : ""}`,
        quote: { text: pick(seed + "q", level === "high" ? ["Honestly, I thought he was gone. The staff went to work on him.", "That one was closer than people think.", "They had to sell him on the plan, and they did."] : ["He likes it there. It was never as close as the outside noise made it.", "The staff kept him in the loop the whole way.", "He wants to finish what he started."]), by: user ? `a source close to ${tName(tk)}` : "a source familiar with the decision" } });
      else retention.push({ id: `${pk}:gone:${cur.season}`, cat: "portal", kind: "gone", player: +pk, team: tk, user, risk: level, kick: "Portal Watch called it",
        score: 55 + risk * 6 + (user ? 30 : 0),
        h: capH(pick(seed, [`${PT} hits the portal, and Portal Watch saw it coming`, `${TT} couldn't keep ${PT}: he's in the transfer portal`, `${PT} is officially in the portal after ${wk} on the watch list`])),
        d: `TD Wire flagged ${PT} for ${wk}, ${why}. He's now in the transfer portal, leaving a hole at ${TT}.` });
    }
    // league teams: one story on who walked out the door, flagged or not
    for (const tk of userTeams) {
      const out_ = tp.filter((r) => r.transfer_from?.name && nk(r.transfer_from.name) === nk(tName(tk))).sort((a, b) => (b.stars - a.stars) || ((a.national_rank || 9999) - (b.national_rank || 9999)));
      if (!out_.length) continue;
      const big = out_.filter((r) => r.stars >= 4), coachN = members.data.find((m) => m.team_key === tk)?.user_name || "", TT = tTok(tk), seed = tk + "exodus" + cur.season;
      const nm = (r) => `${r.stars}-star ${POS_WORD[r.position] || r.position} ${[r.first_name, r.last_name].filter(Boolean).join(" ")}`;
      const lead = out_.slice(0, 3).map(nm);
      retention.push({ id: `${tk}:exodus:${cur.season}`, cat: "portal", kind: "gone", team: tk, user: true, risk: out_.length >= 10 ? "high" : "medium",
        kick: out_.length >= 10 ? "Portal exodus" : "Portal departures", score: 120 + out_.length * 2 + big.length * 4,
        h: capH(out_.length >= 10 ? pick(seed, [`${out_.length} players are out the door at ${TT}`, `Portal exodus: ${TT} loses ${out_.length} players, ${big.length} of them four-stars or better`]) : pick(seed, [`${TT} loses ${out_.length} to the portal, led by ${lead[0]}`, `The portal hits ${TT}: ${out_.length} gone`])),
        d: `${lead.join(", ")}${out_.length > 3 ? ` and ${out_.length - 3} more` : ""} entered the transfer portal from ${TT}.${big.length ? ` That's ${big.length} four- or five-star players${coachN ? ` ${coachN} has to replace` : " to replace"}.` : ""}` });
    }
    retention.sort((a, b) => b.score - a.score);
    const keep = [...retention.filter((s) => s.kind === "stayed").slice(0, 10), ...retention.filter((s) => s.kind === "gone").slice(0, 6 + userTeams.size)];
    const kp = new Set(keep.map((s) => s.player).filter(Boolean));
    for (let i = portalStories.length - 1; i >= 0; i--) if (kp.has(portalStories[i].player)) portalStories.splice(i, 1); // the retention story replaces his watch entry
    portalStories.unshift(...keep);
    if (keep.length) log(`Retention: ${keep.filter((s) => s.kind === "stayed").length} kept, ${keep.filter((s) => s.kind === "gone").length} gone (of ${flags.size} flagged).`);
  } catch (e) { log(`Retention stories skipped: ${e.message}`); }

  /* ===================== POSITION MOVES: good players switching spots this offseason ===================== */
  // Compared with the end-of-season roster the draft desk saves. Same-family swaps (OL to OL, DT to edge,
  // FS to SS, LB to LB, HB to FB) aren't news; real moves are, especially when the new spot gets him on the field.
  if (/OFF/i.test(cur.season_text || "") && allRos.length) try {
    const endRos = ((await readJson(`data/draft/${LID}/roster-${cur.season}.json`, null)) ?? (await readJson(`data/draft/${LID}/roster-${cur.season - 1}.json`, {})))?.p || {}; // offseason: the roster was saved under last season
    const FAM = { LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL", DT: "DL", LEDG: "DL", REDG: "DL", MIKE: "LB", WILL: "LB", SAM: "LB", FS: "S", SS: "S", HB: "RB", FB: "RB", K: "ST", P: "ST" };
    const fam = (p) => FAM[p] || p;
    // depth rank by overall at a position on a team: then (season-end roster) and now (current roster)
    const rankThen = (tk, pos, pk, ovr) => 1 + Object.entries(endRos).filter(([k, r]) => r[0] === tk && r[3] === pos && k !== String(pk) && r[1] > ovr).length;
    const rankNow = (tk, pos, pk, ovr) => 1 + allRos.filter((r) => r.team_key === tk && r.position === pos && r.player_key !== pk && r.overall > ovr).length;
    const moves = [];
    for (const x of allRos) {
      const was = endRos[x.player_key]; if (!was || was[0] !== x.team_key) continue;
      const from = was[3], to = x.position; if (!from || from === to || fam(from) === fam(to)) continue;
      const user = userTeams.has(x.team_key), best = Math.max(x.overall, was[1] || 0); // a switch re-rates him, so judge by his better rating
      const r0 = rankThen(x.team_key, from, x.player_key, was[1]), r1 = rankNow(x.team_key, to, x.player_key, x.overall);
      const s0 = STARTERS[from] || 1, s1 = STARTERS[to] || 1, pt = r0 > s0 && r1 <= s1; // was a backup, now projects to start
      // league-team moves that get him on the field: any rating. Every other move: 85+ only, capped below.
      if (!(user && pt) && best < 85) continue;
      moves.push({ x, from, to, r0, r1, pt, user, score: x.overall + (user ? 25 : 0) + (pt ? 15 : 0) });
    }
    moves.sort((a, b) => b.score - a.score);
    const fieldMoves = moves.filter((m) => m.user && m.pt), bigMoves = moves.filter((m) => !(m.user && m.pt)).slice(0, 5);
    const posts = [...fieldMoves, ...bigMoves];
    const POSN = (p) => POS_WORD[p] || p, nth = (n) => `No. ${n}`;
    for (const m of posts) {
      const { x } = m, PT = P(x.player_key, x.name), TT = tTok(x.team_key), seed = x.player_key + "pos" + cur.season;
      const coachN = m.user ? members.data.find((q) => q.team_key === x.team_key)?.user_name : null;
      portalStories.push({ id: `${x.player_key}:position:${cur.season}`, cat: "portal", kind: "position", player: x.player_key, team: x.team_key, user: m.user,
        kick: m.pt ? "Path to the field" : "Position change", score: 90 + m.score,
        h: capH(m.pt ? pick(seed, [`${PT} moves from ${POSN(m.from)} to ${POSN(m.to)}, and it gets him on the field at ${TT}`, `Playing time play: ${TT} shifts ${PT} to ${POSN(m.to)}`, `Stuck at ${POSN(m.from)}, ${PT} gets a fresh start at ${POSN(m.to)}`])
          : pick(seed, [`${TT} moves ${x.overall}-rated ${PT} from ${POSN(m.from)} to ${POSN(m.to)}`, `${PT} is a ${POSN(m.to)} now at ${TT}`, `Position switch: ${PT} goes from ${POSN(m.from)} to ${POSN(m.to)}`])),
        d: `${PT} (${x.overall} OVR, ${x.class_year}) was ${nth(m.r0)} on the ${POSN(m.from)} depth chart at the end of the season. At ${POSN(m.to)} he ranks ${nth(m.r1)}${m.pt ? `, which puts him in line to start` : ""}.${coachN ? ` ${coachN}'s call, and it'll be one to watch in camp.` : ""}` });
    }
    if (moves.length) log(`Position moves: ${moves.length} notable (${moves.filter((m) => m.pt).length} for playing time), posted ${posts.length} (${fieldMoves.length} league playing-time, ${bigMoves.length} at 85+).`);
  } catch (e) { log(`Position-move stories skipped: ${e.message}`); }

  /* ===================== ENCOURAGED TRANSFERS: who a staff showed the door ===================== */
  // The API has no "encouraged" flag, so: keep a roster snapshot per offseason stage; players who vanish when the
  // league advances out of the Encourage Transfers stage (nsd/encourage stage, default OFF Stg 9) were pushed out.
  // Found departures are kept in encouraged-<season>.json so the stories stay up for the rest of the offseason.
  if (allRos.length) try {
    const ENC = +(process.env.ENCOURAGE_STAGE || 9), stg = (t) => +(/OFF\s*Stg\s*(\d+)/i.exec(t || "")?.[1] || 0);
    const snapF = `${DIR}/roster-snap.json`, prev = await readJson(snapF, null);
    const encSeason = prev && /OFF/i.test(prev.season_text || "") ? +(/^\d{4}/.exec(prev.season_text)?.[0] || cur.season) : cur.season;
    const encF = `${DIR}/encouraged-${/OFF/i.test(cur.season_text || "") ? cur.season : encSeason}.json`, enc = await readJson(encF, { list: [] });
    const offNow = /OFF/i.test(cur.season_text || "");
    // leaving the Encourage Transfers stage: the next stage, or straight into the new season's preseason
    if (prev && prev.period !== cur.id && stg(prev.season_text) === ENC && (stg(cur.season_text) > ENC || !offNow) && !enc.done) {
      const now = new Set(allRos.map((x) => x.player_key));
      for (const [pk, r] of Object.entries(prev.p)) {
        const [tk, ovr, pos, name, cls] = r;
        if (now.has(+pk) || ovr < (userTeams.has(tk) ? 55 : 80)) continue;
        if (!offNow && /SR/.test(cls || "")) continue; // rolled into a new season: seniors graduated, they weren't pushed out
        enc.list.push({ pk: +pk, tk, ovr, pos, name, cls, user: userTeams.has(tk) });
      }
      enc.done = true; enc.from = prev.season_text; enc.to = cur.season_text;
      await writeFile(encF, JSON.stringify(enc));
      log(`Encouraged transfers: ${enc.list.length} notable departures (${enc.list.filter((e) => e.user).length} league teams).`);
    }
    if ((!prev || prev.period !== cur.id) && (offNow || !prev || /OFF/i.test(prev.season_text || ""))) await writeFile(snapF, JSON.stringify({ period: cur.id, season_text: cur.season_text, p: Object.fromEntries(allRos.map((x) => [x.player_key, [x.team_key, x.overall, x.position, x.name, x.class_year]])) }));
    const encS = enc.list.sort((a, b) => (b.user - a.user) || (b.ovr - a.ovr)).slice(0, 8);
    for (const e of encS) {
      const PT = P(e.pk, e.name), TT = tTok(e.tk), seed = e.pk + "enc" + cur.season, posW = POS_WORD[e.pos] || e.pos;
      const coachN = e.user ? members.data.find((q) => q.team_key === e.tk)?.user_name : null;
      portalStories.push({ id: `${e.pk}:encouraged:${cur.season}`, cat: "portal", kind: "encouraged", player: e.pk, team: e.tk, user: e.user, kick: "Shown the door",
        score: 100 + e.ovr + (e.user ? 30 : 0),
        h: capH(pick(seed, [`${TT} shows ${PT} the door`, `${PT} is out at ${TT}, and it wasn't his call`, `${TT} encourages ${e.ovr}-rated ${posW} ${PT} to transfer`])),
        d: `${PT} (${e.ovr} OVR ${posW}, ${e.cls}) was told he could look elsewhere${coachN ? `, a call from ${coachN}'s staff` : ""}. ${e.ovr >= 80 ? "That's a lot of talent to let walk, and somebody will be glad to take him." : "A roster-spot move, and a fresh start for him."}`,
        quote: { text: pick(seed + "q", ["It's a business. The staff made it clear where he stood.", "He wanted to play, and that wasn't going to happen there.", "Nobody's bitter. It just wasn't a fit anymore."]), by: "a source close to the player" } });
    }
  } catch (e) { log(`Encouraged-transfer stories skipped: ${e.message}`); }

  /* ===================== OUTLOOK: crystal ball, CFP odds, offseason features ===================== */
  for (const x of allRos) { if (!rosterCache.has(x.team_key)) rosterCache.set(x.team_key, Promise.resolve(allRos.filter((y) => y.team_key === x.team_key))); }
  const outlook = await buildOutlook({ api, readJson, DIR, LID, cur, prevIdx, games, standings, teamStats, team, ts, userTeams, tName, tTok, keyOfSchool, reasonsFor, board, events,
    style, allRos, depth, STARTERS, POS, POS_WORD, nilRank, ranked, recOf, coachTok,
    h: { pick, hash, ord, T, P, R, capH, an, cap, num, money, list, STARS, lastName, STATE_NAME, TEAM_STATE } });
  if (process.env.OUTLOOK_TEST === "1") { await writeFile(`${DIR}/offseason-test.json`, JSON.stringify(outlook.offseason, null, 1)); outlook.offseason = prevIdx.offseason || null; }

  /* ===================== GAMES ===================== */
  const latestWeek = playedGames.length ? Math.max(...playedGames.map((g) => g.week)) : null;
  const wk = playedGames.filter((g) => g.week === latestWeek && g.has_box_score);
  const boxes = new Map((await pool(wk, 4, (g) => api(`/games/${g.key}`).then((r) => r.data).catch(() => null))).filter(Boolean).map((d) => [d.key, d.box_score]));
  const gamesOut = [];
  for (const g of wk) {
    const b = boxes.get(g.key); if (!b) continue;
    const [W, L] = g.home.score >= g.away.score ? [g.home, g.away] : [g.away, g.home];
    const WS = (W === g.home ? b.Home : b.Away).Stats || {}, LS = (L === g.home ? b.Home : b.Away).Stats || {};
    const WQ = (W === g.home ? b.Home : b.Away).Quarters || [], LQ = (L === g.home ? b.Home : b.Away).Quarters || [];
    const margin = W.score - L.score, sc = `${W.score}-${L.score}`, seed = String(g.key);
    const userGame = userTeams.has(W.team_key) || userTeams.has(L.team_key);
    const wr = W.rank_at_game > 0 && W.rank_at_game <= 25 ? W.rank_at_game : null, lr = L.rank_at_game > 0 && L.rank_at_game <= 25 ? L.rank_at_game : null;
    const WT = tTok(W.team_key), LT = tTok(L.team_key), GT = G(g.key, "Box score");
    const rival = rivalOf.get(nk(W.team) + "|" + nk(L.team));
    const base = (userGame ? 30 : 0) + (wr || lr ? 15 : 0) + (wr && lr ? 10 : 0);
    const add = (o) => gamesOut.push({ id: `${g.key}:${o.kind}`, cat: "game", game: g.key, week: g.week, team: o.team ?? W.team_key, user: userGame, ...o });
    const thru3 = (q) => q.slice(0, 3).reduce((a, b) => a + b, 0);
    const deficit3 = thru3(LQ) - thru3(WQ);
    const ot = (WQ[4] || 0) + (LQ[4] || 0) > 0 || (WQ.length > 4 && WQ.slice(0, 4).reduce((a, b) => a + b, 0) === LQ.slice(0, 4).reduce((a, b) => a + b, 0));
    const wSay = coachSays(W.team_key), lSay = coachSays(L.team_key);

    // headline result
    if (lr && (!wr || wr > lr)) add({ kind: "upset", kick: "Upset", score: base + 60 + Math.min(lr <= 10 ? 20 : 0, 20),
      h: pick(seed + "u", [`Stunner: ${wr ? `No. ${wr} ` : "Unranked "}${WT} topples No. ${lr} ${LT}, ${sc}`, `${WT} shocks No. ${lr} ${LT} ${sc}${userTeams.has(W.team_key) ? ` and ${coachTok(W.team_key)} has the whole league talking` : ""}`, `Chaos: No. ${lr} ${LT} goes down to ${WT}`]),
      d: `${W.team} ${WS.totalYardsGained >= LS.totalYardsGained ? `outgained ${L.team} ${WS.totalYardsGained} to ${LS.totalYardsGained}` : `won despite being outgained ${LS.totalYardsGained} to ${WS.totalYardsGained}`}${LS.turnovers >= 2 ? ` and forced ${num(LS.turnovers)} turnovers` : ""}. ${pick(seed + "u2", ["Expect a fall in the polls for " + L.team + ".", "The rankings committee will be busy this week.", "Somewhere a playoff bracket just broke."])}`,
      quote: wSay ? { text: pick(seed + "uq", ["Nobody gave us a chance. We heard it all week.", "We're not surprised. This locker room believed.", "Put some respect on it."]), by: wSay } : null });
    if (deficit3 >= 10) add({ kind: "comeback", kick: "Comeback", score: base + 55 + deficit3,
      h: pick(seed + "c", [`${WT} erases a ${deficit3}-point fourth-quarter deficit to stun ${LT}, ${sc}`, `Never in doubt? ${WT} storms back from ${deficit3} down in the 4th to beat ${LT}`]),
      d: `${W.team} trailed ${thru3(LQ)}-${thru3(WQ)} after three quarters, then won the fourth ${WQ[3] || 0}-${LQ[3] || 0}${ot ? " and finished it in overtime" : ""}. ${L.team} will be replaying that final quarter for a while.`,
      quote: wSay ? { text: pick(seed + "cq", ["I told them at the end of the third: 15 minutes, all gas.", "That's who we are. We don't flinch."]), by: wSay } : lSay ? { text: `We let one get away. That's on me.`, by: lSay } : null });
    if (ot && deficit3 < 10) add({ kind: "ot", kick: "Overtime", score: base + 45, h: `${WT} outlasts ${LT} in overtime, ${sc}`, d: `Regulation couldn't settle it. ${W.team} took the extra period ${WQ[4] || 0}-${LQ[4] || 0}.` });
    if (rival && !lr) add({ kind: "rivalry", kick: rival, score: base + 40, h: pick(seed + "r", [`${WT} claims the ${rival} over ${LT}, ${sc}`, `Bragging rights: ${WT} wins the ${rival}`]), d: margin <= 7 ? `It came down to the final possession, as these always seem to.` : `It wasn't close. ${W.team} owns this one for another year.` });
    if (L.score === 0) add({ kind: "shutout", kick: "Shutout", score: base + 35, h: pick(seed + "s", [`${WT} blanks ${LT}, ${sc}`, `Goose egg: ${WT}'s defense pitches a shutout against ${LT}`]), d: `${L.team} managed just ${LS.totalYardsGained} yards and ${LS.offFirstdown ?? 0} first downs.` });
    else if (margin >= 35) add({ kind: "blowout", kick: "Blowout", score: base + 20, h: pick(seed + "b", [`${WT} runs ${LT} out of the building, ${sc}`, `No mercy: ${WT} hangs ${W.score} on ${LT}`]), d: `${W.team} rolled up ${WS.totalYardsGained} yards. ${L.team} has a long film session ahead.` });

    // strategy and mistakes
    for (const [S, me, op, won] of [[WS, W, L, true], [LS, L, W, false]]) {
      const tk = me.team_key, MT = tTok(tk), OT = tTok(op.team_key), say = coachSays(tk), ctok = coachTok(tk);
      const tries = S.fourthDowns || 0, conv = S.fourthDownConversions || 0;
      if (tries >= 4 && (won ? conv / tries >= 0.5 : conv / tries <= 0.5)) add({ kind: `4th:${tk}`, team: tk, kick: "Gamble", score: base + 25 + tries * 4 + (won ? 0 : 10),
        h: won ? pick(seed + tk + "4w", [`Fortune favors the bold: ${MT} goes for it ${num(tries)} times on fourth down and beats ${OT}`, `${ctok || MT} keeps the punter on the bench in a ${me.score}-${op.score} win over ${OT}`])
          : pick(seed + tk + "4l", [`${ctok ? `${ctok}'s` : MT + "'s"} fourth-down gambles backfire in loss to ${OT}`, `${plural(tries, "fourth-down try").replace("trys", "tries")}, ${plural(conv, "conversion")}: ${MT}'s aggression costs it against ${OT}`]),
        d: won ? `${me.team} converted ${conv} of ${tries} fourth downs, and each one ${pick(seed + "4d", ["swung the momentum", "demoralized the " + op.team + " defense", "kept the clock moving"])}.` : `${me.team} went ${conv}-for-${tries} on fourth down${conv < tries ? `, turning it over on downs ${times(tries - conv)}` : ""}. ${pick(seed + "4x", ["The message boards are already furious.", "Analytics guys will defend it. The fan base won't.", "Somewhere a punter is wondering why he made the trip."])}`,
        quote: say ? { text: won ? `We came to win the game, not to not lose it.` : pick(seed + "4q", [`I'd make the same calls again. We have to execute.`, `I trusted my guys. We came up short.`]), by: say } : null });
      if ((S.penalties || 0) >= 10 || (S.penaltyYards || 0) >= 100) add({ kind: `flags:${tk}`, team: tk, kick: "Self-inflicted", score: base + 18 + (won ? 0 : 10),
        h: won ? `${MT} survives ${S.penalties} penalties to beat ${OT}` : pick(seed + tk + "f", [`Yellow rain: ${S.penalties} penalties for ${S.penaltyYards} yards sink ${MT} against ${OT}`, `${MT} beats itself, flagged ${S.penalties} times in loss to ${OT}`]),
        d: `${S.penalties} penalties, ${S.penaltyYards} yards. ${won ? "A win is a win, but the film won't be pretty." : "Discipline will be the theme of practice this week."}` });
      if ((S.turnovers || 0) >= 4 && !won) add({ kind: `to:${tk}`, team: tk, kick: "Turnovers", score: base + 22, h: `${MT} gives it away ${num(S.turnovers)} times in loss to ${OT}`, d: `You can't win giving the ball away ${S.turnovers} times. ${op.team} turned the gifts into points.` });
      if ((S.thirdDowns || 0) >= 10 && (S.thirdDownConversions || 0) / S.thirdDowns <= 0.2 && !won) add({ kind: `3rd:${tk}`, team: tk, kick: "Stalled", score: base + 12, h: `${MT} goes ${S.thirdDownConversions}-for-${S.thirdDowns} on third down in loss to ${OT}`, d: `Drives kept dying on the money down.` });
      if ((S.possessionSeconds || 0) >= 2400 && won) add({ kind: `top:${tk}`, team: tk, kick: "Ball control", score: base + 10, h: `${MT} keeps the ball for ${Math.floor(S.possessionSeconds / 60)} minutes and grinds down ${OT}`, d: `${op.team}'s offense barely saw the field.` });
    }

    // players
    for (const p of b.Players || []) {
      const s = p.Stats || {}, tk = p.Team, me = tk === g.home.team_key ? g.home : g.away, op = me === g.home ? g.away : g.home, won = me.score > op.score;
      const PT = P(p.Key, p.Name), MT = tTok(tk), OT = tTok(op.team_key), pseed = seed + p.Key;
      const pb = base + (userTeams.has(tk) ? 10 : 0);
      if (s.passINT >= 3) add({ kind: `int:${p.Key}`, team: tk, kick: "Rough day", score: pb + 20 + s.passINT * 5 + (won ? 0 : 10),
        h: pick(pseed + "i", [`${num(s.passINT).replace(/^./, (c) => c.toUpperCase())} picks: ${PT}'s nightmare afternoon ${won ? "nearly costs" : "dooms"} ${MT} against ${OT}`, `${PT} throws ${num(s.passINT)} interceptions as ${MT} ${won ? "barely survives" : "falls to"} ${OT}`, `${OT}'s secondary feasts on ${PT}: ${s.passINT} INTs`]),
        d: `${s.passCompletion}-of-${s.passAttempts}, ${s.passYards} yards, ${s.passTD} TD, ${s.passINT} INT. ${pick(pseed + "i2", ["Every throw into coverage seemed to find the wrong jersey.", "It was the kind of day a quarterback wants to forget by Monday.", "The film session will be long and quiet."])}` });
      if (s.passYards >= 400 || s.passTD >= 5) add({ kind: `pass:${p.Key}`, team: tk, kick: "Air raid", score: pb + 30 + Math.max(0, (s.passYards - 400) / 10) + s.passTD * 2,
        h: pick(pseed + "p", [`${PT} carves up ${OT} for ${s.passYards} yards and ${num(s.passTD)} touchdowns`, `${PT} goes off for ${s.passYards} yards and ${num(s.passTD)} TD ${won ? "in a win over" : "in a losing effort against"} ${OT}`]),
        d: `${s.passCompletion}-of-${s.passAttempts}${s.passINT ? `, ${s.passINT} INT` : ", no interceptions"}. ${won ? `${me.team} wins ${me.score}-${op.score}.` : `Somehow it wasn't enough, ${op.score}-${me.score}.`}` });
      if (s.rushYards >= 200 || s.rushTD >= 4) add({ kind: `rush:${p.Key}`, team: tk, kick: "Ground game", score: pb + 28 + (s.rushYards - 200) / 10,
        h: pick(pseed + "r", [`${PT} gashes ${OT} for ${s.rushYards} yards`, `${PT} runs wild: ${s.rushAttempts} carries, ${s.rushYards} yards, ${num(s.rushTD)} TD`]),
        d: `${s.rushYards >= 200 ? `That's ${(s.rushYards / Math.max(s.rushAttempts, 1)).toFixed(1)} yards a carry. ` : ""}${pick(pseed + "r2", [`${op.team}'s front had no answer.`, `${s.rushBrokenTackles ? `${s.rushBrokenTackles} broken tackles tell the story.` : "Arm tackles weren't going to cut it."}`])}` });
      if (s.receivingYards >= 175 || s.receiveTouchdowns >= 3) add({ kind: `rec:${p.Key}`, team: tk, kick: "Big play machine", score: pb + 24 + (s.receivingYards - 175) / 10, h: `${PT} torches ${OT}: ${s.receiveReceptions} catches, ${s.receivingYards} yards, ${num(s.receiveTouchdowns)} TD`, d: pick(pseed + "w", [`${op.team} tried bracketing him. It didn't matter.`, `Long ${s.receiveLongReception}. Cornerbacks in ${op.team} will be seeing him in their sleep.`]) });
      if (s.defenseSacks >= 3 || s.defenseInterceptions >= 2) add({ kind: `def:${p.Key}`, team: tk, kick: "Wrecking ball", score: pb + 22 + s.defenseSacks * 3 + s.defenseInterceptions * 4,
        h: s.defenseSacks >= 3 ? `${PT} lives in ${OT}'s backfield with ${num(s.defenseSacks)} sacks` : `${PT} picks off ${OT} ${times(s.defenseInterceptions)}`, d: `${s.defenseTotalTackles} tackles${s.defenseTacklesForLoss ? `, ${s.defenseTacklesForLoss} for loss` : ""}. ${won ? `${me.team} wins ${me.score}-${op.score}.` : "A monster game in a loss."}` });
      if ((s.kickFieldGoalAttempts || 0) - (s.kickFieldGoalsMade || 0) >= 2 && !won && op.score - me.score <= 7) add({ kind: `fg:${p.Key}`, team: tk, kick: "Missed chances", score: pb + 26, h: `Wide right, wide left: ${PT} misses ${num(s.kickFieldGoalAttempts - s.kickFieldGoalsMade)} field goals in ${MT}'s ${op.score - me.score}-point loss to ${OT}`, d: `${s.kickFieldGoalsMade}-of-${s.kickFieldGoalAttempts}. In a one-score game, those points were the difference.` });
    }
  }
  // streaks for league teams
  for (const tk of userTeams) {
    const s = streak(tk); if (s.n < 3) continue;
    const lg = lastGame(tk); if (!lg || lg.week !== latestWeek) continue;
    gamesOut.push({ id: `${tk}:streak${s.kind}${s.n}`, cat: "game", kind: "streak", team: tk, user: true, game: lg.key, kick: s.kind === "W" ? "Rolling" : "Hot seat", score: 40 + s.n * 5,
      h: s.kind === "W" ? `${tTok(tk)} has won ${num(s.n)} straight, and ${coachTok(tk)} has them believing` : `${num(s.n).replace(/^./, (c) => c.toUpperCase())} straight losses: the heat is rising on ${coachTok(tk)} at ${tTok(tk)}`,
      d: `${tName(tk)} sits at ${recOf(tk)}.${s.kind === "L" ? " Boosters are restless. Next week feels like a must-win." : ` ${ranked(tk) ? `Up to No. ${ranked(tk)} in the poll.` : "Poll voters are starting to notice."}`}`,
      quote: { text: s.kind === "W" ? pick(tk + "sw", ["We don't talk about the streak. We talk about Tuesday practice.", "One week at a time. Corny, but it works."]) : pick(tk + "sl", ["Nobody's panicking in this building.", "I know what the outside noise is saying. We'll fix it."]), by: coachSays(tk) } });
  }

  // Coaching carousel: compare who coaches where with the last sync. Moves are logged in carousel.json
  // (discord-feed.mjs posts a card for each one) and the recent ones become stories.
  const carFile = `${DIR}/carousel.json`, car = await readJson(carFile, null);
  const nowMem = Object.fromEntries(members.data.filter((m) => m.user_name && m.user_name !== "CPU").map((m) => [m.user_name, m.team_key]));
  if (car) {
    const lcm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), [k, v]]));
    const was = lcm(car.members || {}), now = lcm(nowMem), at = new Date().toISOString();
    for (const [u, [gt, tk]] of Object.entries(now)) {
      const prev = was[u]?.[1];
      if (prev == null) car.moves.push({ kind: "join", gt, to: tk, to_name: tName(tk), period: cur.id, season_text: cur.season_text, at });
      else if (String(prev) !== String(tk)) car.moves.push({ kind: "move", gt, from: prev, from_name: tName(prev), to: tk, to_name: tName(tk), period: cur.id, season_text: cur.season_text, at });
    }
    for (const [u, [gt, tk]] of Object.entries(was)) if (!now[u]) car.moves.push({ kind: "leave", gt, from: tk, from_name: tName(tk), period: cur.id, season_text: cur.season_text, at });
  }
  const carOut = { members: nowMem, moves: (car?.moves || []).slice(-80) };
  await writeFile(carFile, JSON.stringify(carOut));
  const recentMoves = carOut.moves.filter((m) => Date.now() - Date.parse(m.at) < 7 * 86400e3);
  for (const m of recentMoves) {
    const ch = coachHist.find((c) => c.gamertag.toLowerCase() === m.gt.toLowerCase());
    const nm = coachName(m.gt), who = `[[c:${m.gt}|${nm ? `Coach ${lastName(nm)}` : m.gt}]]`;
    const stint = m.from && ch?.stints?.filter((x) => String(x.team_key) === String(m.from)).reduce((a, x) => ({ w: a.w + x.w, l: a.l + x.l }), { w: 0, l: 0 });
    const toT = m.to ? team.get(m.to) : null;
    const toLine = toT ? ` ${T(m.to, m.to_name)} is ${toT.record}${toT.rank > 0 && toT.rank <= 25 ? ` and ranked No. ${toT.rank}` : ""}.` : "";
    const st = stint && stint.w + stint.l ? ` He went ${stint.w}-${stint.l} there.` : "";
    const base = { id: `carousel:${m.gt}:${m.kind}:${m.to || m.from}:${m.period}`, cat: "game", kind: "carousel", team: m.to || m.from, user: true, kick: "Coaching carousel", score: 130 };
    if (m.kind === "move") gamesOut.push({ ...base, h: `${who} leaves ${T(m.from, m.from_name)} for ${T(m.to, m.to_name)}`, d: `${m.gt} is taking over at ${m.to_name} after his run at ${m.from_name}.${st}${toLine}` });
    else if (m.kind === "join") gamesOut.push({ ...base, h: `${T(m.to, m.to_name)} hands the keys to ${who}`, d: `${m.gt} joins The Dynasty as the new head coach at ${m.to_name}.${toLine}` });
    else gamesOut.push({ ...base, h: `${who} is out at ${T(m.from, m.from_name)}`, d: `${m.gt} and ${m.from_name} have parted ways.${st} The program goes back to the CPU for now.` });
  }

  // real NCAA FBS records: one that fell this period, or a player closing in on one
  const records = await readJson(`data/history/${LID}/records.json`, { broken: [] });
  const ncaa = await readJson("data/ncaa-records.json", null);
  const leadersH = await readJson(`data/history/${LID}/leaders.json`, null);
  const NOUN = { passYards: "passing yards", passTD: "touchdown passes", rushYards: "rushing yards", rushTD: "rushing touchdowns", receivingYards: "receiving yards",
    receiveReceptions: "catches", receiveTouchdowns: "touchdown catches", defenseTotalTackles: "tackles", defenseSacks: "sacks", defenseInterceptions: "interceptions", kickFieldGoalsMade: "field goals" };
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const keyOfName = (n) => standings.data.find((t) => t.name === n)?.team_key;
  for (const b of records.broken || []) {
    if (b.first_seen_period !== cur.id) continue;
    const tk = b.t || keyOfName(b.tn), lg = tk ? lastGame(tk) : null;
    const what = `${b.scope === "season" ? "single-season" : "career"} ${NOUN[b.cat] || b.label}`;
    gamesOut.push({ id: `rec:${b.scope}:${b.cat}:${b.k}`, cat: "game", kind: "record", team: tk, user: userTeams.has(tk), game: lg?.key, kick: "Record book", score: 120,
      h: `${P(b.k, b.n)} breaks the NCAA ${what} record`,
      d: `${b.n} now has ${fmt(b.v)} ${NOUN[b.cat] || ""}, passing ${b.old.holder} (${b.old.school}, ${b.old.years}) and the ${fmt(b.old.value)} that stood as the real-life FBS mark.`,
      quote: tk && userTeams.has(tk) ? { text: pick(b.k + "rq", ["I told him after the game: that one's yours forever.", "Kid's earned every bit of it. The line deserves a steak dinner."]), by: coachSays(tk) } : undefined });
  }
  if (ncaa && leadersH) {
    const chase = [];
    for (const [cat, rec] of Object.entries(ncaa.season || {})) {
      const r = (leadersH.season[cat] || []).find((x) => String(x.y) === String(hist.current_season ?? cur.season));
      if (!r || r.v >= rec.value || !r.g) continue;
      const pace = Math.round((r.v / r.g) * 13), left = rec.value - r.v;
      if (r.v / rec.value < 0.6 || pace < rec.value * 0.95) continue;
      const tk = keyOfName(r.tn), lg = tk ? lastGame(tk) : null;
      if (!lg || lg.week !== latestWeek) continue;
      chase.push({ id: `chase:${cat}:${r.k}:${latestWeek}`, cat: "game", kind: "chase", team: tk, user: userTeams.has(tk), game: lg.key, kick: "Chasing history", score: 70 + (r.v / rec.value) * 30,
        h: `${P(r.k, r.n)} is ${fmt(left)} ${NOUN[cat]} from the NCAA single-season record`,
        d: `${fmt(r.v)} through ${r.g} games puts ${r.n} on pace for about ${fmt(pace)}. The real-life mark is ${fmt(rec.value)}, set by ${rec.holder} (${rec.school}, ${rec.years}).` });
    }
    gamesOut.push(...chase.sort((a, b) => b.score - a.score).slice(0, 2));
  }

  // keep the strongest angle per game unless a second one is truly big, then rank everything
  const perGame = new Map();
  for (const s of gamesOut.sort((a, b) => b.score - a.score)) { const n = perGame.get(s.game) || 0; if (n >= 2 || (n === 1 && s.score < 60)) continue; perGame.set(s.game, n + 1); s.keep = true; }
  // cap repetitive angles so the feed reads like a newspaper, not a list
  const CAPS = { chase: 2, "4th": 3, int: 4, pass: 4, rush: 3, rec: 3, def: 3, flags: 2, fg: 2, to: 2, "3rd": 1, top: 1, blowout: 3 };
  const used = {};
  const gameStories = gamesOut.filter((s) => s.keep).map(({ keep, ...s }) => s).sort((a, b) => b.score - a.score)
    .filter((s) => { const k = s.kind.split(":")[0]; used[k] = (used[k] || 0) + 1; return !CAPS[k] || used[k] <= CAPS[k]; })
    .map((s) => ({ ...s, h: capH(s.h) })).slice(0, 30);
  const recStories = recruiting.sort((a, b) => b.score - a.score).map((s) => ({ ...s, h: capH(s.h) })).slice(0, 40);

  const out = { sig, league_id: LID, period: cur, week: latestWeek, generated_at: new Date().toISOString(), snaps: snapIds, recruiting: recStories, games: gameStories, portal: portalStories, ...outlook };
  await writeFile(`${DIR}/latest.json`, JSON.stringify(out));
  await writeFile(`${DIR}/p${cur.id}.json`, JSON.stringify(out));
  log(`Stories: ${recStories.length} recruiting, ${gameStories.length} game (week ${latestWeek}), ${portalStories.length} portal watch.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
