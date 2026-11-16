// ODL Wire, forward-looking pieces (called from build-stories.mjs every sync):
//
//   crystal   Crystal Ball: predictions for 20-50 uncommitted recruits, with a reporter's write-up
//             and a running hit/miss record once those recruits commit
//   cfp       Playoff odds: Monte Carlo of the rest of the regular season, conference title games,
//             a committee-style ranking and the 12-team bracket, re-run every advance
//   offseason Two once-a-year features shown from the end of the transfer portal until Week 1:
//             the 10 biggest NIL raises and the breakout players to watch
//
// The offseason pieces compare against data/stories/<league>/baseline.json, an end-of-season
// snapshot (team, overall, NIL, depth chart spot, key ratings) rewritten every in-season advance.

import { writeFile } from "node:fs/promises";

// key ratings by position group, in the words a reporter would use
const RATING_WORDS = {
  throwPower: "arm strength", throwAccuracyShort: "short accuracy", throwAccuracyMid: "mid-range accuracy", throwAccuracyDeep: "deep accuracy",
  throwUnderPressure: "accuracy under pressure", throwOnTheRun: "throwing on the run", awareness: "awareness", speed: "speed", acceleration: "acceleration",
  ballCarrierVision: "vision", breakTackle: "tackle-breaking", jukeMove: "juke move", carrying: "ball security", catching: "hands", trucking: "trucking",
  release: "release off the line", routeRunningShort: "short route running", routeRunningMed: "intermediate route running", routeRunningDeep: "deep route running",
  catchInTraffic: "catching in traffic", spectacularCatch: "spectacular-catch ability", runBlock: "run blocking", passBlock: "pass blocking",
  passBlockPower: "power pass protection", passBlockFinesse: "finesse pass protection", runBlockPower: "drive blocking", runBlockFinesse: "zone blocking",
  strength: "strength", powerMoves: "power rush moves", finesseMoves: "finesse rush moves", blockShedding: "block shedding", pursuit: "pursuit",
  tackle: "tackling", playRecognition: "play recognition", zoneCoverage: "zone coverage", manCoverage: "man coverage", hitPower: "hit power",
  press: "press coverage", agility: "agility", jumping: "leaping ability", kickPower: "leg strength", kickAccuracy: "kicking accuracy",
};
const GROUP = { QB: "QB", HB: "RB", FB: "RB", WR: "WR", TE: "TE", LT: "OL", RT: "OL", LG: "OL", RG: "OL", C: "OL", LEDG: "DL", REDG: "DL", DT: "DL",
  SAM: "LB", WILL: "LB", MIKE: "LB", CB: "CB", FS: "S", SS: "S", K: "KP", P: "KP" };
const KEYS = {
  QB: ["throwPower", "throwAccuracyShort", "throwAccuracyMid", "throwAccuracyDeep", "throwUnderPressure", "throwOnTheRun", "awareness", "speed"],
  RB: ["speed", "acceleration", "ballCarrierVision", "breakTackle", "jukeMove", "carrying", "catching", "trucking"],
  WR: ["speed", "release", "routeRunningShort", "routeRunningMed", "routeRunningDeep", "catching", "catchInTraffic", "spectacularCatch"],
  TE: ["catching", "routeRunningShort", "routeRunningMed", "runBlock", "passBlock", "speed", "catchInTraffic", "release"],
  OL: ["passBlock", "passBlockPower", "passBlockFinesse", "runBlock", "runBlockPower", "runBlockFinesse", "strength", "awareness"],
  DL: ["powerMoves", "finesseMoves", "blockShedding", "pursuit", "tackle", "strength", "speed", "playRecognition"],
  LB: ["tackle", "pursuit", "playRecognition", "zoneCoverage", "manCoverage", "hitPower", "blockShedding", "speed"],
  CB: ["manCoverage", "zoneCoverage", "press", "speed", "playRecognition", "agility", "jumping", "catching"],
  S: ["zoneCoverage", "manCoverage", "hitPower", "tackle", "pursuit", "playRecognition", "speed", "jumping"],
  KP: ["kickPower", "kickAccuracy"],
};

export async function buildOutlook(c) {
  const { api, readJson, DIR, cur, prevIdx, games, standings, teamStats, team, ts, userTeams, tName, tTok, keyOfSchool, reasonsFor, board, events,
    style, allRos, depth, STARTERS, POS, POS_WORD, nilRank, ranked, recOf, coachTok, h } = c;
  const { pick, hash, ord, T, P, R, capH, an, cap, num, list, STARS, lastName, STATE_NAME, TEAM_STATE } = h;
  const log = (...a) => console.log(...a);
  const text = cur.season_text || "";
  const wkM = /^\d{4} Wk (\d+)$/.exec(text), wkNum = wkM ? +wkM[1] : null;
  const post = /bowl|championship|playoff|cfp|semifinal|quarterfinal|conference/i.test(text);
  const portalPhase = /portal|leaving|signing|nil|negotiat|re-?sign/i.test(text);
  const inSeason = (wkNum != null && wkNum >= 1) || post;
  const offseasonWindow = !inSeason && !portalPhase; // everything after the portal, through Week 0
  const TEST = process.env.OUTLOOK_TEST === "1";
  const yr = { FR: "freshman", SO: "sophomore", JR: "junior", SR: "senior" };
  const posW = (p) => POS_WORD[p] || p;

  /* ============ end-of-season baseline (for offseason comparisons) ============ */
  const depthRank = (x) => (depth.get(`${x.team_key}|${x.position}`) || []).findIndex((y) => y.player_key === x.player_key) + 1;
  const offRank = (key) => new Map([...teamStats.data].filter((t) => t.games_played).sort((a, b) => (b.stats?.[key] || 0) - (a.stats?.[key] || 0)).map((t, i) => [t.team_key, i + 1]));
  let baseline = await readJson(`${DIR}/baseline.json`, null);
  if (inSeason && allRos.length) {
    const passR = offRank("OffPassYardsPerGame"), rushR = offRank("OffRushYardsPerGame");
    const b = { season: cur.season, period: cur.id, season_text: text, teams: Object.fromEntries(standings.data.map((t) => [t.team_key, [passR.get(t.team_key) || null, rushR.get(t.team_key) || null, t.record]])), p: {} };
    for (const x of allRos) b.p[x.player_key] = [x.team_key, x.overall, x.nil_compensation ?? 0, x.position, depthRank(x), x.name, x.class_year, (KEYS[GROUP[x.position]] || []).map((k) => x.ratings?.[k] ?? null)];
    await writeFile(`${DIR}/baseline.json`, JSON.stringify(b));
    baseline = b;
  }
  if (TEST && baseline) { // perturb a copy so the offseason code has something to find
    const p = {}; for (const [k, v] of Object.entries(baseline.p)) { const r = hash(k + "t"); p[k] = [r % 9 === 0 ? +Object.keys(baseline.teams)[r % 130] || v[0] : v[0], v[1] - (r % 7), Math.max(0, v[2] - (r % 11) * 10), v[3], v[4] + (r % 4 === 0 ? 2 : 0), v[5], v[6], v[7].map((z, i) => (z == null ? z : z - ((r >> i) % 9)))]; }
    baseline = { ...baseline, p };
  }

  /* ===================== CRYSTAL BALL ===================== */
  const crystal = [];
  const infFile = await readJson(`${DIR}/influence.json`, {});
  const prevInf = infFile.cur?.period === cur.id ? infFile.prev?.d || {} : infFile.cur?.d || {};
  const nowInf = {}; for (const r of board.data) if (r.top_schools?.length) nowInf[r.prospect_key] = Object.fromEntries(r.top_schools.map((s) => [s.team_id, s.influence]));
  await writeFile(`${DIR}/influence.json`, JSON.stringify({ cur: { period: cur.id, d: nowInf }, prev: infFile.cur?.period === cur.id ? infFile.prev : infFile.cur }));
  const live = board.data.filter((r) => !r.committed && !r.signed && (r.top_schools || []).some((s) => s.influence > 0)).sort((a, b) => (a.national_rank || 9999) - (b.national_rank || 9999));
  const sel = live.slice(0, 35);
  for (const r of live.slice(35)) { if (sel.length >= 50) break; if ((r.top_schools || []).slice(0, 3).some((s) => userTeams.has(keyOfSchool(s))) && r.stars >= 3) sel.push(r); }
  const predPhrase = async (r, tk, reason, seed) => {
    if (!reason) return "";
    const nm = lastName(r.name), db = (r.dealbreaker || "").toLowerCase();
    if (reason.k === "home") return TEAM_STATE[tName(tk)] === r.state ? `${tName(tk)} is the home-state school, and ${db === "proximity to home" ? "proximity to home is his dealbreaker" : "family has been part of every conversation"}.` : `${tName(tk)} is a short drive from ${r.hometown || "home"}${db === "proximity to home" ? ", and proximity to home is the one thing he won't budge on" : ""}.`;
    if (reason.k === "time") return `${tName(tk)}'s ${posW(r.position)} room is thin${db === "playing time" ? ", and playing time is his dealbreaker" : ""}. He can start early there.`;
    if (reason.k === "coach") return `${coachTok(tk)} has made this one personal.`;
    if (reason.k === "far") return "";
    return reason.line.replace(/^The timing helped: /, "Timing could help: ").replace(/ and \w+ wanted /, " and he wants ");
  };
  for (const r of sel) {
    const schools = (r.top_schools || []).filter((s) => s.influence > 0).slice(0, 4).map((s) => ({ ...s, tk: keyOfSchool(s) })).filter((s) => s.tk);
    if (!schools.length) continue;
    const seed = r.prospect_key + "cb" + cur.id;
    for (const s of schools) {
      const before = prevInf[r.prospect_key]?.[s.team_id];
      s.mom = before != null ? s.influence - before : s.influence_this_week != null && s.influence_this_week < s.influence ? s.influence_this_week : 0;
      s.reasons = await reasonsFor(r, s.tk, seed + s.tk);
      s.fit = s.reasons.slice(0, 3).reduce((t, x) => t + x.w, 0);
      s.proj = s.influence * (1 + 0.025 * s.fit) + 1.5 * Math.max(0, s.mom);
    }
    const temp = Math.max(25, 0.14 * Math.max(...schools.map((s) => s.proj)));
    const ex = schools.map((s) => Math.exp((s.proj - Math.max(...schools.map((x) => x.proj))) / temp)), sum = ex.reduce((a, b) => a + b, 0);
    schools.forEach((s, i) => (s.p = ex[i] / sum));
    const ranked2 = [...schools].sort((a, b) => b.p - a.p), pk = ranked2[0], alt = ranked2[1];
    const leader = schools[0], second = schools[1];
    const nm = lastName(r.name), pct = Math.round(pk.p * 100);
    const lines = [];
    if (!second) lines.push(`${T(pk.tk, pk.name)} is the only school with real traction here.`);
    else if (pk.tk !== leader.tk) lines.push(`${T(leader.tk, leader.name)} leads on paper, ${leader.influence} to ${pk.influence}, but the momentum belongs to ${T(pk.tk, pk.name)}${pk.mom > 0 ? `, which gained ${pk.mom} points this week${leader.mom >= 0 ? ` to ${leader.name}'s ${leader.mom}` : ""}` : ""}.`);
    else if ((leader.influence - second.influence) / leader.influence > 0.35) lines.push(pick(seed + "a", [`${T(leader.tk, leader.name)} has controlled this one, sitting ${leader.influence - second.influence} points clear of ${T(second.tk, second.name)}.`, `${T(leader.tk, leader.name)} has built a real cushion: ${leader.influence} points to ${second.name}'s ${second.influence}.`]));
    else lines.push(pick(seed + "b", [`This is a dogfight between ${T(leader.tk, leader.name)} and ${T(second.tk, second.name)}, separated by ${leader.influence - second.influence} points.`, `${T(leader.tk, leader.name)} (${leader.influence}) and ${T(second.tk, second.name)} (${second.influence}) are trading punches.`]));
    if (pk.tk === leader.tk && second && second.mom > leader.mom && second.mom > 0) lines.push(`${second.name} closed ground this week (+${second.mom}), so this isn't over.`);
    const why = await predPhrase(r, pk.tk, pk.reasons.find((x) => x.k !== "far"), seed);
    if (why) lines.push(why);
    if (r.desired_nil && !pk.reasons.some((x) => x.k === "nil")) { const nr = nilRank.get(pk.tk); if (nr && r.desired_nil >= 250) lines.push(nr <= 25 ? `His asking price (a reported $${r.desired_nil}K) shouldn't scare ${pk.name}, which ranks ${ord(nr)} in NIL spending.` : `The catch: he wants a reported $${r.desired_nil}K, and ${pk.name} ranks ${ord(nr)} in NIL spending.`); }
    const conf = pct >= 75 ? "High" : pct >= 50 ? "Medium" : "Low";
    const closer = conf === "High" ? pick(seed + "c", [`Book it.`, `We'd be stunned if he ends up anywhere else.`, `Barring a late swing, this one's done.`])
      : conf === "Medium" ? `${pk.name} is the pick, but ${alt ? alt.name : "the field"} isn't done.` : pick(seed + "d", [`Coin flip. We'll lean ${pk.name}, barely.`, `Gut call: ${pk.name}. Nobody should be comfortable.`]);
    crystal.push({ recruit: r.prospect_key, name: r.name, stars: r.stars, position: r.position, archetype: r.archetype, rank: r.national_rank, hometown: r.hometown, state: r.state,
      stage: r.stage, dealbreaker: r.dealbreaker, desired_nil: r.desired_nil, user: schools.some((s) => userTeams.has(s.tk)),
      schools: schools.map((s) => ({ team: s.tk, name: s.name, influence: s.influence, mom: s.mom, pct: Math.round(s.p * 100) })),
      pick: pk.tk, pick_name: pk.name, pct, confidence: conf, upset: pk.tk !== leader.tk, h: `${R(r.prospect_key, r.name)}`, d: lines.join(" "), call: closer });
  }
  // track record: did committed recruits land where we said?
  const rec = prevIdx.crystal_record || { hits: 0, misses: 0, calls: [], done: [] };
  const done = new Set(rec.done || []), logPrev = prevIdx.crystal_log || {};
  for (const e of events.filter((e) => e.kind === "commit" && !e.transfer)) {
    const lg = logPrev[e.prospect_key]; if (!lg || done.has(e.prospect_key)) continue;
    const landed = keyOfSchool(e.school), hit = landed === lg.pick;
    hit ? rec.hits++ : rec.misses++; done.add(e.prospect_key);
    rec.calls = [{ recruit: e.prospect_key, name: e.name, pick: lg.pick, pick_name: lg.pick_name, landed, landed_name: e.school?.name, hit, pct: lg.pct, period: cur.id }, ...(rec.calls || [])].slice(0, 12);
  }
  rec.done = [...done].slice(-500);
  const crystal_log = { ...Object.fromEntries(Object.entries(logPrev).filter(([k]) => !done.has(+k))), ...Object.fromEntries(crystal.map((x) => [x.recruit, { pick: x.pick, pick_name: x.pick_name, pct: x.pct, period: cur.id }])) };

  /* ===================== CFP ODDS ===================== */
  let cfp = null;
  const regular = (g) => /^Week \d+$/i.test(g.displayed_week || "") || (!g.displayed_week && g.week <= 16);
  const fbs = new Map(standings.data.map((t) => [t.team_key, t]));
  const remaining = games.filter((g) => !g.played && regular(g) && fbs.has(g.home.team_key) && fbs.has(g.away.team_key));
  if (inSeason && remaining.length) {
    const N = 4000;
    const played = games.filter((g) => g.played && regular(g));
    const gp = new Map(), pd = new Map(), opps = new Map();
    for (const g of [...played, ...remaining]) for (const [a, b] of [[g.home, g.away], [g.away, g.home]]) { if (!fbs.has(a.team_key)) continue; (opps.get(a.team_key) || opps.set(a.team_key, []).get(a.team_key)).push(b.team_key); }
    for (const g of played) for (const [a, b] of [[g.home, g.away], [g.away, g.home]]) { gp.set(a.team_key, (gp.get(a.team_key) || 0) + 1); pd.set(a.team_key, (pd.get(a.team_key) || 0) + a.score - b.score); }
    const S = new Map(); for (const t of standings.data) { const n = gp.get(t.team_key) || 0, m = n ? pd.get(t.team_key) / n : 0; S.set(t.team_key, (t.overall - 80) * 0.9 + m * (n / (n + 3)) * 0.5); }
    const sOf = (k) => S.get(k) ?? -12; // FCS / unknown opponents
    const sos = new Map([...fbs.keys()].map((k) => { const o = opps.get(k) || []; return [k, o.length ? o.reduce((t, x) => t + sOf(x), 0) / o.length : 0]; }));
    const remSos = new Map([...fbs.keys()].map((k) => { const o = remaining.filter((g) => g.home.team_key === k || g.away.team_key === k).map((g) => (g.home.team_key === k ? g.away : g.home).team_key); return [k, o.length ? o.reduce((t, x) => t + sOf(x), 0) / o.length : null]; }));
    const rankBy = (m, desc = true) => new Map([...m].filter(([, v]) => v != null).sort((a, b) => (desc ? b[1] - a[1] : a[1] - b[1])).map(([k], i) => [k, i + 1]));
    const sosRank = rankBy(sos), remRank = rankBy(remSos), sRank = rankBy(S);
    const pWin = (h, a, neutral) => 1 / (1 + Math.exp(-(sOf(h) - sOf(a) + (neutral ? 0 : 2.5)) / 7));
    const confRec = (t) => (t.conference_record || "0-0").split("-").map(Number);
    const confs = new Map(); for (const t of standings.data) { if (/independent/i.test(t.conference || "")) continue; (confs.get(t.conference) || confs.set(t.conference, []).get(t.conference)).push(t.team_key); }
    let seedR = hash(String(cur.id)) || 1; const rnd = () => ((seedR = Math.imul(seedR ^ (seedR >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296);
    const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) * 1.41; };
    const tally = new Map([...fbs.keys()].map((k) => [k, { make: 0, bye: 0, conf: 0, title: 0, w: 0, l: 0, seedSum: 0 }]));
    const nextWeek = Math.min(...remaining.map((g) => g.week));
    const watch = remaining.filter((g) => g.week === nextWeek);
    const cond = new Map(watch.map((g) => [g.key, { hw: [0, 0], aw: [0, 0], n: 0, hmk: [0, 0], amk: [0, 0] }]));
    const isConf = (g) => { const a = fbs.get(g.home.team_key), b = fbs.get(g.away.team_key); return a.conference === b.conference && !/independent/i.test(a.conference || ""); };
    for (let i = 0; i < N; i++) {
      const W = new Map(), L = new Map(), CW = new Map(), CL = new Map();
      for (const t of standings.data) { W.set(t.team_key, t.wins); L.set(t.team_key, t.losses); const [a, b] = confRec(t); CW.set(t.team_key, a || 0); CL.set(t.team_key, b || 0); }
      const outcome = new Map();
      for (const g of remaining) {
        const hw = rnd() < pWin(g.home.team_key, g.away.team_key), win = hw ? g.home.team_key : g.away.team_key, lose = hw ? g.away.team_key : g.home.team_key;
        W.set(win, W.get(win) + 1); L.set(lose, L.get(lose) + 1); if (isConf(g)) { CW.set(win, CW.get(win) + 1); CL.set(lose, CL.get(lose) + 1); }
        if (cond.has(g.key)) outcome.set(g.key, hw);
      }
      const champs = new Set();
      for (const [, ks] of confs) {
        if (ks.length < 2) { champs.add(ks[0]); continue; }
        const top = [...ks].sort((a, b) => (CW.get(b) - CL.get(b)) - (CW.get(a) - CL.get(a)) || (W.get(b) - L.get(b)) - (W.get(a) - L.get(a)) || sOf(b) - sOf(a) + (rnd() - 0.5) * 0.01).slice(0, 2);
        const hw = rnd() < pWin(top[0], top[1], true), win = hw ? top[0] : top[1]; champs.add(win); W.set(win, W.get(win) + 1); L.set(hw ? top[1] : top[0], L.get(hw ? top[1] : top[0]) + 1);
      }
      const score = new Map(); for (const t of standings.data) { const k = t.team_key; score.set(k, 10 * W.get(k) - 14 * L.get(k) + 0.5 * sOf(k) + 0.35 * sos.get(k) + (champs.has(k) ? 8 : 0) + (t.rank > 0 && t.rank <= 25 ? (26 - t.rank) * 0.6 : 0) + gauss() * 3); }
      const order = [...fbs.keys()].sort((a, b) => score.get(b) - score.get(a));
      const autos = order.filter((k) => champs.has(k)).slice(0, 5), field = new Set(autos);
      for (const k of order) { if (field.size >= 12) break; field.add(k); }
      const seeds = [...field].sort((a, b) => score.get(b) - score.get(a));
      seeds.forEach((k, j) => { const x = tally.get(k); x.make++; x.seedSum += j + 1; if (j < 4) x.bye++; });
      for (const k of champs) if (tally.has(k)) tally.get(k).conf++;
      for (const k of fbs.keys()) { const x = tally.get(k); x.w += W.get(k); x.l += L.get(k); }
      const play = (a, b, neutral) => (rnd() < pWin(a, b, neutral) ? a : b);
      const r1 = [play(seeds[4], seeds[11]), play(seeds[5], seeds[10]), play(seeds[6], seeds[9]), play(seeds[7], seeds[8])];
      const qf = [play(seeds[0], r1[3], true), play(seeds[1], r1[2], true), play(seeds[2], r1[1], true), play(seeds[3], r1[0], true)];
      const champ = play(play(qf[0], qf[3], true), play(qf[1], qf[2], true), true); tally.get(champ).title++;
      for (const g of watch) { const c2 = cond.get(g.key), hw = outcome.get(g.key) ? 0 : 1; c2.hw[hw]++; if (field.has(g.home.team_key)) c2.hmk[hw]++; if (field.has(g.away.team_key)) c2.amk[hw]++; }
    }
    const prevOdds = new Map((prevIdx.cfp?.teams || []).map((t) => [t.team, t.make]));
    const pc = (n) => Math.round((n / N) * 1000) / 10;
    const teams = [...tally].map(([k, x]) => {
      const t = fbs.get(k), n = gp.get(k) || 0;
      return { team: k, name: t.name, conf: t.conference, rank: t.rank > 0 && t.rank <= 25 ? t.rank : null, record: t.record, conf_record: t.conference_record, user: userTeams.has(k),
        ovr: t.overall, off: t.offense, def: t.defense, ppg_diff: n ? Math.round((pd.get(k) / n) * 10) / 10 : 0, power: sRank.get(k), sos: sosRank.get(k), rem_sos: remRank.get(k) || null,
        proj: `${(x.w / N).toFixed(1)}-${(x.l / N).toFixed(1)}`, make: pc(x.make), bye: pc(x.bye), conf_title: pc(x.conf), title: pc(x.title), avg_seed: x.make ? Math.round((x.seedSum / x.make) * 10) / 10 : null,
        delta: prevOdds.has(k) ? Math.round((pc(x.make) - prevOdds.get(k)) * 10) / 10 : null };
    }).filter((t) => t.make >= 0.5 || t.rank).sort((a, b) => b.make - a.make || b.title - a.title).slice(0, 30);
    // the reporter's notes
    const tk2 = (t) => T(t.team, t.name);
    const notes = [];
    const locks = teams.filter((t) => t.make >= 95), bubble = teams.filter((t) => t.make >= 25 && t.make <= 75);
    if (locks.length) notes.push({ k: "Locks", d: `${list(locks.map(tk2))} ${locks.length === 1 ? "is" : "are"} all but in.` });
    const lastIn = teams.slice(8, 12), firstOut = teams.slice(12, 16);
    if (lastIn.length) notes.push({ k: "Last four in", d: list(lastIn.map((t) => `${tk2(t)} (${t.make}%)`)) });
    if (firstOut.length) notes.push({ k: "First four out", d: list(firstOut.map((t) => `${tk2(t)} (${t.make}%)`)) });
    const movers = teams.filter((t) => t.delta != null && Math.abs(t.delta) >= 8).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4);
    for (const t of movers) notes.push({ k: t.delta > 0 ? "Riser" : "Faller", d: `${tk2(t)} ${t.delta > 0 ? "jumps" : "drops"} ${Math.abs(t.delta)} points to ${t.make}% after going ${t.record}.` });
    const toughest = bubble.filter((t) => t.rem_sos && t.rem_sos <= 25).slice(0, 2);
    for (const t of toughest) notes.push({ k: "Gauntlet", d: `${tk2(t)} has the ${ord(t.rem_sos)}-toughest remaining schedule in FBS. Survive it and they're in.` });
    const g2w = watch.map((g) => { const c2 = cond.get(g.key); const sw = (mk, side) => { const won = side === "h" ? c2.hw[0] : c2.hw[1], lost = side === "h" ? c2.hw[1] : c2.hw[0]; const a = won ? mk[side === "h" ? 0 : 1] / won : 0, b = lost ? mk[side === "h" ? 1 : 0] / lost : 0; return Math.round((a - b) * 100); };
      const hs = sw(c2.hmk, "h"), as = sw(c2.amk, "a"); return { game: g.key, home: g.home.team_key, away: g.away.team_key, home_name: g.home.team, away_name: g.away.team, home_swing: hs, away_swing: as, win_home: Math.round(pWin(g.home.team_key, g.away.team_key) * 100), swing: Math.max(hs, as) }; })
      .filter((g) => g.swing >= 10).sort((a, b) => b.swing - a.swing).slice(0, 5);
    cfp = { period: cur.id, season_text: text, sims: N, next_week: nextWeek, teams, notes, games: g2w,
      method: "Every remaining regular-season game is simulated 4,000 times from team ratings and scoring margin (home field worth about 2.5 points). Conference title games pit the top two in each league. A committee-style ranking weighs wins, losses, strength of schedule, conference titles and the current poll. The field is the five highest-ranked conference champions plus the next seven, with byes for the top four seeds." };
  } else if (!offseasonWindow && prevIdx.cfp) cfp = { ...prevIdx.cfp, final: true };

  /* ===================== OFFSEASON FEATURES ===================== */
  let offseason = null;
  const showOff = TEST || offseasonWindow;
  if (showOff && baseline && (wkNum == null || TEST)) {
    const bp = baseline.p, curKeys = new Set(allRos.map((x) => x.player_key));
    const byNamePos = new Map(); for (const [k, v] of Object.entries(bp)) { const id = `${v[5]}|${v[3]}`; byNamePos.set(id, byNamePos.has(id) ? null : k); }
    const lastSeason = await readJson(`data/history/${c.LID}/players-${baseline.season}.json`, { data: [] });
    const statsOf = new Map((Array.isArray(lastSeason.data) ? lastSeason.data : []).map((p) => [p.k, p.s || {}]));
    const baseOf = (x) => { let b = bp[x.player_key], key = x.player_key; if (!b) { const k = byNamePos.get(`${x.name}|${x.position}`); if (k && !curKeys.has(+k) && Math.abs(bp[k][1] - x.overall) <= 10) { b = bp[k]; key = +k; } } return b ? { b, key } : null; };
    const statLine = (pos, s) => { if (!s || !s.gamesPlayed) return "";
      if (pos === "QB" && s.passAttempts) return `${s.passYards ?? 0} yards, ${s.passTD ?? 0} TD, ${s.passINT ?? 0} INT`;
      if (["HB", "FB"].includes(pos) && s.rushAttempts) return `${s.rushYards ?? 0} rushing yards, ${s.rushTD ?? 0} TD`;
      if (["WR", "TE"].includes(pos) && s.receiveReceptions) return `${s.receiveReceptions} catches, ${s.receivingYards ?? 0} yards, ${s.receiveTouchdowns ?? 0} TD`;
      if (s.defenseTotalTackles) return `${s.defenseTotalTackles} tackles${s.defenseSacks ? `, ${s.defenseSacks} sacks` : ""}${s.defenseInterceptions ? `, ${s.defenseInterceptions} INT` : ""}`;
      if (s.kickFieldGoalAttempts) return `${s.kickFieldGoalsMade}-of-${s.kickFieldGoalAttempts} on field goals`;
      return `${s.gamesPlayed} games`; };
    // 1) the 10 biggest NIL raises
    const raises = [];
    for (const x of allRos) { const m = baseOf(x); if (!m) continue; const before = m.b[2] || 0, now = x.nil_compensation || 0; if (now - before > 0) raises.push({ x, m, before, now, raise: now - before }); }
    raises.sort((a, b) => b.raise - a.raise || b.now - a.now);
    const nil = raises.slice(0, 10).map(({ x, m, before, now, raise }, i) => {
      const moved = m.b[0] !== x.team_key, seed = x.player_key + "nil", jump = x.overall - m.b[1], st = statLine(x.position, statsOf.get(m.key));
      const bits = [];
      if (moved) bits.push(pick(seed + "m", [`Followed the money through the portal from ${T(m.b[0], tName(m.b[0]))} to ${tTok(x.team_key)}.`, `Cashed in on the portal, trading ${T(m.b[0], tName(m.b[0]))} for ${tTok(x.team_key)}.`]));
      else bits.push(pick(seed + "s", [`${tTok(x.team_key)} paid up to keep him.`, `${tTok(x.team_key)} wasn't letting him walk.`, `Re-signed with ${tTok(x.team_key)} on a much bigger number.`]));
      if (st) bits.push(`Last season: ${st}.`);
      if (jump >= 2) bits.push(`Up ${jump} overall since the end of last season (${m.b[1]} to ${x.overall}).`);
      return { rank: i + 1, player: x.player_key, name: x.name, position: x.position, team: x.team_key, from: moved ? m.b[0] : null, before, now, raise, pct: before ? Math.round((raise / before) * 100) : null, ovr: x.overall, d: bits.join(" "), user: userTeams.has(x.team_key) || (moved && userTeams.has(m.b[0])) };
    });
    const movedN = nil.filter((n) => n.from).length, total = nil.reduce((t, n) => t + n.raise, 0);
    // 2) breakout players
    const styleRank = (x) => { const lab = POS[x.position]?.[3]; if (!lab || !x.archetype) return null; const g = style.data.find((y) => (y.archetypes || []).includes(`${lab} - ${x.archetype}`)); const row = g?.rows?.find((y) => y.team_key === x.team_key); return row ? { rank: row.rank, of: g.rows.length, stat: g.stat } : null; };
    const cands = [];
    for (const x of allRos) {
      if (x.overall < 74 || ["K", "P", "FB"].includes(x.position)) continue;
      const m = baseOf(x); if (!m) continue;
      const b = m.b, st = statsOf.get(m.key) || {}, tk = x.team_key, seed = x.player_key + "bo";
      const keys = KEYS[GROUP[x.position]] || [], now = keys.map((k) => x.ratings?.[k] ?? null);
      const downsPg = st.gamesPlayed ? (st.genDownsPlayed || 0) / st.gamesPlayed : 0;
      if (b[1] >= 85 && downsPg >= 30) continue; // already a known commodity
      const sig = [];
      const jump = x.overall - b[1];
      if (jump >= 3) sig.push({ w: jump * 2, t: pick(seed + "j", [`jumped from ${b[1]} to ${x.overall} overall this offseason`, `came out of the offseason at ${x.overall} overall, up from ${b[1]}`]) });
      const rj = keys.map((k, i) => ({ k, d: now[i] != null && b[7]?.[i] != null ? now[i] - b[7][i] : 0, a: b[7]?.[i], z: now[i] })).filter((r2) => r2.d >= 4).sort((a, b2) => b2.d - a.d).slice(0, 2);
      if (rj.length) sig.push({ w: rj.reduce((t, r2) => t + r2.d, 0) / 1.5, t: `his ${list(rj.map((r2) => `${RATING_WORDS[r2.k] || r2.k} (${r2.a} to ${r2.z})`))} took a big step` });
      const starters = STARTERS[x.position] || 1, nowRank = depthRank(x), moved = b[0] !== tk;
      const newStarter = nowRank > 0 && nowRank <= starters && (moved || b[4] > starters);
      if (newStarter) {
        const gone = Object.values(bp).filter((v) => v[0] === tk && v[3] === x.position && v[4] > 0 && v[4] <= starters && !allRos.some((y) => y.name === v[5] && y.team_key === tk));
        sig.push({ w: 9, t: moved ? `landed at ${tTok(tk)} through the portal and walks into a starting job` : gone.length ? `slides into the starting lineup with ${list(gone.map((v) => v[5]))} gone` : `is penciled in as a starter for the first time` });
      }
      const pr = baseline.teams?.[tk];
      if (newStarter || nowRank <= starters) {
        if (["QB", "WR", "TE"].includes(x.position) && pr?.[0] && pr[0] <= 25) sig.push({ w: 5, t: `${tName(tk)} threw it more than almost anyone last year (${ord(pr[0])} in passing yards per game)` });
        if (["HB"].includes(x.position) && pr?.[1] && pr[1] <= 25) sig.push({ w: 5, t: `${tName(tk)} leans on the run game (${ord(pr[1])} in rushing yards per game last year)` });
      }
      const sr = styleRank(x);
      if (sr && sr.rank <= Math.max(10, sr.of * 0.15)) sig.push({ w: 4, t: `his ${String(x.archetype).toLowerCase()} skill set fits a scheme that ranks ${ord(sr.rank)} in ${String(sr.stat).toLowerCase()}` });
      if (["WR", "TE"].includes(x.position) && st.receiveReceptions >= 8 && st.receivingYards / st.receiveReceptions >= 15) sig.push({ w: 5, t: `he averaged ${(st.receivingYards / st.receiveReceptions).toFixed(1)} yards a catch in a limited role` });
      if (x.position === "HB" && st.rushAttempts >= 25 && st.rushYards / st.rushAttempts >= 5.5) sig.push({ w: 5, t: `he ran for ${(st.rushYards / st.rushAttempts).toFixed(1)} yards a carry as a backup` });
      if (x.position === "QB" && st.passAttempts >= 30 && st.passerRating >= 150) sig.push({ w: 5, t: `he posted a ${Math.round(st.passerRating)} passer rating in spot duty` });
      if (st.defenseSacks >= 3 && downsPg < 35) sig.push({ w: 5, t: `he piled up ${st.defenseSacks} sacks without starting` });
      if (st.defenseInterceptions >= 2 && downsPg < 35) sig.push({ w: 4, t: `he picked off ${st.defenseInterceptions} passes in part-time work` });
      if (/star|elite/i.test(x.dev_trait || "") && ["FR", "SO"].includes(x.class_year)) sig.push({ w: 3, t: `he carries a ${x.dev_trait} development trait` });
      const score = sig.reduce((t, s2) => t + s2.w, 0) + (userTeams.has(tk) ? 6 : 0) + (x.overall - 74) * 0.5;
      if (sig.length >= 2 && score >= 14) cands.push({ x, sig: sig.sort((a, b2) => b2.w - a.w), score, b, st });
    }
    cands.sort((a, b) => b.score - a.score);
    const perTeam = new Map(), breakouts = [];
    for (const c2 of cands) { const k = c2.x.team_key; if ((perTeam.get(k) || 0) >= 2) continue; perTeam.set(k, (perTeam.get(k) || 0) + 1); breakouts.push(c2); if (breakouts.length >= 12) break; }
    const bo = breakouts.map(({ x, sig, b, st }, i) => {
      const seed = x.player_key + "bw", PT = P(x.player_key, x.name), s = sig.slice(0, 3).map((z) => z.t);
      const lead = `${PT} ${s[0]}.`;
      const more = s.length > 1 ? ` ${pick(seed + "c", ["On top of that, ", "Better yet, ", "Add this: "])}${s.slice(1).join(", and ")}.` : "";
      const close = pick(seed + "z", [`Circle his name now.`, `By October, everyone will know it.`, `This is the year.`, `${tName(x.team_key)} fans are about to get a new favorite player.`, `Don't be surprised to see him on an all-conference team.`]);
      return { rank: i + 1, player: x.player_key, name: x.name, position: x.position, team: x.team_key, ovr: x.overall, was: b[1], class_year: x.class_year, archetype: x.archetype, user: userTeams.has(x.team_key),
        h: capH(`${PT}, ${yr[x.class_year] || ""} ${posW(x.position)}, ${tTok(x.team_key)}`), d: (lead + more).replace(/\s+/g, " ") + " " + close, last: statLine(x.position, st) };
    });
    offseason = (nil.length || bo.length) ? { season: cur.season, from_season: baseline.season, season_text: text, test: TEST || undefined,
      nil: { h: pick(String(cur.season) + "n", ["Show him the money: the 10 biggest NIL raises of the offseason", "Payday: who cashed in this offseason", "Pay raise season: the 10 biggest NIL jumps"]),
        d: nil.length ? `$${total}K in new money across the top 10${movedN ? `, and ${num(movedN)} of them changed schools to get it` : ""}. ${nil[0] ? `Nobody got a bigger bump than ${P(nil[0].player, nil[0].name)}: ${nil[0].before}K to ${nil[0].now}K.` : ""}` : "", list: nil },
      breakouts: { h: pick(String(cur.season) + "b", ["Breakout watch: 12 players ready to make the leap", "Next up: the breakout candidates for the new season", "Coming for your Saturdays: this year's breakout candidates"]),
        d: "Rating jumps from offseason training, new starting jobs, scheme fits and what they did with limited snaps last year. These are the names to know before kickoff.", list: bo } } : null;
  } else if (wkNum === 0 && prevIdx.offseason) offseason = prevIdx.offseason; // keep the articles up through Week 0
  log(`Outlook: crystal ${crystal.length} (record ${rec.hits}-${rec.misses}), cfp ${cfp ? (cfp.final ? "final" : cfp.teams.length + " teams") : "off"}, offseason ${offseason ? `${offseason.nil.list.length} NIL / ${offseason.breakouts.list.length} breakouts` : "off"}${TEST ? " [TEST]" : ""}.`);
  return { crystal, crystal_record: rec, crystal_log, cfp, offseason };
}
