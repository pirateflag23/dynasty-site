// ODL Discord feed. Runs after every sync (GitHub Action) and posts what's new:
//   #final            box score for every game with a user team
//   #scores           weekly roundup once a week's games are all played
//   #top-25           poll after each advance, with movement
//   #heisman          weekly watch in-season; the winner card once he is named (last post of the season), quiet until Week 0
//   #big-performances standout stat lines from every FBS game
//   #recruiting       per-user-team recruiting report at each advance
//   #transfer-portal  portal entries and commitments
//   #players-of-the-week + conference channels (role ping)
//   #commish-board    one live message: RTA, unplayed games, autopilot
//   Matchups category one chat per user-vs-user game each week, with a preview
//
// Env: DYNASTY_API_KEY, DISCORD_BOT_TOKEN (required)
//      DRY_RUN=1  print instead of posting   REPLAY=final,top25,...  re-post latest
// Files: discord.config.json (settings), data/discord-state.json (what's been posted),
//        data/player-stats-all.json (from build-player-stats.mjs), data/bot/*.json (written for the slash bot)

import { currentGames } from "./current-games.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gameOfTheWeek, pickem, powerRankings, seriesFor, carouselCards, signingDay, recordDesk, positionRules } from "./league-extras.mjs";
// Graphics (PNG) need the packages in ./graphics — loaded lazily so text posts still work without them.
const graphics = () => import("./graphics/top25.mjs");
const finalGraphics = () => import("./graphics/final.mjs");
const matchupGraphics = () => import("./graphics/matchup.mjs");
const recruitingGraphics = () => import("./graphics/recruiting.mjs");
const scoresGraphics = () => import("./graphics/scores.mjs");
const potwGraphics = () => import("./graphics/potw.mjs");
const extraGraphics = () => import("./graphics/extras.mjs");

const API = (process.env.DYNASTY_API_BASE || "https://dynasty.prestonchoate.dev/v1").replace(/\/$/, "");
const KEY = process.env.DYNASTY_API_KEY;
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const DRY = !!process.env.DRY_RUN;
const REPLAY = new Set((process.env.REPLAY || "").split(",").map((s) => s.trim()).filter(Boolean));
const STATE_FILE = "data/discord-state.json";
const DC = "https://discord.com/api/v10";
const RED = 0xc8102e, GOLD = 0xf2b134, BLUE = 0x2b6cb0, GREEN = 0x2f9e44;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

/* ---------------- HTTP ---------------- */
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
    if ((r.status === 429 || r.status >= 500) && i < tries) { await sleep((Number(r.headers.get("retry-after")) || 5 * i) * 1000); continue; }
    throw new Error(`API ${path} → ${r.status} ${await r.text()}`);
  }
}
// files: [{ name, data: Buffer }] → sent as a multipart upload; embeds can show them with image.url "attachment://<name>"
async function dc(method, path, body, tries = 6, files = null) {
  if (DRY && method !== "GET") {
    log(`[dry] ${method} ${path}`, body ? JSON.stringify(body).slice(0, 4000) : "");
    if (files?.length) { await mkdir("graphics-preview", { recursive: true }); for (const f of files) { await writeFile(`graphics-preview/${f.name}`, f.data); log(`[dry] wrote graphics-preview/${f.name}`); } }
    return { id: "dry-" + Math.random().toString(36).slice(2) };
  }
  for (let i = 1; ; i++) {
    let reqBody, type = {};
    if (files?.length) {
      reqBody = new FormData();
      reqBody.append("payload_json", JSON.stringify({ ...body, attachments: files.map((f, n) => ({ id: n, filename: f.name })) }));
      files.forEach((f, n) => reqBody.append(`files[${n}]`, new Blob([f.data], { type: "image/png" }), f.name));
    } else { reqBody = body ? JSON.stringify(body) : undefined; type = { "Content-Type": "application/json" }; }
    const r = await fetch(DC + path, {
      method, body: reqBody,
      headers: { Authorization: `Bot ${TOKEN}`, ...type, "User-Agent": "DiscordBot (https://github.com, 1.0) ODL" },
    });
    if (r.status === 429 && i < tries) { const j = await r.json().catch(() => ({})); await sleep((j.retry_after || 1) * 1000 + 250); continue; }
    if (r.status >= 500 && i < tries) { await sleep(2000 * i); continue; }
    if (!r.ok) throw new Error(`Discord ${method} ${path} → ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j]); } }));
  return out;
}

/* ---------------- formatting helpers ---------------- */
const f1 = (v) => (v == null || !isFinite(v) ? "—" : (Math.round(v * 10) / 10).toFixed(1));
const n0 = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
const stars = (n) => "★".repeat(n || 0);
const pad = (s, n) => String(s).slice(0, n).padEnd(n);
const lpad = (s, n) => String(s).slice(0, n).padStart(n);
const rk = (r) => (r > 0 && r <= 25 ? `#${r} ` : "");
const chunk = (a, n) => a.reduce((o, x, i) => (i % n ? o[o.length - 1].push(x) : o.push([x]), o), []);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const mmss = (sec) => `${Math.floor((sec || 0) / 60)}:${String((sec || 0) % 60).padStart(2, "0")}`;
// Split lines into embed descriptions under Discord's 4096-char limit.
function pages(lines, max = 3900) {
  const out = [""];
  for (const l of lines) { if ((out[out.length - 1] + l).length + 1 > max) out.push(""); out[out.length - 1] += l + "\n"; }
  return out.filter((s) => s.trim());
}

/* ---------------- main ---------------- */
async function main() {
  if (!KEY) throw new Error("DYNASTY_API_KEY must be set");
  const cfg = JSON.parse(await readFile("discord.config.json", "utf8"));
  if (!TOKEN && !DRY) { log("DISCORD_BOT_TOKEN secret not set yet — skipping Discord posts."); return; }
  if (!/^\d{15,22}$/.test(cfg.guild_id || "")) { log("guild_id not set in discord.config.json — skipping Discord posts."); return; }
  let state, seeding = false;
  try { state = JSON.parse(await readFile(STATE_FILE, "utf8")); } catch { state = { posted: {}, chats: {} }; seeding = true; }
  state.posted ??= {}; state.chats ??= {};
  const seen = (k) => !!state.posted[k];
  const mark = (k) => { state.posted[k] = new Date().toISOString().slice(0, 10); };

  /* ---- load league data ---- */
  const [league, schedule, standings, teamStats, members, awards, periods] = await Promise.all([
    api("/league"), api("/schedule"), api("/standings"), api("/team-stats"), api("/members"), api("/awards"), api("/periods"),
  ]);
  const cur = league.data.current_period;
  const prevPeriod = periods.data.find((p) => p.id !== cur.id);
  const standingsPrev = prevPeriod ? await api(`/standings?period=${prevPeriod.id}`).catch(() => null) : null;
  const games = currentGames(schedule.data, league.data.current_period?.season);
  const teams = new Map(standings.data.map((t) => [t.team_key, t]));
  const tstats = new Map(teamStats.data.map((t) => [t.team_key, t]));
  const byTeamId = new Map(teamStats.data.map((t) => [t.team_id, t.team_key]));
  const userTeams = new Set(members.data.map((m) => m.team_key));
  const memberByTeam = new Map(members.data.map((m) => [m.team_key, m]));
  const coachId = (teamKey) => { const id = cfg.coaches?.[teams.get(teamKey)?.name]; return /^\d{15,22}$/.test(id || "") ? id : null; }; // ignores blanks/placeholders
  const coachTag = (teamKey) => { const id = coachId(teamKey); const m = memberByTeam.get(teamKey); return id ? `<@${id}>` : m ? disp(m.user_name) : "CPU"; };
  const site = (hash) => `${cfg.site_url.replace(/\/$/, "")}/#${hash}`;
  const tName = (k) => teams.get(k)?.name || tstats.get(k)?.name || "?";
  const isUserGame = (g) => g.kind !== "cpu_vs_cpu";
  // Postseason weeks are labeled by WEEK, not by the first unplayed bowl's name: every bowl in a week shares
  // one week number, so the old label changed as each bowl was played (Cure Bowl → Poinsettia Bowl …) and
  // re-posted #schedule and the @everyone advance card for what was really the same week.
  //   conference title week → "Conference Championships"; bowl weeks → "Bowl Week 1/2/3" with the CFP round
  //   as a sub-line (weekRound); title game week → "National Championship".
  const NY6 = new Set(["Peach Bowl", "Rose Bowl", "Fiesta Bowl", "Cotton Bowl", "Orange Bowl", "Sugar Bowl"]);
  const postWeek = (() => {
    const byW = new Map();
    for (const g of games) if (g.bowl_name) (byW.get(g.week) || byW.set(g.week, []).get(g.week)).push(g.bowl_name);
    const info = new Map();
    let n = 0;
    for (const w of [...byW.keys()].sort((a, b) => a - b)) {
      const names = byW.get(w);
      if (names.includes("National Championship")) { info.set(w, { label: "National Championship", round: "" }); continue; }
      if (names.every((b) => /Championship$/.test(b))) { info.set(w, { label: "Conference Championships", round: "" }); continue; }
      const cfp = names.filter((b) => b.startsWith("CFP") || NY6.has(b));
      const round = cfp.some((b) => /First Round/i.test(b)) ? "CFP First Round" : cfp.length >= 3 ? "CFP Quarterfinals" : cfp.length ? "CFP Semifinals" : "";
      info.set(w, { label: `Bowl Week ${++n}`, round });
    }
    return info;
  })();
  const weekLabel = (g) => (g && postWeek.get(g.week)?.label) || g?.displayed_week || `Week ${g?.week}`;
  const weekRound = (g) => (g && postWeek.get(g.week)?.round) || "";
  const withRound = (label, g) => (weekRound(g) ? `${label} · ${weekRound(g)}` : label);

  // Logo versions from the site's logo store (same one the site's League admin page uploads to).
  let logos = null;
  let rivalryNames = null; // rivalries.json pairs → name, loaded on first preview
  async function logoMap() {
    if (logos) return logos;
    logos = {};
    if (cfg.logo_base) try { const r = await fetch(`${cfg.logo_base.replace(/\/$/, "")}/logos`); if (r.ok) logos = await r.json(); } catch { /* optional */ }
    return logos;
  }
  const logoFor = (name, map) => map[name] != null && cfg.logo_base ? `${cfg.logo_base.replace(/\/$/, "")}/logo/${encodeURIComponent(name)}?v=${map[name]}` : "";


  let allPlayers = [];
  try {
    const j = JSON.parse(await readFile("data/player-stats-all.json", "utf8"));
    for (const p of j.data) for (const k of j.stat_keys) p.stats[k] ??= 0;
    allPlayers = j.data;
  } catch { log("No data/player-stats-all.json yet; previews will skip player leaders."); }

  /* ---- Discord guild lookup ---- */
  let chan = {}, roles = {}, allRoleNames = [], botId = null, guild = cfg.guild_id, allChans = [];
  if (!DRY || TOKEN) {
    const [chs, rls, me] = await Promise.all([dc("GET", `/guilds/${guild}/channels`), dc("GET", `/guilds/${guild}/roles`), dc("GET", "/users/@me")]);
    allChans = chs;
    for (const c of chs) chan[`${c.type}:${c.name.toLowerCase()}`] = c.id;
    for (const r of rls) { roles[r.name.toLowerCase()] = r.id; roles[`~${r.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`] = r.id; }
    allRoleNames = rls.map((r) => r.name);
    botId = me.id;
    // Bot display name: account username (Discord allows ~2 changes/hour) + server nickname so it shows right away.
    if (cfg.bot_name) {
      if (me.username !== cfg.bot_name) await dc("PATCH", "/users/@me", { username: cfg.bot_name }).then(() => log(`bot username → ${cfg.bot_name}`)).catch((e) => log("bot username change failed (will retry next sync):", e.message));
      const mine = await dc("GET", `/guilds/${guild}/members/${me.id}`).catch(() => null);
      if (mine && mine.nick !== cfg.bot_name) await dc("PATCH", `/guilds/${guild}/members/@me`, { nick: cfg.bot_name }).then(() => log(`bot nickname → ${cfg.bot_name}`)).catch((e) => log("bot nickname change failed:", e.message));
    }
    // coaches map accepts a numeric Discord ID or a plain username; usernames are looked up once and cached in state.
    state.coach_ids ??= {};
    for (const [team, v] of Object.entries(cfg.coaches || {})) {
      if (!v || /^\d{15,22}$/.test(v)) continue;
      const q = String(v).replace(/^@/, "").toLowerCase();
      if (state.coach_ids[q]) { cfg.coaches[team] = state.coach_ids[q]; continue; }
      try {
        const found = await dc("GET", `/guilds/${guild}/members/search?query=${encodeURIComponent(q)}&limit=10`);
        const m = found.find((x) => [x.user.username, x.nick, x.user.global_name].some((n) => n && n.toLowerCase() === q)) || (found.length === 1 ? found[0] : null);
        if (m) { state.coach_ids[q] = m.user.id; cfg.coaches[team] = m.user.id; }
        else log(`⚠️  Could not match Discord user "${v}" for ${team}`);
      } catch (e) { log(`⚠️  Member lookup failed for "${v}": ${e.message}`); }
    }
  }
  // Server display names (nickname → display name → username) for each mapped coach, keyed by gamertag, so posts and
  // the site say "Andy" instead of "agerm40". Kept across seasons/job changes; published to data/coach-names.json.
  state.display_names ??= {};
  if (!DRY || TOKEN) {
    const byName = new Map([...teams.values()].map((t) => [String(t.name).toLowerCase(), t.team_key]));
    for (const [team, id] of Object.entries(cfg.coaches || {})) {
      if (!/^\d{15,22}$/.test(id || "")) continue;
      const gt = memberByTeam.get(byName.get(team.toLowerCase()))?.user_name;
      if (!gt || gt === "CPU") continue;
      const m = await dc("GET", `/guilds/${guild}/members/${id}`).catch(() => null);
      const dn = m && (m.nick || m.user?.global_name || m.user?.username);
      if (dn) state.display_names[gt.toLowerCase()] = { gt, name: dn };
    }
    if (!DRY) await writeFile("data/coach-names.json", JSON.stringify(Object.fromEntries(Object.values(state.display_names).map((v) => [v.gt, v.name])), null, 1)).catch(() => {});
  }
  const disp = (gt) => (gt && state.display_names[String(gt).toLowerCase()]?.name) || gt || "";
  const textCh = (name) => (name ? chan[`0:${name.toLowerCase()}`] || chan[`5:${name.toLowerCase()}`] : null) || (DRY ? `#${name}` : null);
  const warnedRoles = new Set();
  // names are matched ignoring case, spaces and punctuation ("B-10" = "b10"); extra names are fallbacks
  const roleId = (name, ...alts) => {
    for (const n of [name, ...alts].filter(Boolean)) { const id = roles[n.toLowerCase()] || roles[`~${n.toLowerCase().replace(/[^a-z0-9]/g, "")}`]; if (id) return id; }
    if (name && !DRY && !warnedRoles.has(name)) { warnedRoles.add(name); log(`⚠️  Discord role "${name}" not found, so nobody gets pinged/assigned it. Roles on the server: ${allRoleNames.join(", ") || "(none)"}`); }
    return name && DRY ? `@${name}` : null;
  };
  const missing = new Set();
  async function send(chName, payload) {
    const id = textCh(chName);
    if (!id) { if (!missing.has(chName)) log(`⚠️  Channel #${chName} not found — skipping its posts.`); missing.add(chName); return false; }
    // Discord allows 10 embeds and 6000 characters per message: split as needed.
    const esz = (e) => (e.title || "").length + (e.description || "").length + (e.footer?.text || "").length + (e.fields || []).reduce((a, f) => a + f.name.length + f.value.length, 0);
    const parts = []; let cur_ = [], sz = 0;
    for (const e of payload.embeds || []) {
      const n = esz(e);
      if (cur_.length && (cur_.length === 10 || sz + n > 5800)) { parts.push(cur_); cur_ = []; sz = 0; }
      cur_.push(e); sz += n;
    }
    if (cur_.length || !parts.length) parts.push(cur_);
    for (let i = 0; i < parts.length; i++) {
      await dc("POST", `/channels/${id}/messages`, {
        content: i === 0 ? payload.content : undefined, embeds: parts[i],
        allowed_mentions: payload.allowed_mentions || { parse: [] },
        components: i === parts.length - 1 ? payload.components : undefined,
      }, 6, i === 0 ? payload.files : null);
    }
    return true;
  }
  // Post `build()` to a channel once per key. During the first run (seeding) everything that
  // already exists is just marked as seen, so the channels don't get flooded with history.
  async function once(key, feature, chName, build) {
    const replay = REPLAY.has(feature) && !state._replayed?.[feature + chName];
    if (seen(key) && !replay) return;
    if (seeding && !replay) { mark(key); return; }
    const payload = await build();
    if (!payload) return;
    if (await send(chName, payload)) { mark(key); if (replay) (state._replayed ??= {})[feature + chName] = true; log(`posted ${key}`); }
  }

  // shared context for league-extras.mjs
  const { short } = await import("./graphics/common.mjs");
  const loadRivals = async () => {
    if (!rivalryNames) { rivalryNames = new Map(); try { for (const [a, b, n] of JSON.parse(await readFile("rivalries.json", "utf8")).rivalries || []) { rivalryNames.set(`${a}|${b}`, n); rivalryNames.set(`${b}|${a}`, n); } } catch { /* optional */ } }
    return rivalryNames;
  };
  await loadRivals();
  const X = { api, dc, roleId, teamKeyById: (id) => byTeamId.get(id), channelId: (n) => textCh(n), lid: league.league_id ?? league.data.league_id, cfg, cur, games, teams, userTeams, state, DRY, log, short, rk, site, once, send, seen, mark, seeding,
    replay: (f) => REPLAY.has(f), tName, coachName: (k) => coachName(k), logoFor, logoMap: () => logoMap(), pickChannel: (v) => pickChannel(v),
    siteLogo: () => gfxSiteLogo(), colors: () => gfxColors(), nowWeek: () => nowWeek(), lastResult: (k) => lastResult(k),
    rivalryName: (g) => rivalryNames.get(`${g.away.team}|${g.home.team}`) || "",
    lastResults: (k, n) => games.filter((g) => g.played && (g.home.team_key === k || g.away.team_key === k)).sort((a, b) => b.week - a.week).slice(0, n)
      .map((g) => { const me = g.home.team_key === k ? g.home : g.away, o = me === g.home ? g.away : g.home; return me.score > o.score ? "W" : me.score < o.score ? "L" : "T"; }),
    nextOpp: (k) => { const g = games.filter((q) => !q.played && (q.home.team_key === k || q.away.team_key === k)).sort((a, b) => a.week - b.week)[0]; if (!g) return ""; const home = g.home.team_key === k, o = home ? g.away : g.home; return `${home ? "vs" : "@"} ${rk(teams.get(o.team_key)?.rank)}${o.team}${userTeams.has(o.team_key) ? ` (${coachName(o.team_key)})` : ""}`; } };

  state.abbr ??= {};
  const abbr = (k) => state.abbr[k] || (() => { const w = tName(k).replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean); return (w.length > 1 ? w.map((x) => x[0]).join("") : w[0] || "?").slice(0, 4).toUpperCase(); })();
  // Save progress even if a later step fails, so nothing is posted twice.
  try {
  /* ---- box scores for played games we haven't posted ---- */
  const played = games.filter((g) => g.played && g.has_box_score);
  const needBox = played.filter((g) => (isUserGame(g) && (!seen(`final:${g.key}`) || !seen(`big:${g.key}`))) || REPLAY.size);
  const latestFirst = [...needBox].sort((a, b) => b.week - a.week);
  const boxList = seeding && !REPLAY.size ? [] : await pool(REPLAY.size ? [...latestFirst.filter(isUserGame).slice(0, 12), ...latestFirst.filter((g) => !isUserGame(g)).slice(0, 28)] : needBox, 4, (g) => api(`/games/${g.key}`).then((r) => r.data).catch(() => null));
  const box = new Map(boxList.filter(Boolean).map((d) => [d.key, d.box_score]));
  for (const [gk, b] of box) { const g = games.find((x) => x.key === gk); if (g && b?.Home?.Abbrev) { state.abbr[g.home.team_key] = b.Home.Abbrev; state.abbr[g.away.team_key] = b.Away.Abbrev; } }

  /* ============ #final ============ */
  for (const g of [...played].filter(isUserGame).sort((a, b) => b.week - a.week)) {
    await once(`final:${g.key}`, "final", cfg.channels.final, () => box.get(g.key) && finalPost(g, box.get(g.key)));
  }

  /* ============ #big-performances ============ */
  const bpLines = [], bpRows = [];
  for (const g of played.filter(isUserGame)) {
    if (seen(`big:${g.key}`) && !REPLAY.has("big")) continue;
    if (seeding && !REPLAY.has("big")) { mark(`big:${g.key}`); continue; }
    const b = box.get(g.key); if (!b) continue;
    const lines = bigPerformances(g, b, cfg.big_performances || {}, bpRows);
    bpLines.push(...lines); mark(`big:${g.key}`);
  }
  if (REPLAY.has("big") && bpLines.length > 20) { bpLines.length = 20; bpRows.length = 20; }
  if (bpLines.length) await send(cfg.channels.big_performances, await bigPerfPost(bpLines, bpRows));

  /* ============ #scores weekly roundup ============ */
  const weeksDone = [...new Set(games.map((g) => g.week))].filter((w) => games.filter((g) => g.week === w).every((g) => g.played));
  for (const w of weeksDone.sort((a, b) => b - a).slice(0, 3)) {
    // key by the games' own season: the league's calendar year flips to the new season before the schedule does
    const gs = games.find((g) => g.week === w)?.season || cur.season || league.data.calendar_year;
    await once(`scores:${gs}:${w}`, "scores", cfg.channels.scores, () => scoresPost(w));
  }

  /* ============ #top-25 ============ */
  if (standings.period?.id === cur.id) {
    // offseason stages don't move the poll: only re-post when the order actually changes
    const off = /OFF/i.test(cur.season_text || "");
    const pollSig = standings.data.filter((t) => t.rank && t.rank <= 25).sort((a, b) => a.rank - b.rank).map((t) => t.team_key).join(",");
    if (!off || state.top25Sig !== pollSig) await once(`top25:${cur.id}`, "top25", cfg.channels.top25, () => top25Embed());
    if (!DRY) state.top25Sig = pollSig;
  }

  /* ============ #announcements: "we have advanced" card, once per new week ============ */
  {
    const open = games.filter((g) => !g.played);
    const ow = open.length ? Math.min(...open.map((g) => g.week)) : null;
    const og = ow != null ? open.find((g) => g.week === ow) : null;
    const wkText = nowWeek();
    const ch = pickChannel(cfg.channels.announcements);
    if (ch) await once(`advance:${cur.season}:${wkText}`, "advance", ch, async () => {
      const p = await advancePost(wkText);
      return cfg.advance_ping_everyone === false ? p : { ...p, content: "@everyone", allowed_mentions: { parse: ["everyone"] } };
    });
  }

  /* ============ #on-deck / #schedule: next week's league games, once per new week ============ */
  {
    const open = games.filter((g) => !g.played);
    const weeks = [...new Set(open.map((g) => g.week))].sort((a, b) => a - b);
    // #schedule: the week being played now (same games as the matchup chats)
    const nowW = weeks[0], sch = pickChannel(cfg.channels.schedule);
    if (sch && nowW != null) {
      const label = weekLabel(open.find((g) => g.week === nowW));
      await once(`schedule:${cur.season}:${label}`, "schedule", sch, () => ondeckPost(games.filter((g) => g.week === nowW && isUserGame(g)), label, "schedule", weekRound(open.find((g) => g.week === nowW))));
    }
    // #on-deck: the week after that, held until on_deck_delay_hours after the advance (the dispatcher runs a sync then)
    const nextW = weeks[1];
    const ch = pickChannel(cfg.channels.on_deck);
    const advancedAt = Date.parse(cur.first_seen_at || "") || 0;
    const onDeckReady = REPLAY.has("ondeck") || Date.now() - advancedAt >= (cfg.on_deck_delay_hours ?? 60) * 3600e3;
    if (ch && nextW != null && onDeckReady) {
      const ng = open.filter((g) => g.week === nextW && isUserGame(g));
      const label = weekLabel(open.find((g) => g.week === nextW));
      await once(`ondeck:${cur.season}:${label}`, "ondeck", ch, () => ondeckPost(ng, label, "ondeck", weekRound(open.find((g) => g.week === nextW))));
    }
  }

  /* ============ Game of the Week, Pick'em, Coach Power Rankings ============ */
  {
    const open = games.filter((g) => !g.played);
    const nowW = open.length ? Math.min(...open.map((g) => g.week)) : null;
    if (nowW != null) {
      const wg = games.filter((g) => g.week === nowW && isUserGame(g)), label = weekLabel(open.find((g) => g.week === nowW));
      await gameOfTheWeek(X, wg, label).catch((e) => log(`GOTW failed: ${e.message}`));
      await pickem(X, wg, label, nowW).catch((e) => log(`Pick'em failed: ${e.message}`));
    }
    await powerRankings(X).catch((e) => log(`Power rankings failed: ${e.message}`));
    await carouselCards(X).catch((e) => log(`Carousel failed: ${e.message}`));
    await signingDay(X).catch((e) => log(`Signing Day failed: ${e.message}`));
    await recordDesk(X).catch((e) => log(`Record desk failed: ${e.message}`));
    await positionRules(X).catch((e) => log(`Position rules failed: ${e.message}`));
  }

  /* ============ #heisman: weekly watch in-season → one winner card → quiet until Week 0 ============ */
  // Once the game names the season's Heisman winner (late season / CFP), that card is the season's last
  // #heisman post. Weekly watch posts stay off through the offseason and pick back up with the new
  // season's first (Week 0 preseason) ranking.
  if (cfg.channels.heisman) {
    const [heis, hist] = await Promise.all([api("/awards/heisman").catch(() => null), api("/history").catch(() => ({ data: [] }))]);
    const winner = heismanWinner(hist.data, cur.season);
    if (winner) await once(`heisman-winner:${cur.season}`, "heisman_winner", cfg.channels.heisman, () => heismanWinnerPost(winner, heis?.data || []));
    else if (/\bOFF\b/i.test(cur.season_text || "")) log("Heisman watch paused for the offseason.");
    else if (heis?.data?.length && (heis.period?.id ?? cur.id) === cur.id) await once(`heisman:${cur.id}`, "heisman", cfg.channels.heisman, () => heismanPost(heis.data));
  }

  /* ============ #headlines (TD Wire stories written earlier in this workflow) ============ */
  if (cfg.channels.headlines) {
    let wire = null;
    try { wire = JSON.parse(await readFile(`data/stories/${league.league_id ?? league.data.league_id}/latest.json`, "utf8")); } catch { /* none yet */ }
    if (wire && wire.period?.id === cur.id) await once(`headlines:${cur.id}`, "headlines", cfg.channels.headlines, () => headlinesPost(wire));
  }

  /* ============ Players of the week ============ */
  const awardWeeks = [...new Set(awards.data.map((a) => `${a.season}:${a.week}`))];
  const wkNum = (s) => s.split(":").map(Number);
  awardWeeks.sort((a, b) => wkNum(b)[0] - wkNum(a)[0] || wkNum(b)[1] - wkNum(a)[1]);
  for (const wk of awardWeeks.slice(0, 3)) {
    const list = awards.data.filter((a) => `${a.season}:${a.week}` === wk);
    await once(`potw:${wk}:National`, "potw", cfg.channels.potw, () => potwPost(list, "National"));
    for (const [conf, c] of Object.entries(cfg.conferences || {})) {
      await once(`potw:${wk}:${conf}`, "potw", c.channel, async () => {
        const e = await potwPost(list, conf); if (!e) return null;
        // No conference role ping (the advance post already pings @everyone). Set ping_conference_roles: true to bring it back.
        const r = cfg.ping_conference_roles ? roleId(c.role, conf, conf.replace(/\s+/g, ""), conf === "Big Ten" ? "B1G" : null) : null;
        return { ...e, content: r ? `<@&${r}>` : undefined, allowed_mentions: { roles: r && !DRY ? [r] : [] } };
      });
    }
  }

  /* ============ Recruiting (weekly, per user team) ============ */
  const classes = await api("/recruits/classes").catch(() => null);
  if (classes && (classes.period?.id ?? cur.id) === cur.id) {
    await once(`recruit:${cur.id}`, "recruiting", cfg.channels.recruiting, () => recruitingPost(classes));
  }

  /* ============ Transfer portal ============ */
  await transferPortal();

  /* ============ Matchup chats + previews ============ */
  await matchupChats();

  /* ============ Conference roles for coaches ============ */
  await syncRoles();

  /* ============ Commish board (one message, edited every run) ============ */
  await commishBoard();

  /* ---- data for the slash-command bot ---- */
  await writeBotData();

  if (seeding) log("First run: marked existing games/awards/commits as already posted (no backlog flood).");
  } finally {
    delete state._replayed;
    await mkdir("data", { recursive: true });
    await writeFile(STATE_FILE, JSON.stringify(state, null, 1));
  }

  /* =================== builders =================== */

  function sideLeaders(b, teamKey) {
    const ps = b.Players.filter((p) => p.Team === teamKey);
    const top = (k) => ps.filter((p) => p.Stats[k] > 0).sort((a, c) => c.Stats[k] - a.Stats[k])[0];
    const out = [];
    const qb = top("passAttempts"); if (qb) { const s = qb.Stats; out.push(`🎯 **${qb.Name}** ${s.passCompletion}/${s.passAttempts}, ${s.passYards} yds, ${s.passTD} TD${s.passINT ? `, ${s.passINT} INT` : ""}`); }
    const rb = top("rushYards"); if (rb) { const s = rb.Stats; out.push(`🏃 **${rb.Name}** ${s.rushAttempts}-${s.rushYards}${s.rushTD ? `, ${s.rushTD} TD` : ""}`); }
    const wr = top("receivingYards"); if (wr) { const s = wr.Stats; out.push(`🙌 **${wr.Name}** ${s.receiveReceptions}-${s.receivingYards}${s.receiveTouchdowns ? `, ${s.receiveTouchdowns} TD` : ""}`); }
    const df = ps.filter((p) => p.Stats.defenseTotalTackles + p.Stats.defenseSacks * 3 + p.Stats.defenseInterceptions * 4 > 0)
      .sort((a, c) => (c.Stats.defenseTotalTackles + c.Stats.defenseSacks * 3 + c.Stats.defenseInterceptions * 4) - (a.Stats.defenseTotalTackles + a.Stats.defenseSacks * 3 + a.Stats.defenseInterceptions * 4))[0];
    if (df) { const s = df.Stats; out.push(`🛡️ **${df.Name}** ${s.defenseTotalTackles} tkl${s.defenseSacks ? `, ${s.defenseSacks} sk` : ""}${s.defenseInterceptions ? `, ${s.defenseInterceptions} INT` : ""}`); }
    return out.join("\n") || "—";
  }

  // Box score as a graphic; falls back to the text embed if rendering fails.
  async function finalPost(g, b) {
    const text = finalEmbed(g, b);
    if (cfg.graphics?.final === false) return text;
    try {
      const { renderFinal, leadersFor } = await finalGraphics();
      const { siteTeamColors } = await import("./graphics/common.mjs");
      const map = await logoMap();
      const coach = (sd) => { const t = g[sd], c = cfg.coaches?.[t.team]; return c && !/^\d{15,22}$/.test(c) ? c : t.user_name && t.user_name !== "CPU" ? disp(t.user_name) : ""; };
      const team = (sd, B) => ({ name: g[sd].team, abbrev: B.Abbrev, rank: g[sd].rank_at_game, score: g[sd].score, quarters: B.Quarters || [],
        coach: coach(sd), logo: logoFor(g[sd].team, map), stats: B.Stats || {}, leaders: leadersFor(b.Players, g[sd].team_key) });
      const name = `final-${g.key}.png`;
      const png = await renderFinal({
        week: weekLabel(g), date: [g.date, g.season || league.data.calendar_year].filter(Boolean).join(" · "),
        away: team("away", b.Away), home: team("home", b.Home),
        siteLogo: cfg.site_url ? `${cfg.site_url.replace(/\/$/, "")}/logo.png` : "", colors: await siteTeamColors("site/public/index.html"),
      });
      const e = text.embeds[0];
      return { embeds: [{ title: e.title, url: e.url, color: e.color, image: { url: `attachment://${name}` }, footer: e.footer }], files: [{ name, data: png }] };
    } catch (err) { log(`Final graphic failed for ${g.key}, posting text instead: ${err.message}`); return text; }
  }

  function finalEmbed(g, b) {
    const H = b.Home, A = b.Away, hk = g.home.team_key, ak = g.away.team_key;
    const win = g.home.score > g.away.score ? "home" : g.home.score < g.away.score ? "away" : null;
    const nm = (side) => `${rk(g[side].rank_at_game)}${g[side].team} ${g[side].score}`;
    const title = win === "away" ? `${nm("away")}, ${nm("home")}` : `${nm("home")}, ${nm("away")}`;
    const q = (t) => t.Quarters || [];
    const ot = q(H).length > 4 && (q(H)[4] || q(A)[4]);
    const hdr = `${pad("", 6)}${["1", "2", "3", "4"].concat(ot ? ["OT"] : []).map((x) => lpad(x, 4)).join("")}${lpad("T", 5)}`;
    const row = (t) => `${pad(t.Abbrev, 6)}${q(t).slice(0, ot ? 5 : 4).map((x) => lpad(x, 4)).join("")}${lpad(t.Score, 5)}`;
    const s = (t, k) => t.Stats?.[k] ?? 0;
    const st = [
      ["Total yds", (t) => s(t, "totalYardsGained") || s(t, "offYardsGained")],
      ["Pass", (t) => s(t, "offPassYards")], ["Rush", (t) => s(t, "offRushYards")],
      ["1st downs", (t) => s(t, "offFirstdown")],
      ["3rd down", (t) => `${s(t, "thirdDownConversions")}/${s(t, "thirdDowns")}`],
      ["Turnovers", (t) => s(t, "turnovers")],
      ["Penalties", (t) => `${s(t, "penalties")}-${s(t, "penaltyYards")}`],
      ["Possession", (t) => mmss(s(t, "possessionSeconds"))],
    ];
    const table = [`${pad("", 11)}${lpad(A.Abbrev, 7)}${lpad(H.Abbrev, 7)}`, ...st.map(([l, f]) => `${pad(l, 11)}${lpad(f(A), 7)}${lpad(f(H), 7)}`)].join("\n");
    return { embeds: [{
      title: `FINAL · ${title}`, url: site(`game/${g.key}`), color: RED,
      description: "```\n" + [hdr, row(A), row(H)].join("\n") + "\n```",
      fields: [
        { name: "Team stats", value: "```\n" + table + "\n```" },
        { name: `${A.Abbrev} leaders`, value: clip(sideLeaders(b, ak), 1024), inline: true },
        { name: `${H.Abbrev} leaders`, value: clip(sideLeaders(b, hk), 1024), inline: true },
      ],
      footer: { text: `${league.data.calendar_year} · ${weekLabel(g)} · ${g.away.team} (${disp(g.away.user_name)}) at ${g.home.team} (${disp(g.home.user_name)})` },
    }] };
  }

  // Graphic version of #big-performances (8 players per image, up to 10 images); text if rendering fails.
  async function bigPerfPost(lines, rows) {
    const text = { embeds: pages(lines).map((d, i) => ({ title: i ? undefined : "🔥 Big performances", description: d, color: GOLD })) };
    if (cfg.graphics?.big_performances === false || !rows.length) return text;
    try {
      const { renderBigPerformances } = await extraGraphics();
      const map = await logoMap(), colors = await gfxColors();
      const wk = [...new Set(rows.map((x) => x.week))];
      const chunks = []; for (let i = 0; i < rows.length && chunks.length < 10; i += 8) chunks.push(rows.slice(i, i + 8));
      const files = [];
      for (const [i, c] of chunks.entries()) {
        const png = await renderBigPerformances({ label: wk.length === 1 ? wk[0] : nowWeek(), sub: `${cur.season} season${chunks.length > 1 ? ` · ${i + 1}/${chunks.length}` : ""}`,
          rows: c.map((x) => ({ ...x, logo: logoFor(x.team, map) })), siteLogo: gfxSiteLogo(), colors });
        files.push({ name: `big-performances-${i + 1}.png`, data: png });
      }
      return { embeds: files.map((f, i) => ({ title: i ? undefined : "🔥 Big performances", color: GOLD, image: { url: `attachment://${f.name}` } })), files };
    } catch (err) { log(`Big performances graphic failed, posting text instead: ${err.message}`); return text; }
  }

  function bigPerformances(g, b, T, rowsOut = []) {
    const out = [];
    for (const p of b.Players) {
      if (!userTeams.has(p.Team)) continue; // user teams only
      const s = p.Stats, bits = [];
      if (s.passYards >= T.pass_yards || s.passTD >= T.pass_td) bits.push(`${s.passCompletion}/${s.passAttempts}, ${s.passYards} pass yds, ${s.passTD} TD`);
      if (s.rushYards >= T.rush_yards || s.rushTD >= T.rush_td) bits.push(`${s.rushAttempts} car, ${s.rushYards} rush yds, ${s.rushTD} TD`);
      if (s.receivingYards >= T.rec_yards || s.receiveTouchdowns >= T.rec_td) bits.push(`${s.receiveReceptions} rec, ${s.receivingYards} yds, ${s.receiveTouchdowns} TD`);
      if (s.defenseSacks >= T.sacks) bits.push(`${s.defenseSacks} sacks`);
      if (s.defenseInterceptions >= T.def_int) bits.push(`${s.defenseInterceptions} INT`);
      if (s.defenseTotalTackles >= T.tackles) bits.push(`${s.defenseTotalTackles} tackles`);
      const tds = (s.passTD || 0) + (s.rushTD || 0) + (s.receiveTouchdowns || 0);
      if (!bits.length && tds >= T.total_td) bits.push(`${tds} total TD (${[["pass", s.passTD], ["rush", s.rushTD], ["rec", s.receiveTouchdowns]].filter(([, v]) => v).map(([l, v]) => `${v} ${l}`).join(", ")})`);
      if (!bits.length) continue;
      const mine = p.Team === g.home.team_key ? g.home : g.away, opp = mine === g.home ? g.away : g.home;
      const res = mine.score > opp.score ? "W" : mine.score < opp.score ? "L" : "T";
      out.push(`**[${p.Name}](${site(`player/${p.Key}`)})** (${mine.team}) — ${bits.join(" · ")}  ·  ${res} ${mine.score}-${opp.score} vs ${opp.team} · ${weekLabel(g)}`);
      const ap = allPlayers.find((x) => x.player_key === p.Key);
      rowsOut.push({ name: ap ? [ap.first_name, ap.last_name].filter(Boolean).join(" ") || p.Name : p.Name, pos: ap?.position || "", jersey: ap?.jersey ?? null, ovr: ap?.overall || null,
        team: mine.team, rank: teams.get(mine.team_key)?.rank || 0, coach: coachName(mine.team_key), chips: bits, result: `${res} ${mine.score}-${opp.score}`,
        opp: `${mine === g.home ? "vs" : "at"} ${opp.team}`, week: weekLabel(g) });
    }
    return out;
  }

  function scoresEmbed(w) {
    const wg = games.filter((g) => g.week === w);
    const res = (g) => { const [W, L] = g.home.score >= g.away.score ? [g.home, g.away] : [g.away, g.home]; return { W, L }; };
    const line = (g) => { const { W, L } = res(g); return `**${rk(W.rank_at_game)}${W.team} ${W.score}**, ${rk(L.rank_at_game)}${L.team} ${L.score} · [box](${site(`game/${g.key}`)})`; };
    const user = wg.filter(isUserGame).map(line);
    const ranked = wg.filter((g) => !isUserGame(g) && ((g.home.rank_at_game || 99) <= 25 || (g.away.rank_at_game || 99) <= 25)).map(line);
    const upsets = wg.filter((g) => { const { W, L } = res(g); const wr = W.rank_at_game || 99, lr = L.rank_at_game || 99; return lr <= 25 && (wr > 25 || wr - lr >= 6); })
      .map((g) => { const { W, L } = res(g); return `😱 ${rk(W.rank_at_game) || "Unranked "}${W.team} over #${L.rank_at_game} ${L.team}, ${W.score}-${L.score}`; });
    const label = weekLabel(wg[0]);
    const embeds = [];
    if (user.length) embeds.push(...pages(user).map((d, i) => ({ title: i ? undefined : `🏈 ${label} scores · League games`, description: d, color: RED })));
    if (upsets.length) embeds.push({ title: "Upsets", description: pages(upsets)[0], color: GOLD });
    if (ranked.length) embeds.push(...pages(ranked).map((d, i) => ({ title: i ? undefined : "Top 25 around the country", description: d, color: BLUE })));
    return embeds.length ? { embeds } : null;
  }

  // Top 25 as an ESPN-style PNG; falls back to the text list if the graphic can't be rendered.
  async function top25Embed() {
    const text = top25Text();
    if (cfg.graphics?.top25 === false) return text;
    try {
      const { renderTop25, siteTeamColors } = await graphics();
      const prev = standingsPrev ? new Map(standingsPrev.data.map((t) => [t.team_key, t.rank])) : null;
      const map = await logoMap();
      const coachName = (k, name) => { const c = cfg.coaches?.[name]; return c && !/^\d{15,22}$/.test(c) ? c : disp(memberByTeam.get(k)?.user_name); };
      const teamsIn = standings.data.filter((t) => t.rank > 0 && t.rank <= 25).map((t) => ({
        rank: t.rank, name: t.name, conference: t.conference, record: t.record, user: userTeams.has(t.team_key),
        coach: userTeams.has(t.team_key) ? coachName(t.team_key, t.name) : "", logo: logoFor(t.name, map),
        prev: prev ? prev.get(t.team_key) || 0 : undefined,
      }));
      const ranked = (k) => { const r = teams.get(k)?.rank; return r > 0 && r <= 25; };
      const out = prev ? [...prev.entries()].filter(([k, r]) => r > 0 && r <= 25 && !ranked(k)).map(([k]) => tName(k)) : [];
      const png = await renderTop25({
        label: nowWeek(),
        sub: /^\d{4}/.test(cur.season_text) ? `${cur.season_text.slice(0, 4)} season` : "", teams: teamsIn, dropped: out,
        siteLogo: cfg.site_url ? `${cfg.site_url.replace(/\/$/, "")}/logo.png` : "",
        colors: await siteTeamColors("site/public/index.html"),
      });
      return { embeds: [{ title: `🏆 Top 25 · ${cur.season} ${nowWeek()}`, url: site("standings"), color: RED, image: { url: "attachment://top25.png" } }],
        files: [{ name: "top25.png", data: png }] };
    } catch (e) { log(`Top 25 graphic failed, posting text instead: ${e.message}`); return text; }
  }

  function top25Text() {
    const prev = new Map((standingsPrev?.data || []).map((t) => [t.team_key, t.rank]));
    const top = standings.data.filter((t) => t.rank > 0 && t.rank <= 25).sort((a, b) => a.rank - b.rank);
    const mv = (t) => { const p = prev.get(t.team_key); if (!p || p > 25) return "🆕"; return p === t.rank ? "—" : p > t.rank ? `▲${p - t.rank}` : `▼${t.rank - p}`; };
    const lines = top.map((t) => `\`${lpad(t.rank, 2)}\` ${userTeams.has(t.team_key) ? "**" : ""}${t.name}${userTeams.has(t.team_key) ? "** 🎮" : ""} (${t.record}) ${mv(t)}`);
    const out = [...prev.entries()].filter(([k, r]) => r > 0 && r <= 25 && !top.some((t) => t.team_key === k)).map(([k]) => tName(k));
    return { embeds: [{ title: `🏆 Top 25 · ${cur.season} ${nowWeek()}`, url: site("standings"), color: RED, description: lines.join("\n"),
      footer: out.length ? { text: `Dropped out: ${out.join(", ")}` } : undefined }] };
  }

  // Shared bits for the newer graphics.
  // (function declarations, not consts: they're called by posts that run earlier in main)
  function gfxSiteLogo() { return cfg.site_url ? `${cfg.site_url.replace(/\/$/, "")}/logo.png` : ""; }
  async function gfxColors() { return (await import("./graphics/common.mjs")).siteTeamColors("site/public/index.html"); }
  function coachName(k) { if (!userTeams.has(k)) return ""; const c = cfg.coaches?.[tName(k)]; return c && !/^\d{15,22}$/.test(c) ? c : disp(memberByTeam.get(k)?.user_name); }

  // Weekly scoreboard graphic; falls back to the text embeds.
  async function scoresPost(w) {
    const text = scoresEmbed(w);
    if (!text || cfg.graphics?.scores === false) return text;
    try {
      const { renderScores } = await scoresGraphics();
      const map = await logoMap();
      const wg = games.filter((g) => g.week === w);
      const side = (t) => ({ name: t.team, rank: t.rank_at_game, score: t.score, logo: logoFor(t.team, map), coach: coachName(t.team_key) });
      const G = (g) => ({ away: side(g.away), home: side(g.home) });
      const res = (g) => (g.home.score >= g.away.score ? [g.home, g.away] : [g.away, g.home]);
      const isUpset = (g) => { const [W, L] = res(g); const wr = W.rank_at_game || 99, lr = L.rank_at_game || 99; return lr <= 25 && (wr > 25 || wr - lr >= 6); };
      const bestRank = (g) => Math.min(g.home.rank_at_game || 99, g.away.rank_at_game || 99);
      const lgGames = wg.filter(isUserGame).map(G);
      const upsets = wg.filter((g) => !isUserGame(g) && isUpset(g)).sort((a, b) => bestRank(a) - bestRank(b)).map(G);
      const ranked = wg.filter((g) => !isUserGame(g) && !isUpset(g) && bestRank(g) <= 25).sort((a, b) => bestRank(a) - bestRank(b)).slice(0, 24).map(G);
      const png = await renderScores({ label: weekLabel(wg[0]), sub: `${wg[0]?.season || league.data.calendar_year} season`, league: lgGames, upsets, ranked, siteLogo: gfxSiteLogo(), colors: await gfxColors() });
      const name = `scores-${w}.png`;
      return { embeds: [{ title: text.embeds[0].title, url: site("scores"), color: RED, image: { url: `attachment://${name}` } }], files: [{ name, data: png }] };
    } catch (err) { log(`Scores graphic failed, posting text instead: ${err.message}`); return text; }
  }

  // First channel name in the list that exists in the server (lets "announcements" match a typo'd channel name).
  function pickChannel(v) {
    const names = (Array.isArray(v) ? v : [v]).filter(Boolean);
    return names.find((n) => chan[`0:${n.toLowerCase()}`] || chan[`5:${n.toLowerCase()}`]) || (DRY ? names[0] : null);
  }

  async function advancePost(wkText) {
    const seasons = [...(league.data.seasons || [])].map(Number).sort((a, b) => a - b); // API lists newest first
    const yr = seasons.indexOf(cur.season) >= 0 ? `Year ${seasons.indexOf(cur.season) + 1}` : "";
    const lines = cfg.advance_notes || ["Please try and schedule your game within 24hr", "Remember to include \"TheDynasty\" in your stream title"];
    const round = nowRound();
    const text = { embeds: [{ title: `📣 We have advanced to ${wkText}${round ? ` · ${round}` : ""}`, color: RED, description: [yr && `${yr} · ${cur.season} season`, ...lines.map((l) => `• ${l}`)].filter(Boolean).join("\n") }] };
    if (cfg.graphics?.advance === false) return text;
    try {
      const { renderAdvance } = await extraGraphics();
      const png = await renderAdvance({ week: wkText, round, year: yr, season: `${cur.season} Season`, lines: lines.map((l, i) => [["🗓️", "🎥"][i] || "📌", l]), siteLogo: gfxSiteLogo() });
      return { embeds: [{ ...text.embeds[0], description: undefined, image: { url: "attachment://advance.png" } }], files: [{ name: "advance.png", data: png }] };
    } catch (err) { log(`Advance graphic failed, posting text instead: ${err.message}`); return text; }
  }

  async function ondeckPost(ng, label, kind = "ondeck", round = "") {
    const isSched = kind === "schedule";
    const side = (t) => { const k = t.team_key, tm = teams.get(k) || {}; return { name: t.team, rank: tm.rank, record: tm.record, coach: coachName(k), logo: "" }; };
    const order = (g) => (g.kind === "user_vs_user" ? 0 : 1);
    const list = [...ng].sort((a, b) => order(a) - order(b) || Math.min(teams.get(a.home.team_key)?.rank || 99, teams.get(a.away.team_key)?.rank || 99) - Math.min(teams.get(b.home.team_key)?.rank || 99, teams.get(b.away.team_key)?.rank || 99));
    const line = (g) => { const A = side(g.away), H = side(g.home); return `${A.name}${A.record ? ` (${A.record})` : ""}${A.coach ? ` · ${A.coach}` : ""} **at** ${H.name}${H.record ? ` (${H.record})` : ""}${H.coach ? ` · ${H.coach}` : ""}`; };
    const text = { embeds: [{ title: `${isSched ? "📅 This week" : "🗓️ On deck"} · ${label}${round ? ` · ${round}` : ""}`, url: site("schedule"), color: RED, description: list.length ? clip(list.map(line).join("\n"), 3900) : "No league games that week." }] };
    if (cfg.graphics?.[kind] === false) return text;
    try {
      const { renderOnDeck } = await extraGraphics();
      const map = await logoMap();
      if (!rivalryNames) {
        rivalryNames = new Map();
        try { for (const [x, y, n] of JSON.parse(await readFile("rivalries.json", "utf8")).rivalries || []) { rivalryNames.set(`${x}|${y}`, n); rivalryNames.set(`${y}|${x}`, n); } } catch { /* optional */ }
      }
      const rivals = rivalryNames;
      const G = list.map((g) => { const a = side(g.away), h = side(g.home); a.logo = logoFor(a.name, map); h.logo = logoFor(h.name, map);
        return { away: a, home: h, uvu: g.kind === "user_vs_user", tag: rivals.get(`${g.away.team}|${g.home.team}`) || (g.kind === "user_vs_user" ? "Coach vs coach" : "") }; });
      const png = await renderOnDeck({ label, sub: `${round ? `${round} · ` : ""}${list.length} league game${list.length === 1 ? "" : "s"} · ${cur.season} season`, games: G, siteLogo: gfxSiteLogo(), colors: await gfxColors(),
        ...(isSched ? { heading: ["This", "Week"], foot: "Set your game time in your matchup chat · red outline = coach vs coach" } : {}) });
      return { embeds: [{ title: text.embeds[0].title, url: text.embeds[0].url, color: RED, image: { url: `attachment://${kind}.png` } }], files: [{ name: `${kind}.png`, data: png }] };
    } catch (err) { log(`${kind} graphic failed, posting text instead: ${err.message}`); return text; }
  }

  async function heismanPost(list) {
    const lines = list.map((h) => `\`${lpad(h.rank, 2)}\` **${h.name}** ${h.position} · ${rk(h.team_rank)}${h.team_name}${h.user_team ? " 🎮" : ""}${h.new ? " 🆕" : h.movement ? (h.movement > 0 ? ` ▲${h.movement}` : ` ▼${-h.movement}`) : ""}\n　${String(h.stat_line).replace(/\n/g, " · ")}`);
    const text = { embeds: [{ title: `🏆 Heisman watch · ${nowWeek()}`, color: GOLD, description: pages(lines)[0] }] };
    if (cfg.graphics?.heisman === false) return text;
    try {
      const { renderHeisman } = await extraGraphics();
      const map = await logoMap();
      const players = list.slice(0, 10).map((h) => { const team = tName(h.team_key) !== "?" ? tName(h.team_key) : h.team_name;
        return { rank: h.rank, name: h.name, pos: h.position, cls: h.class_year, team, rank_t: h.team_rank, logo: logoFor(team, map), last: h.last_game, stat: h.stat_line, isNew: h.new, move: h.movement, user: h.user_team || userTeams.has(h.team_key) }; });
      const png = await renderHeisman({ label: nowWeek(), players, siteLogo: gfxSiteLogo(), colors: await gfxColors() });
      return { embeds: [{ title: text.embeds[0].title, color: GOLD, image: { url: "attachment://heisman.png" } }], files: [{ name: "heisman.png", data: png }] };
    } catch (err) { log(`Heisman graphic failed, posting text instead: ${err.message}`); return text; }
  }

  // The season's Heisman Trophy from /history (kind "award"), or null if it hasn't been awarded yet.
  function heismanWinner(list, season) {
    return (list || []).find((h) => h.kind === "award" && /heisman/i.test(h.title || "") && +h.season === +season) || null;
  }
  async function heismanWinnerPost(w, watch) {
    const tk = w.team?.team_key, team = (tk && tName(tk) !== "?" ? tName(tk) : w.team?.name) || "";
    const last = String(w.name).split(" ").slice(-1)[0].toLowerCase(), first = String(w.name)[0]?.toLowerCase();
    const p = allPlayers.find((x) => x.team_key === tk && String(x.last_name).toLowerCase() === last && String(x.first_name)[0]?.toLowerCase() === first);
    const wl = watch.find((h) => h.name === w.name && (!tk || h.team_key == null || h.team_key === tk));
    const st = teams.get(tk), user = userTeams.has(tk);
    const { heismanStatTiles } = await extraGraphics();
    const stats = p ? heismanStatTiles(w.position, p.stats) : [];
    const statText = stats.length ? stats.map(([l, v]) => `**${v}** ${l}`).join(" · ") : String(wl?.stat_line || "").replace(/\n/g, " · ");
    const text = { embeds: [{ title: `🏆 ${cur.season} Heisman Trophy winner`, color: GOLD,
      description: `**${w.name}** · ${w.position} · ${rk(st?.rank)}${team}${user ? ` 🎮 ${coachTag(tk)}` : ""}${st?.record ? ` (${st.record})` : ""}\n${statText}\n\n_Final Heisman update of the ${cur.season} season. The watch returns in Week 0._` }] };
    if (cfg.graphics?.heisman === false) return text;
    try {
      const { renderHeismanWinner } = await extraGraphics();
      const png = await renderHeismanWinner({ season: cur.season, name: w.name, pos: w.position, cls: wl?.class_year || "", team, rank_t: st?.rank, record: st?.record || "",
        coach: user ? disp(memberByTeam.get(tk)?.user_name) : "", logo: logoFor(team, await logoMap()), user, stats, line: wl?.stat_line || "",
        trophy: cfg.heisman_trophy || "", siteLogo: gfxSiteLogo(), colors: await gfxColors() });
      return { content: user && coachId(tk) ? `Congrats ${coachTag(tk)} 🏆` : undefined, allowed_mentions: { users: user && coachId(tk) && !DRY ? [coachId(tk)] : [] }, embeds: [{ title: text.embeds[0].title, color: GOLD, image: { url: "attachment://heisman-winner.png" } }],
        files: [{ name: "heisman-winner.png", data: png }] };
    } catch (err) { log(`Heisman winner graphic failed, posting text instead: ${err.message}`); return text; }
  }

  async function headlinesPost(wire) {
    const { plain } = await extraGraphics();
    // Best stories of the week: up to 2 game stories, 2 recruiting, 1 portal, then fill to 5 by score; league-coach stories first.
    const by = (k) => [...(wire[k] || [])].sort((a, b) => (!!b.user - !!a.user) || (b.score || 0) - (a.score || 0));
    const picked = [...by("games").slice(0, 2), ...by("recruiting").slice(0, 2), ...by("portal").slice(0, 1)];
    for (const s of [...by("games"), ...by("recruiting"), ...by("portal")].sort((a, b) => (b.score || 0) - (a.score || 0))) { if (picked.length >= 5) break; if (!picked.includes(s)) picked.push(s); }
    if (!picked.length) return null;
    const stories = picked.slice(0, 5).map((s) => ({ kick: s.kick || s.cat || "", h: s.h, d: s.d, user: !!s.user }));
    const text = { embeds: [{ title: `📰 Around the league · ${nowWeek()}`, url: site("home"), color: BLUE, description: clip(stories.map((s) => `**${plain(s.h)}**\n${plain(s.d)}`).join("\n\n"), 3900) }] };
    if (cfg.graphics?.headlines === false) return text;
    try {
      const { renderHeadlines } = await extraGraphics();
      const png = await renderHeadlines({ label: nowWeek(), stories, siteLogo: gfxSiteLogo() });
      return { embeds: [{ title: text.embeds[0].title, url: text.embeds[0].url, color: BLUE, image: { url: "attachment://headlines.png" } }], files: [{ name: "headlines.png", data: png }] };
    } catch (err) { log(`Headlines graphic failed, posting text instead: ${err.message}`); return text; }
  }
  function prettyWeek(t) { return (/\d{4}\s+(.*)/.exec(t)?.[1] || t).replace(/\bWk\b/, "Week").replace(/\bOFF Stg\b/, "Offseason Stage"); }
  // The week everyone sees in-game right now: the displayed label of the next unplayed week (what the
  // matchup chats and the advance post use). The API's period text runs one ahead ("Wk 8" during Week 7).
  function nowWeek() {
    const open = games.filter((g) => !g.played);
    if (!open.length) return prettyWeek(cur.season_text || ""); // offseason: no unplayed games left
    const w = Math.min(...open.map((g) => g.week));
    return weekLabel(open.find((g) => g.week === w));
  }
  function nowRound() {
    const open = games.filter((g) => !g.played);
    if (!open.length) return "";
    const w = Math.min(...open.map((g) => g.week));
    return weekRound(open.find((g) => g.week === w));
  }

  // Players of the week card for one conference (or National); falls back to the text embed.
  async function potwPost(list, conf) {
    const text = potwEmbed(list, conf);
    if (!text || cfg.graphics?.potw === false) return text;
    try {
      const { renderPotw } = await potwGraphics();
      const map = await logoMap();
      const a = list.filter((x) => x.conference === conf).sort((x, y) => (x.award.startsWith("Off") ? 0 : 1) - (y.award.startsWith("Off") ? 0 : 1));
      const players = a.map((x) => ({ side: x.award.startsWith("Off") ? "Offense" : "Defense", name: x.name, pos: x.position, jersey: x.jersey, cls: x.class_year, ovr: x.overall,
        team: tName(x.team_key) !== "?" ? tName(x.team_key) : x.team_name, rank: x.team_rank, logo: logoFor(tName(x.team_key) !== "?" ? tName(x.team_key) : x.team_name, map),
        game: x.game, stat: x.stat_line, user: userTeams.has(x.team_key), coach: coachName(x.team_key) }));
      const png = await renderPotw({ label: text.embeds[0].title.split(" · ").pop(), scope: conf, players, siteLogo: gfxSiteLogo(), colors: await gfxColors() });
      const name = `potw-${conf.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      return { embeds: [{ title: text.embeds[0].title, color: text.embeds[0].color, image: { url: `attachment://${name}` } }], files: [{ name, data: png }] };
    } catch (err) { log(`POTW graphic failed (${conf}), posting text instead: ${err.message}`); return text; }
  }

  function potwEmbed(list, conf) {
    const a = list.filter((x) => x.conference === conf);
    if (!a.length) return null;
    const off = (x) => (x.award.startsWith("Off") ? 0 : 1);
    const f = a.sort((x, y) => off(x) - off(y)).map((x) => ({
      name: `${x.award.startsWith("Off") ? "⚡ Offense" : "🧱 Defense"}`,
      value: `**[${x.name}](${site(`player/${x.player_key}`)})** · ${x.position} · ${rk(x.team_rank)}${x.team_name}${userTeams.has(x.team_key) ? " 🎮" : ""}\n${x.game}\n\`${String(x.stat_line).replace(/\n/g, " · ")}\``,
    }));
    const wk = a[0].week; const g = games.find((x) => x.week === wk + 1);
    return { embeds: [{ title: `${conf === "National" ? "🇺🇸 National" : conf} Players of the Week · ${g ? weekLabel(g) : `Week ${wk}`}`, color: conf === "National" ? GOLD : BLUE, fields: f }] };
  }

  // Recruiting report as one graphic; falls back to the text embeds.
  async function recruitingPost(cls) {
    const text = await recruitingEmbeds(cls);
    const { _raw: R } = text; delete text._raw;
    if (cfg.graphics?.recruiting === false) return text;
    try {
      const { renderRecruiting } = await recruitingGraphics();
      const { siteTeamColors } = await import("./graphics/common.mjs");
      const map = await logoMap();
      const nameOf = (x) => { const k = byTeamId.get(x?.team_id); return k ? tName(k) : x?.name || "?"; };
      const isUser = (x) => !!x && R.userIds.has(x.team_id);
      const classes = cls.data.slice(0, 10).map((c) => ({ rank: c.rank, name: c.name, prev: prevPeriod ? R.prevRank.get(c.team_key) || 0 : undefined,
        user: userTeams.has(c.team_key), total: c.commits.total, five: c.commits.five_star, four: c.commits.four_star, points: c.points, logo: logoFor(c.name, map) }));
      const pick = R.thisWeek.filter((c) => c.kind === "commit" || c.kind === "sign").sort((a, b) => (isUser(b.school) - isUser(a.school)) || (!!b.previous_school - !!a.previous_school) || R.byStar(a, b));
      const commits = pick.slice(0, 8).map((c) => ({ stars: c.stars, pos: c.position, name: c.name, rank: c.national_rank, state: c.state,
        school: nameOf(c.school), logo: logoFor(nameOf(c.school), map), user: isUser(c.school), from: c.previous_school ? nameOf(c.previous_school) : "" }));
      const battles = R.board.data.filter((r) => (r.top_schools || []).filter((x) => x.influence > 0).length >= 2).sort(R.byStar).slice(0, 5).map((r) => ({
        stars: r.stars, pos: r.position, name: r.name, rank: r.national_rank, state: r.state,
        schools: r.top_schools.slice(0, 3).filter((x) => x.influence > 0).map((x) => ({ name: nameOf(x), logo: logoFor(nameOf(x), map), inf: x.influence, user: isUser(x) })) }));
      const png = await renderRecruiting({
        label: nowWeek(),
        sub: cls.data[0]?.class_year ? `${cls.data[0].class_year} recruiting class` : "",
        classes, commits, battles,
        siteLogo: cfg.site_url ? `${cfg.site_url.replace(/\/$/, "")}/logo.png` : "", colors: await siteTeamColors("site/public/index.html"),
      });
      return { embeds: [{ title: `📋 Recruiting · ${cur.season} ${nowWeek()}`, url: site("recruiting"), color: GREEN, image: { url: "attachment://recruiting.png" } }],
        files: [{ name: "recruiting.png", data: png }] };
    } catch (err) { log(`Recruiting graphic failed, posting text instead: ${err.message}`); return text; }
  }

  async function recruitingEmbeds(cls) {
    // One league-wide report per advance: top classes, top battles, biggest commits, flips.
    const prevCls = prevPeriod ? await api(`/recruits/classes?period=${prevPeriod.id}`).catch(() => null) : null;
    const prevRank = new Map((prevCls?.data || []).map((c) => [c.team_key, c.rank]));
    const [commits, board] = await Promise.all([api("/recruits/commits?type=recruits"), api("/recruits?type=recruits&committed=false")]);
    const thisWeek = commits.data.filter((c) => c.period_id === cur.id);
    const userIds = new Set([...userTeams].map((k) => tstats.get(k)?.team_id).filter(Boolean));
    const sch = (x) => (x && userIds.has(x.team_id) ? `**${x.name}** 🎮` : x?.name || "?");
    const who = (r) => `${stars(r.stars)} ${r.position} **${r.name}** (#${r.national_rank}${r.state ? `, ${r.state}` : ""})`;
    const byStar = (a, b) => (b.stars || 0) - (a.stars || 0) || (a.national_rank || 9999) - (b.national_rank || 9999);

    const classes = cls.data.slice(0, 10).map((c) => {
      const pr = prevRank.get(c.team_key);
      const mv = !pr ? "" : pr === c.rank ? " —" : pr > c.rank ? ` ▲${pr - c.rank}` : ` ▼${c.rank - pr}`;
      return `\`${lpad(c.rank, 2)}\` ${userTeams.has(c.team_key) ? `**${c.name}** 🎮` : c.name}${mv} · ${c.commits.total} commits (★5 ${c.commits.five_star} · ★4 ${c.commits.four_star}) · ${f1(c.points)} pts`;
    });
    const battles = board.data.filter((r) => (r.top_schools || []).filter((x) => x.influence > 0).length >= 2).sort(byStar).slice(0, 10).map((r) => {
      const [a, b] = r.top_schools;
      return `${who(r)}\n　${sch(a)} ${a.influence} vs ${sch(b)} ${b.influence}${r.top_schools[2]?.influence ? ` · ${r.top_schools[2].name} ${r.top_schools[2].influence}` : ""}`;
    });
    const biggest = thisWeek.filter((c) => (c.kind === "commit" && !c.previous_school) || c.kind === "sign").sort(byStar).slice(0, 10)
      .map((c) => `${c.kind === "sign" ? "✍️" : "✅"} ${who(c)} → ${sch(c.school)}`);
    const flips = thisWeek.filter((c) => c.kind === "commit" && c.previous_school).sort(byStar)
      .map((c) => `🔄 ${who(c)}: ${sch(c.previous_school)} → ${sch(c.school)}`);

    const sec = (title, lines, empty, color) => ({ title, color, description: (lines.length ? pages(lines)[0] : empty) });
    return { _raw: { prevRank, thisWeek, board, userIds, byStar }, embeds: [
      sec(`📋 Recruiting · ${cur.season} ${nowWeek()} · Top 10 classes`, classes, "No classes yet.", GREEN),
      sec("⚔️ Top 10 recruiting battles", battles, "No contested recruits right now.", GOLD),
      sec("✅ Biggest commitments this week", biggest, "No new commitments this week.", BLUE),
      sec("🔄 Flips", flips, "No flips this week.", RED),
    ] };
  }

  async function transferPortal() {
    const [moves, pool_] = await Promise.all([api("/recruits/commits?type=transfers").catch(() => ({ data: [] })), api("/recruits?type=transfers").catch(() => ({ data: [] }))]);
    const fromName = (r) => (typeof r.transfer_from === "string" ? r.transfer_from : r.transfer_from?.name) || "?";
    const fromKey = (r) => (r.transfer_from?.team_id ? byTeamId.get(r.transfer_from.team_id) : standings.data.find((t) => t.name === fromName(r))?.team_key);
    const lines = [];
    const entries = [];
    for (const r of pool_.data) {
      const k = `portal-in:${r.prospect_key}`;
      if (seen(k) && !REPLAY.has("portal")) continue;
      mark(k); if (seeding && !REPLAY.has("portal")) continue;
      entries.push(r);
    }
    // Only the top 50 new entrants by portal rank; the full list was too long to read. User-team players stay bold.
    const rankOf = (r) => (Number.isFinite(+r.national_rank) && +r.national_rank > 0 ? +r.national_rank : Infinity);
    entries.sort((a, b) => rankOf(a) - rankOf(b) || (b.stars || 0) - (a.stars || 0));
    for (const r of entries.slice(0, 50)) {
      const user = userTeams.has(fromKey(r));
      lines.push(`📥 ${user ? "**🎮 " : ""}${stars(r.stars)} ${r.position} ${r.name}${user ? "**" : ""} entered from **${fromName(r)}** (#${r.national_rank} overall)`);
    }
    for (const m of moves.data) {
      const k = `portal-mv:${m.prospect_key}:${m.kind}:${m.school?.team_id || ""}`;
      if (seen(k) && !REPLAY.has("portal")) continue;
      mark(k); if (seeding && !REPLAY.has("portal")) continue;
      if (m.kind !== "sign") continue; // signings only: commits/flips/decommits doubled an already long list
      // User-team signings only: all-FBS signings ran ~2k lines and nobody read them.
      if (!userTeams.has(byTeamId.get(m.school?.team_id))) continue;
      lines.push(`✍️ Signed with **🎮 ${m.school?.name || ""}**: ${stars(m.stars)} ${m.position} ${m.name}${m.previous_school ? ` (was ${m.previous_school.name})` : ""}`);
    }
    if (REPLAY.has("portal") && lines.length > 25) lines.length = 25;
    if (lines.length) await send(cfg.channels.portal, { embeds: pages(lines).map((d, i) => ({ title: i ? undefined : `🔁 Transfer portal · ${cur.season} ${nowWeek()}`, description: d, color: BLUE })) });
  }

  function lastResult(tk) {
    const p = games.filter((x) => x.played && (x.home.team_key === tk || x.away.team_key === tk)).sort((a, b) => b.week - a.week)[0];
    if (!p) return ""; const me = p.home.team_key === tk ? p.home : p.away, o = me === p.home ? p.away : p.home;
    return `${me.score > o.score ? "W" : me.score < o.score ? "L" : "T"} ${me.score}-${o.score} ${me === p.home ? "vs" : "@"} ${o.team}`;
  }

  // Preview card graphic for a matchup chat; falls back to the text embed.
  async function previewPost(g) {
    const text = { embeds: [previewEmbed(g)] };
    if (cfg.graphics?.matchups === false) return text;
    try {
      const { renderMatchup, seasonLeaders } = await matchupGraphics();
      const { siteTeamColors } = await import("./graphics/common.mjs");
      if (!rivalryNames) {
        rivalryNames = new Map();
        try { for (const [a, b, n] of JSON.parse(await readFile("rivalries.json", "utf8")).rivalries || []) { rivalryNames.set(`${a}|${b}`, n); rivalryNames.set(`${b}|${a}`, n); } } catch { /* optional */ }
      }
      const map = await logoMap();
      const team = (sd) => {
        const k = g[sd].team_key, t = teams.get(k) || {}, gp = (t.wins || 0) + (t.losses || 0);
        const c = cfg.coaches?.[g[sd].team];
        return { name: g[sd].team, rank: t.rank, record: t.record, confRecord: t.conference_record, conference: t.conference,
          ovr: t.overall, off: t.offense, def: t.defense, ppg: gp ? t.points_for / gp : null, oppg: gp ? t.points_against / gp : null,
          last: lastResult(k), logo: logoFor(g[sd].team, map), leaders: seasonLeaders(allPlayers, k),
          coach: userTeams.has(k) ? (c && !/^\d{15,22}$/.test(c) ? c : disp(memberByTeam.get(k)?.user_name)) : "" };
      };
      const A = team("away"), H = team("home");
      const tag = rivalryNames.get(`${g.away.team}|${g.home.team}`) || (g.kind === "user_vs_user" ? "League matchup" : "");
      const name = `preview-${g.key}.png`;
      const note = g.kind === "user_vs_user" ? "Set your game time in this chat · stream it in #live-stream" : "CPU opponent · play it before the advance · stream it in #live-stream";
      const series = cfg.graphics?.series === false ? null : await seriesFor(X, g).catch(() => null);
      const png = await renderMatchup({ week: weekLabel(g), date: [g.date, g.season || league.data.calendar_year].filter(Boolean).join(" · "), tag, note, away: A, home: H, series,
        siteLogo: cfg.site_url ? `${cfg.site_url.replace(/\/$/, "")}/logo.png` : "", colors: await siteTeamColors("site/public/index.html") });
      const e = text.embeds[0];
      return { embeds: [{ title: e.title, url: e.url, color: e.color, image: { url: `attachment://${name}` } }], files: [{ name, data: png }] };
    } catch (err) { log(`Preview graphic failed for ${g.key}, posting text instead: ${err.message}`); return text; }
  }

  function previewEmbed(g) {
    const A = g.away.team_key, H = g.home.team_key;
    const ta = teams.get(A) || {}, th = teams.get(H) || {}, sa = tstats.get(A)?.stats || {}, sh = tstats.get(H)?.stats || {};
    const rows = [
      ["Record", ta.record, th.record], ["Rank", ta.rank > 0 && ta.rank <= 25 ? `#${ta.rank}` : "NR", th.rank > 0 && th.rank <= 25 ? `#${th.rank}` : "NR"],
      ["OVR/OFF/DEF", `${ta.overall}/${ta.offense}/${ta.defense}`, `${th.overall}/${th.offense}/${th.defense}`],
    ];
    const table = [`${pad("", 14)}${lpad(abbr(A), 10)}${lpad(abbr(H), 10)}`, ...rows.map(([l, a, h]) => `${pad(l, 14)}${lpad(a ?? "—", 10)}${lpad(h ?? "—", 10)}`)].join("\n");
    const leaders = (tk) => {
      const ps = allPlayers.filter((p) => p.team_key === tk);
      const top = (k) => ps.filter((p) => p.stats[k] > 0).sort((a, b) => b.stats[k] - a.stats[k])[0];
      const out = [];
      const qb = top("passYards"); if (qb) out.push(`🎯 ${qb.name} ${n0(qb.stats.passYards)} yds, ${qb.stats.passTD} TD, ${qb.stats.passINT} INT`);
      const rb = top("rushYards"); if (rb) out.push(`🏃 ${rb.name} ${n0(rb.stats.rushYards)} yds, ${rb.stats.rushTD} TD`);
      const wr = top("receivingYards"); if (wr) out.push(`🙌 ${wr.name} ${wr.stats.receiveReceptions}-${n0(wr.stats.receivingYards)}, ${wr.stats.receiveTouchdowns} TD`);
      const tk_ = top("defenseTotalTackles"); if (tk_) out.push(`🛡️ ${tk_.name} ${tk_.stats.defenseTotalTackles} tkl`);
      const sk = top("defenseSacks"); if (sk) out.push(`💥 ${sk.name} ${sk.stats.defenseSacks} sack${sk.stats.defenseSacks === 1 ? "" : "s"}`);
      return out.join("\n") || "No stats yet";
    };
    const last = (tk) => lastResult(tk) || "—";
    return {
      title: `${weekLabel(g)} preview · ${rk(ta.rank)}${g.away.team} at ${rk(th.rank)}${g.home.team}`, url: site(`game/${g.key}`), color: RED,
      description: `${g.date || ""} · Last: ${ta.name} ${last(A)} | ${th.name} ${last(H)}`,
      fields: [
        { name: "Tale of the tape", value: "```\n" + table + "\n```" },
        { name: `${ta.name} leaders`, value: clip(leaders(A), 1024), inline: true },
        { name: `${th.name} leaders`, value: clip(leaders(H), 1024), inline: true },
      ],
      footer: { text: "Schedule your game here. Final box score posts to #final after the next sync." },
    };
  }

  async function matchupChats() {
    // category name(s): first one that exists (renaming the category in Discord only needs a matching name here)
    const catNames = [cfg.channels.matchups_category].flat().filter(Boolean);
    const cat = catNames.map((n) => chan[`4:${n.toLowerCase()}`]).find(Boolean) || (DRY ? "cat" : null);
    if (!cat) { log(`⚠️  Category "${cfg.channels.matchups_category}" not found — skipping matchup chats.`); return; }
    const open = games.filter((g) => !g.played);
    if (!open.length) return;
    const wk = Math.min(...open.map((g) => g.week));
    const uvu = games.filter((g) => g.week === wk && isUserGame(g)); // user-vs-user AND user-vs-CPU
    const VIEW = 1 << 10, SEND = 1 << 11, EMBED = 1 << 14, ATTACH = 1 << 15, HIST = 1 << 16, REACT = 1 << 6;
    for (const g of uvu) {
      if (state.chats[g.key]) {
        // A coach who joined the server after their chat was made gets added to it.
        if (state.chats[g.key].gone) continue; // deleted by hand; leave it
        const have = state.chats[g.key].coaches || [];
        for (const id of [coachId(g.away.team_key), coachId(g.home.team_key)].filter((x) => x && !have.includes(x))) {
          await dc("PUT", `/channels/${state.chats[g.key].id}/permissions/${id}`, { type: 1, allow: String(VIEW | SEND | EMBED | ATTACH | HIST | REACT), deny: "0" })
            .then(() => { (state.chats[g.key].coaches ??= []).push(id); log(`added coach ${id} to chat ${state.chats[g.key].id}`); })
            .catch((e) => { if (/10003/.test(e.message)) state.chats[g.key].gone = true; else log("add coach to chat failed", e.message); });
        }
        continue;
      }
      const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const name = `${slug(weekLabel(g)).replace("week-", "wk")}-${slug(g.away.team)}-at-${slug(g.home.team)}`.slice(0, 95);
      const coaches = [coachId(g.away.team_key), coachId(g.home.team_key)].filter(Boolean);
      const overwrites = [
        { id: guild, type: 0, allow: String(VIEW | SEND | HIST | REACT), deny: "0" }, // whole league can see and talk; the two coaches get full rights below
        ...coaches.map((id) => ({ id, type: 1, allow: String(VIEW | SEND | EMBED | ATTACH | HIST | REACT), deny: "0" })),
        ...(botId ? [{ id: botId, type: 1, allow: String(VIEW | SEND | EMBED | HIST), deny: "0" }] : []),
        ...(roleId(cfg.commish_role) && !DRY ? [{ id: roleId(cfg.commish_role), type: 0, allow: String(VIEW | SEND | HIST), deny: "0" }] : []),
      ];
      if (seeding && !REPLAY.has("matchups")) { /* still create this week's chats on first run */ }
      const ch = await dc("POST", `/guilds/${guild}/channels`, { name, type: 0, parent_id: cat, topic: `${weekLabel(g)}: ${g.away.team} at ${g.home.team}. Set your game time here.`, permission_overwrites: overwrites });
      state.chats[g.key] = { id: ch.id, week: wk, coaches };
      const pv = await previewPost(g);
      await dc("POST", `/channels/${ch.id}/messages`, {
        content: g.kind === "user_vs_user"
          ? `${coachTag(g.away.team_key)} vs ${coachTag(g.home.team_key)} — your ${weekLabel(g)} matchup. Work out a time here; games stream in #live-stream.`
          : `${userTeams.has(g.away.team_key) ? coachTag(g.away.team_key) : `**${g.away.team}** (CPU)`} vs ${userTeams.has(g.home.team_key) ? coachTag(g.home.team_key) : `**${g.home.team}** (CPU)`} — ${weekLabel(g)}. CPU opponent: no scheduling needed, just play it before you advance.`,
        embeds: pv.embeds, allowed_mentions: { users: coaches },
      }, 6, pv.files);
      log(`created chat ${name}`);
    }
    // Clean up chats from older weeks (their box scores live in #final). Runs in the same sync that creates the new week's chats.
    const keep = cfg.matchups?.keep_previous_weeks ?? 1;
    for (const [gk, c] of Object.entries(state.chats)) {
      if (c.week < wk - keep) { await dc("DELETE", `/channels/${c.id}`).catch((e) => /10003/.test(e.message) || log("delete failed", e.message)); delete state.chats[gk]; }
    }
    // Also sweep the Matchups category for game chats the bot no longer tracks (e.g. made by an overlapping run),
    // so nothing from an old week lingers. Only "<team>-at-<team>" chats are touched; #schedule etc. are left alone.
    if (!keep) {
      const live = new Set(Object.values(state.chats).map((c) => c.id));
      for (const c of allChans) {
        if (c.parent_id === cat && c.type === 0 && /-at-/.test(c.name) && !live.has(c.id)) {
          await dc("DELETE", `/channels/${c.id}`).then(() => log(`removed old chat #${c.name}`)).catch((e) => /10003/.test(e.message) || log("delete failed", e.message));
        }
      }
    }
  }

  async function syncRoles() {
    state.roles ??= {};
    for (const [teamName, uid] of Object.entries(cfg.coaches || {})) {
      if (!/^\d{15,22}$/.test(uid)) continue;
      const t = standings.data.find((x) => x.name === teamName);
      const c = t && cfg.conferences?.[t.conference];
      const r = c && roleId(c.role, t.conference, t.conference.replace(/\s+/g, ""), t.conference === "Big Ten" ? "B1G" : null);
      if (!r || state.roles[uid] === r) continue;
      await dc("PUT", `/guilds/${guild}/members/${uid}/roles/${r}`).then(() => { state.roles[uid] = r; log(`role ${c.role} → ${teamName}`); }).catch((e) => log("role failed", teamName, e.message));
    }
  }

  async function commishBoard() {
    const id = textCh(cfg.channels.commish); if (!id) return;
    const rta = members.data.filter((m) => m.ready_to_advance).length;
    const open = games.filter((g) => !g.played); const wk = open.length ? Math.min(...open.map((g) => g.week)) : null;
    const lines = [...members.data].sort((a, b) => a.ready_to_advance - b.ready_to_advance || a.team_name.localeCompare(b.team_name)).map((m) => {
      const g = wk != null && games.find((x) => x.week === wk && (x.home.team_key === m.team_key || x.away.team_key === m.team_key));
      const game = !g ? "bye" : g.played ? `✅ ${m.game_result}` : `⏳ vs ${m.opponent}${state.chats[g.key] ? ` · <#${state.chats[g.key].id}>` : ""}`;
      return `${m.ready_to_advance ? "🟢" : "🔴"} **${m.team_name}** · ${coachTag(m.team_key)} · ${game}${m.auto_pilot !== "Off" ? " · 🤖 autopilot" : ""}${m.online ? "" : " · offline"}`;
    });
    const unplayed = wk == null ? [] : games.filter((g) => g.week === wk && isUserGame(g) && !g.played);
    const embed = {
      title: `🧑‍⚖️ Commish board · ${cur.season} ${nowWeek()}`, color: rta === members.data.length ? GREEN : RED,
      description: `**Ready to advance: ${rta}/${members.data.length}** · Unplayed league games: **${unplayed.length}**\n\n` + clip(lines.join("\n"), 3800),
      footer: { text: `Updated ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET · last sync ${league.data.last_sync_at}` },
    };
    const body = { embeds: [embed], allowed_mentions: { parse: [] } };
    if (state.commish_msg && !DRY) {
      try { await dc("PATCH", `/channels/${id}/messages/${state.commish_msg}`, body); return; } catch { /* deleted → repost */ }
    }
    const m = await dc("POST", `/channels/${id}/messages`, body);
    state.commish_msg = m.id;
  }

  async function writeBotData() {
    await mkdir("data/bot", { recursive: true });
    const idx = allPlayers.filter((p) => p.stats.gamesPlayed > 0).map((p) => {
      const s = p.stats;
      return { k: p.player_key, n: p.name, f: p.first_name, l: p.last_name, p: p.position, t: p.team_key, tn: tName(p.team_key), u: !!p.user_team, o: p.overall, j: p.jersey,
        s: Object.fromEntries(["gamesPlayed", "passCompletion", "passAttempts", "passYards", "passTD", "passINT", "passerRating", "rushAttempts", "rushYards", "rushTD", "receiveReceptions", "receivingYards", "receiveTouchdowns", "defenseTotalTackles", "defenseSacks", "defenseInterceptions", "defenseTacklesForLoss", "kickFieldGoalsMade", "kickFieldGoalAttempts", "puntsAverage", "punts"].filter((k) => s[k]).map((k) => [k, s[k]])) };
    });
    const cats = { passing: "passYards", rushing: "rushYards", receiving: "receivingYards", tackles: "defenseTotalTackles", sacks: "defenseSacks", interceptions: "defenseInterceptions" };
    const leaders = {};
    for (const [c, k] of Object.entries(cats)) for (const scope of ["all", "league"]) {
      leaders[`${c}:${scope}`] = idx.filter((p) => p.s[k] && (scope === "all" || p.u)).sort((a, b) => b.s[k] - a.s[k]).slice(0, 10).map((p) => ({ k: p.k, n: p.n, tn: p.tn, p: p.p, g: p.s.gamesPlayed, v: p.s[k], s: p.s }));
    }
    await writeFile("data/bot/players.json", JSON.stringify({ period: cur.season_text, data: idx }));
    await writeFile("data/bot/leaders.json", JSON.stringify({ period: cur.season_text, leaders }));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
