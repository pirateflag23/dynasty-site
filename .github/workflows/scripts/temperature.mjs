// Temperature: how hot each league team's fan base is running, plus a mock social feed (parody platforms)
// reacting to the latest results, decisions and storylines. Writes data/stories/<league>/temperature.json.
//
// The temperature itself is computed from the data (record vs. what the program expects, streaks, the last
// result, poll movement, portal losses, recruiting class). The feed is written by Claude from those facts,
// in fan voice: emotional, fickle, profane when it's earned. A feed is only rewritten when its team's
// situation changes (new game, new stage), so most syncs cost nothing. Without ANTHROPIC_API_KEY, or on
// any error, a template feed is used instead.
//
// League teams only. Fans roast performance, decisions and the program. Guardrails in the prompt: no
// slurs or attacks on who someone is, no threats or wishing harm/injury, no sexual content, nothing about
// players' private lives, nothing negative about high-school recruits, no invented quotes from real people,
// parody platform names and invented newspapers only.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const API = (process.env.DYNASTY_API_BASE || "https://dynasty.prestonchoate.dev/v1").replace(/\/$/, "");
const KEY = process.env.DYNASTY_API_KEY, AKEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.TEMP_MODEL || process.env.WRITER_MODEL || "claude-sonnet-5-5";
const ABASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
const log = (...a) => console.log("[temperature]", ...a);
const readJson = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (seed, arr) => arr[hash(seed) % arr.length];
const untok = (s) => String(s || "").replace(/\[\[\w:[^|\]]*\|([^\]]*)\]\]/g, "$1");
async function api(path, tries = 5) {
  for (let i = 1; ; i++) {
    let r;
    try { r = await fetch(API + path, { headers: { Authorization: `Bearer ${KEY}` } }); }
    catch (e) { if (i >= tries) throw e; await new Promise((s) => setTimeout(s, 5000 * i)); continue; }
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) { await new Promise((s) => setTimeout(s, (Number(r.headers.get("retry-after")) || 5 * i) * 1000)); continue; }
    throw new Error(`API ${path} → ${r.status}`);
  }
}
async function claude(system, user) {
  for (let i = 1; ; i++) {
    const r = await fetch(`${ABASE}/v1/messages`, { method: "POST", headers: { "x-api-key": AKEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 6000, system, messages: [{ role: "user", content: user }] }) });
    if (r.ok) return (await r.json()).content.filter((c) => c.type === "text").map((c) => c.text).join("");
    if ((r.status === 429 || r.status >= 500) && i < 4) { await new Promise((s) => setTimeout(s, 4000 * i)); continue; }
    throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

if (!KEY) { log("no DYNASTY_API_KEY, skipping"); process.exit(0); }
const cfg = await readJson("discord.config.json", {});
const [league, standings, sched, members] = await Promise.all([api("/league"), api("/standings"), api("/schedule?played=true"), api("/members")]);
const LID = league.data?.league_id ?? league.league_id;
const cur = league.data.current_period;
const DIR = `data/stories/${LID}`, FILE = `${DIR}/temperature.json`;
await mkdir(DIR, { recursive: true });
const prev = await readJson(FILE, { teams: {} });
const latest = await readJson(`${DIR}/latest.json`, {});
const classes = await api("/recruits/classes").catch(() => ({ data: [] }));
const byKey = new Map(standings.data.map((t) => [t.team_key, t]));
const coachOf = (name, tk) => cfg.coaches?.[name] || members.data.find((m) => m.team_key === tk)?.user_name || "the coach";
const userTeams = [...new Set(members.data.map((m) => m.team_key))].filter((k) => byKey.has(k));
const off = /OFF/i.test(cur.season_text || ""), pre = /PRE/i.test(cur.season_text || "");
const phase = off ? "offseason" : pre ? "preseason" : "season";

// ---------- the thermometer ----------
const BANDS = [[90, "Boiling over", "Torches and pitchforks"], [75, "Hot seat", "The patience is gone"], [60, "Warm", "Grumbling in the stands"],
  [40, "Lukewarm", "Cautious, could go either way"], [20, "Cool", "Fans like where this is going"], [0, "Ice cold", "In the coach we trust"]];
const band = (t) => BANDS.find(([min]) => t >= min);
const classRank = (tk) => { const rows = classes.data || []; const i = rows.findIndex((r) => (r.team_key ?? r.school?.team_key) === tk); return i >= 0 ? (rows[i].rank ?? i + 1) : null; };

function gameLog(tk) {
  return sched.data.filter((g) => g.played && (g.home.team_key === tk || g.away.team_key === tk)).sort((a, b) => a.week - b.week).map((g) => {
    const me = g.home.team_key === tk ? g.home : g.away, op = me === g.home ? g.away : g.home;
    return { key: g.key, week: g.week, wk: g.displayed_week, home: me === g.home, opp: op.team, oppKey: op.team_key, oppRank: me === g.home ? g.away.rank_at_game : g.home.rank_at_game,
      myRank: me.rank_at_game, us: me.score, them: op.score, win: me.score > op.score, oppUser: op.user_id > 0 };
  });
}
const lastWeek = Math.max(0, ...sched.data.filter((g) => g.played).map((g) => g.week));
const pollRank = (t) => (t?.rank && t.rank <= 25 ? t.rank : null); // the API ranks every team; only the Top 25 counts
function compute(tk) {
  const t = byKey.get(tk), gl = gameLog(tk), last = gl.at(-1), factors = [], rank = pollRank(t);
  const stars = t.prestige_stars ?? 2.5, E = 0.25 + 0.12 * stars, gp = t.wins + t.losses;
  let x = 45;
  if (gp) {
    const W = t.wins / gp, gap = (E - W) * (gp >= 4 ? 120 : 70);
    x = 50 + gap;
    factors.push(`${t.record} ${W >= E + 0.1 ? "beats" : W <= E - 0.1 ? "falls short of" : "is about"} what a ${stars}-star program expects`);
  } else factors.push(phase === "offseason" ? "Offseason: last season still sets the mood" : "No games yet");
  // streak
  let s = 0; for (let i = gl.length - 1; i >= 0 && gl[i].win === gl.at(-1).win; i--) s++;
  if (last && !off) {
    if (last.win) { x -= Math.min(16, 4 * s); if (s >= 3) factors.push(`Won ${s} straight`); }
    else { x += Math.min(28, 7 * s); factors.push(s >= 2 ? `Lost ${s} straight` : `Lost to ${last.opp}`); }
    const m = Math.abs(last.us - last.them);
    if (!last.win && m >= 21) { x += 8; factors.push(`Blown out by ${m}`); }
    const myR = last.myRank <= 25 ? last.myRank : null, opR = last.oppRank <= 25 ? last.oppRank : null;
    if (!last.win && myR && !opR) { x += 8; factors.push("Upset by an unranked team"); }
    if (last.win && opR) { x -= 8; factors.push(`Beat No. ${opR} ${last.opp}`); }
    if (last.win && m >= 28) x -= 3;
  }
  // won the last game of the whole season (the title game): champions
  if (last?.win && last.week === lastWeek && (off || last.week >= 19)) { x -= 18; factors.unshift("National champions"); }
  if (rank && rank <= 10) { x -= 8; factors.push(`Ranked No. ${rank}`); } else if (rank) { x -= 3; factors.push(`Ranked No. ${rank}`); }
  const was = prev.teams?.[tk];
  if (was?.rank && !rank && !off) { x += 8; factors.push("Fell out of the Top 25"); }
  // storylines
  const mine = (latest.portal || []).filter((p) => p.team === tk);
  const ex = mine.find((p) => p.kind === "gone" && !p.player), exN = ex ? +(/(\d+)/.exec(untok(ex.h))?.[1] || 0) : 0;
  if (exN >= 8) { x += Math.min(12, exN); factors.push(`${exN} lost to the portal`); } else if (exN >= 4) { x += 3; factors.push(`${exN} lost to the portal`); }
  const strug = mine.filter((p) => p.kind === "struggling").length; if (strug) { x += 3 * strug; factors.push(`${strug} starter${strug > 1 ? "s" : ""} under fire`); }
  const cr = classRank(tk);
  if (off || pre) { if (cr && cr <= 10) { x -= 8; factors.push(`No. ${cr} recruiting class`); } else if (cr && cr > 50) { x += 5; factors.push(`Recruiting class ranks No. ${cr}`); } }
  x = Math.max(2, Math.min(99, Math.round(x)));
  const temp = was?.temp != null && was.period !== cur.id ? Math.round(0.72 * x + 0.28 * was.temp) : was?.period === cur.id && was?.raw === x ? was.temp : x;
  return { t, gl, last, temp, raw: x, factors: factors.slice(0, 5), streak: last ? `${last.win ? "W" : "L"}${s}` : null, cr };
}

// ---------- feed writer ----------
const SYSTEM = `You write a mock social media feed for a college football video-game league site (EA College Football dynasty; every head coach is a real person in the league, playing as that school). The page is called "Temperature": it shows how the fan base feels right now.

Write like real, fickle, emotional college football fans online. Profanity is fine when it's earned (shit, damn, hell, ass, fuck); real fan energy, exaggeration, dark humor, overreaction to one game, bandwagoning, "I've had season tickets since 1987", rival fans trolling, recruiting-guru "sources", message-board conspiracy threads, complaining about ticket and concession prices, empty seats, noon kickoffs, refs, play-calling, the punter, wanting the backup QB, "fire the OC", "promote the coordinator, he can't be worse", "hire [a beloved former player of this school] as head coach" jokes, "we're so back", "trust the process". Match the mood to the temperature: cold = mostly happy and hopeful with a few worriers; lukewarm = split; hot = angry with a few defenders; boiling = venomous.

Hard rules:
- Use ONLY the facts given (records, scores, opponents, rankings, names). Don't invent other results, stats or transactions. Vibes, opinions, prices, crowd sizes and rumors may be invented.
- Criticize performance, decisions, effort and the program. Never: slurs or insults about race, religion, sexuality, gender, disability or other identity; threats or wishing injury/harm/death on anyone; sexual content; anything about players' families, looks or private lives; negativity about high-school recruits.
- The league coach may be roasted hard as a football coach (use his gamertag as a nickname sometimes), never personally.
- Never invent quotes attributed to real people. Former players may be wished for or mentioned, not quoted.
- Platforms are parodies only: "chirp" (short posts, like X), "facespace" (longer, older fans, like Facebook), "snapgram" (photo posts with a caption), "board" (message-board thread). Newspaper clippings use an invented local paper name (never a real outlet).

Return JSON only:
{"clip": null or {"paper": "invented paper name", "headline": "...", "dek": "one sentence"},
 "posts": [ {"platform": "chirp|facespace|snapgram|board", "name": "display name", "handle": "@handle (chirp/snapgram) or board username", "thread": "thread title (board only)", "text": "...", "likes": number, "replies": number, "reposts": number,
   "image": null or {"type": "stadium", "fill": 0-1, "caption": "..."} or {"type": "receipt", "place": "...", "items": [["item", 12.5], ...]} or {"type": "sign", "text": "handwritten sign text"} or {"type": "scoreboard", "home": "ABBR", "away": "ABBR", "hs": n, "as": n} } ] }
Write 12 posts: mix all four platforms, 2-3 snapgram posts with an image (a half-empty stadium when attendance would plausibly drop, a concessions receipt when people complain about cost, a fan sign, a scoreboard photo), 2-3 board threads. Include a clipping about half the time. Engagement numbers should fit the post (angry hot takes get the most). Keep chirps under 280 characters.`;

function facts(tk, c) {
  const t = c.t, recent = c.gl.slice(-4).map((g) => `${g.wk}: ${g.win ? "W" : "L"} ${g.us}-${g.them} ${g.home ? "vs" : "at"} ${g.oppRank && g.oppRank <= 25 ? `No. ${g.oppRank} ` : ""}${g.opp}${g.oppUser ? " (league coach)" : ""}`);
  const stories = [...(latest.games || []), ...(latest.portal || []), ...(latest.recruiting || [])].filter((s) => s.team === tk || (s.teams || []).includes?.(tk)).slice(0, 8).map((s) => `${untok(s.h)}${s.d ? `: ${untok(s.d)}` : ""}`.slice(0, 260));
  const b = band(c.temp);
  return { school: t.name, nickname: t.nickname, conference: t.conference, coach_gamertag: coachOf(t.name, tk), phase, stage: cur.season_text, record: t.record, conference_record: t.conference_record,
    rank: pollRank(t), prestige_stars: t.prestige_stars, team_overall: t.overall, streak: c.streak, recent_games: recent, recruiting_class_rank: c.cr,
    storylines: stories, temperature: `${c.temp}° (${b[1]}: ${b[2]})`, why: c.factors };
}

function templateFeed(tk, c) {
  const t = c.t, nm = t.nickname || t.name, coach = coachOf(t.name, tk), hot = c.temp >= 60, cold = c.temp < 40, seed = `${tk}:${cur.id}`, L = c.last;
  const res = L ? `${L.win ? "beat" : "lost to"} ${L.opp} ${L.us}-${L.them}` : "";
  const angry = [`${t.record}. at ${t.name}. somebody explain to me what the plan is`, `fire the OC. fire the DC. fire whoever picked the uniforms. ${t.record}`, `${coach} out here coaching like he's on rookie difficulty`,
    `promote the coordinator for the rest of the year, he cannot possibly be worse`, `I've had season tickets since 1994 and I have never been this embarrassed`, `the backup QB would have won that game and you all know it`];
  const happy = [`${t.record} and the vibes are immaculate. ${nm} football is BACK`, `${coach} has this program cooking. book the trip, we're going somewhere this year`, `remember when people wanted ${coach} gone? yeah me neither`,
    `this is the most fun I've had watching ${nm} football in a decade`, `recruits are watching this. ${t.name} is a destination again`];
  const mid = [`${t.record}. not great, not terrible. let's see what happens next week`, `can we run the ball more than twice a half please`, `defense showed up, offense took the day off. typical`];
  const bank = hot ? angry : cold ? happy : mid;
  const posts = [0, 1, 2, 3, 4].map((i) => ({ platform: i % 2 ? "facespace" : "chirp", name: pick(seed + i + "n", ["Big Mike", "Section 112", "Coach Armchair", "Tailgate Terry", `${nm}Fan84`, "Old Guard"]), handle: "@" + pick(seed + i + "h", ["sec112", "armchairqb", "tailgate_terry", "oldguard", "gameday_gary"]),
    text: (i === 0 && res ? `we ${res}. ` : "") + pick(seed + i, bank), likes: 40 + (hash(seed + i) % 900), replies: 5 + (hash(seed + i + "r") % 120), reposts: hash(seed + i + "p") % 200 }));
  if (hot) posts.push({ platform: "snapgram", name: "gameday_gary", handle: "@gameday_gary", text: `halftime. this is fine. everything is fine.`, likes: 812, replies: 140, reposts: 0, image: { type: "stadium", fill: 0.42, caption: "3rd quarter, home side" } },
    { platform: "snapgram", name: "dadof3", handle: "@dadof3_tailgates", text: `$108 to watch this team. never again (I'll be back next week)`, likes: 1204, replies: 230, reposts: 0, image: { type: "receipt", place: `${t.name} Stadium Concessions`, items: [["Hot dog x4", 32], ["Nachos x2", 22], ["Souvenir soda x4", 38], ["Water x2", 16]] } });
  else posts.push({ platform: "snapgram", name: "student_section", handle: "@studentsection", text: `the student section was LOUD tonight`, likes: 2310, replies: 88, reposts: 0, image: { type: "sign", text: cold ? `IN ${coach.toUpperCase()} WE TRUST` : `JUST WIN, BABY` } });
  posts.push({ platform: "board", name: `${nm}Lifer`, handle: `${nm}Lifer`, thread: hot ? `[Official] ${coach} hot seat thread` : `Postgame thread: ${res || "this week"}`, text: hot ? `Not saying it's time. Just saying the AD should have a list.` : `Good not great. Thoughts?`, likes: 64, replies: 311, reposts: 0 });
  return { clip: hot ? { paper: `The ${t.name} Courier`, headline: `AD backs ${coach} amid ${c.streak?.startsWith("L") ? "skid" : "rocky stretch"}`, dek: `The athletic director says the program is "headed in the right direction." Fans aren't so sure.` } : null, posts, template: true };
}

const out = { season: cur.season, period: cur.id, stage: cur.season_text, updated: new Date().toISOString(), teams: {} };
let wrote = 0;
for (const tk of userTeams) {
  const c = compute(tk), was = prev.teams?.[tk];
  const sig = hash(JSON.stringify(["v2", cur.id, c.t.record, c.last?.key, band(c.temp)[1], (latest.portal || []).filter((p) => p.team === tk).map((p) => p.id).sort()])).toString(36);
  let feed = was?.sig === sig ? was.feed : null;
  if (!feed && AKEY) {
    try {
      const raw = await claude(SYSTEM, JSON.stringify(facts(tk, c), null, 1));
      const j = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
      if (!Array.isArray(j.posts) || j.posts.length < 4) throw new Error("too few posts");
      feed = { clip: j.clip || null, posts: j.posts.slice(0, 16) }; wrote++;
    } catch (e) { log(`${c.t.name}: AI feed failed (${e.message}), using templates`); }
  }
  feed ||= was?.sig === sig ? was.feed : templateFeed(tk, c);
  const b = band(c.temp);
  const history = [...(was?.history || []).filter((h) => h.p !== cur.id), { p: cur.id, label: cur.season_text, temp: c.temp }].slice(-40);
  out.teams[tk] = { name: c.t.name, nickname: c.t.nickname, coach: coachOf(c.t.name, tk), record: c.t.record, rank: pollRank(c.t), temp: c.temp, raw: c.raw, period: cur.id,
    band: b[1], mood: b[2], factors: c.factors, prevTemp: history.length > 1 ? history.at(-2).temp : null, history, sig, feed, updated: was?.sig === sig ? was.updated : new Date().toISOString() };
}
await writeFile(FILE, JSON.stringify(out));
log(`${userTeams.length} teams, ${wrote} new AI feeds: ${Object.values(out.teams).map((t) => `${t.name} ${t.temp}°`).join(", ")}`);
