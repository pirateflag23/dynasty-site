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

/* ---------------- Coaching carousel: one card per coach move, as soon as a sync sees it ---------------- */
export async function carouselCards(x) {
  const ch = x.pickChannel(x.cfg.channels.carousel || x.cfg.channels.headlines);
  if (!ch) return;
  let car = null, wire = null;
  try { car = JSON.parse(await readFile(`data/stories/${x.lid}/carousel.json`, "utf8")); } catch { return; }
  try { wire = JSON.parse(await readFile(`data/stories/${x.lid}/latest.json`, "utf8")); } catch { /* fine */ }
  const plain = (s) => String(s || "").replace(/\[\[\w:[^|\]]*\|([^\]]*)\]\]/g, "$1");
  for (const m of car.moves || []) {
    if (Date.now() - Date.parse(m.at) > 3 * 86400e3 && !x.replay("carousel")) continue;
    const id = `carousel:${m.gt}:${m.kind}:${m.to || m.from}:${m.period}`;
    await x.once(id, "carousel", ch, async () => {
      const s = [...(wire?.games || [])].find((q) => q.id === id);
      const headline = plain(s?.h) || (m.kind === "move" ? `${m.gt} leaves ${m.from_name} for ${m.to_name}` : m.kind === "join" ? `${m.to_name} hires ${m.gt}` : `${m.gt} is out at ${m.from_name}`);
      const text = plain(s?.d);
      const map = await x.logoMap();
      const T = (k, n) => { if (!k) return null; const t = x.teams.get(k) || x.teams.get(Number(k)) || {}; return { name: n, logo: x.logoFor(n, map), record: t.record, rank: t.rank }; };
      const embed = { title: `🎠 Coaching carousel · ${headline}`, color: RED, description: text || undefined, url: x.site("home") };
      if (x.cfg.graphics?.carousel === false) return { embeds: [embed] };
      try {
        const { renderCarousel } = await lg();
        const img = await renderCarousel({ kind: m.kind, coach: m.gt, from: T(m.from, m.from_name), to: T(m.to, m.to_name), headline, text, label: m.season_text || "", siteLogo: x.siteLogo(), colors: await x.colors() });
        return png("carousel.png", img, embed.title, RED, embed.url);
      } catch (e) { x.log(`Carousel graphic failed: ${e.message}`); return { embeds: [embed] }; }
    });
  }
}

/* ---------------- National Signing Day: build a timed show ----------------
   When a sync first sees the signings land, every card is rendered now (images committed under data/nsd/) and queued with a
   release time. dispatch/nsd.js (cron, every 2 min) posts each card to Discord when its time comes. */
const etParts = (t) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t)).map((q) => [q.type, q.value]));
// next HH:MM Eastern at least `lead` ms from now
function nextEt(hhmm, lead) {
  const [H, M] = hhmm.split(":").map(Number), now = Date.now() + lead, p = etParts(now);
  let d = (H * 60 + M) - (Number(p.hour) * 60 + Number(p.minute));
  if (d < 0) d += 1440;
  return now + d * 60e3;
}
export async function signingDay(x) {
  const C = { start_et: "19:00", hours: 3, min_signed: 40, ...(x.cfg.nsd || {}) };
  const ch = x.pickChannel(x.cfg.channels.signing_day || x.cfg.channels.recruiting);
  if (!ch) return;
  const TEST = process.env.NSD_TEST === "1";
  const season = x.cur.season;
  if (!TEST && /Wk \d+$/.test(x.cur.season_text || "")) return; // signings land in the offseason
  const st = (x.state.nsd ??= {});
  if (st[season] && !TEST) return;
  const all = (await x.api("/recruits").catch(() => ({ data: [] }))).data || [];
  const signed = all.filter((r) => !r.transfer && (TEST ? r.committed : r.signed) && r.school?.team_id);
  if (signed.length < C.min_signed) return;
  // The real Signing Day comes after the four transfer-portal weeks: that's when nearly every committed
  // recruit signs at once. Early signees trickle in before that, so wait until most commits have signed
  // (signed_share, default 80%) and, if set, until the offseason stage reaches after_stage.
  if (!TEST) {
    const stage = +(/OFF\s*Stg\s*(\d+)/i.exec(x.cur.season_text || "")?.[1] || 0);
    if (C.after_stage && stage < C.after_stage) return;
    const committed = all.filter((r) => !r.transfer && (r.committed || r.signed) && r.school?.team_id).length;
    if (signed.length < (C.signed_share ?? 0.8) * committed) { x.log(`Signing Day: ${signed.length} of ${committed} commits signed so far (early signees); waiting for NSD.`); return; }
  }
  if (x.seeding) { st[season] = { skipped: true }; return; }
  x.log(`Signing Day: ${signed.length} signings, building the show`);
  const commits = (await x.api("/recruits/commits").catch(() => ({ data: [] }))).data || [];
  const lastCommit = new Map(); for (const c of [...commits].reverse()) if (c.kind === "commit") lastCommit.set(c.prospect_key, c);
  const keyOf = (s) => x.teamKeyById(s?.team_id);
  const map = await x.logoMap(), colors = await x.colors(), siteLogo = x.siteLogo();
  const school = (k, n) => ({ name: k ? x.tName(k) : n, logo: x.logoFor(k ? x.tName(k) : n, map), coach: k && x.userTeams.has(k) ? x.coachName(k) : "" });
  const R = (r) => ({ name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.name, pos: r.position, archetype: r.archetype, stars: r.stars, rank: r.national_rank, pos_rank: r.position_rank, hometown: r.hometown, state: r.state, height: r.height, weight: r.weight, dev: r.dev_trait });
  const flipFrom = (r) => { const c = lastCommit.get(r.prospect_key); return c && c.school?.team_id !== r.school.team_id ? c.school?.name : c?.previous_school && c.previous_school.team_id !== r.school.team_id ? c.previous_school.name : ""; };
  const byRank = (a, b) => (a.national_rank || 9999) - (b.national_rank || 9999);
  const top10 = [...signed].sort(byRank).slice(0, 10);
  const inTop = new Set(top10.map((r) => r.prospect_key));
  const isUser = (r) => x.userTeams.has(keyOf(r.school));
  const singles = signed.filter((r) => !inTop.has(r.prospect_key) && ((isUser(r) && r.stars >= 4) || r.stars === 5 || (r.national_rank && r.national_rank <= 40) || (flipFrom(r) && r.stars >= 4)))
    .sort((a, b) => (isUser(b) - isUser(a)) || byRank(a, b)).slice(0, C.max_singles ?? 60).sort((a, b) => byRank(b, a)); // worst to best
  const classes = (await x.api("/recruits/classes").catch(() => ({ data: [] }))).data || [];
  const clsRank = new Map(classes.map((c) => [c.team_key, c.rank]));
  const userCls = [...x.userTeams].map((k) => ({ k, list: signed.filter((r) => keyOf(r.school) === k).sort(byRank) })).filter((c) => c.list.length).sort((a, b) => (clsRank.get(b.k) || 999) - (clsRank.get(a.k) || 999));

  const dir = `data/nsd/${x.lid}/${season}`, rawBase = `${(x.cfg.raw_base || "https://raw.githubusercontent.com/pirateflag23/dynasty-site/main").replace(/\/$/, "")}/${dir}`;
  await mkdir(x.DRY ? "graphics-preview/nsd" : dir, { recursive: true });
  const label = `${season} class`, items = [];
  let n = 0;
  const lim = x.DRY ? 8 : 1e9;
  const card = async (id, title, render) => {
    if (n++ >= lim) return;
    try { const img = await render(); const f = `${id}.png`; await writeFile(`${x.DRY ? "graphics-preview/nsd" : dir}/${f}`, img); items.push({ id, title, image: `${rawBase}/${f}` }); }
    catch (e) { x.log(`NSD card ${id} failed: ${e.message}`); items.push({ id, title }); }
  };
  const G = await lg();
  const userSigned = signed.filter(isUser);
  await card("open", "📝 National Signing Day is LIVE", () => G.renderNSDBoard({ title: "Signing Day is live", sub: `${signed.length} signatures are in. We'll take you through every big one, then the top 10 in the country.`,
    lines: [`${userSigned.length} recruits signed with league coaches`, `${signed.filter((r) => r.stars === 5).length} five-stars and ${signed.filter((r) => r.stars === 4).length} four-stars signed nationally`, "Top 10 countdown starts in the final half hour"], label, siteLogo, colors }));
  const main = [];
  for (const r of singles) { const k = keyOf(r.school), fl = flipFrom(r);
    main.push(["s" + r.prospect_key, `${fl ? "🔄 FLIP" : "✍️ Signed"}: ${r.stars}★ ${r.position} ${R(r).name} → ${school(k, r.school.name).name}`, () => G.renderSigning({ r: R(r), s: school(k, r.school.name), kind: fl ? "flip" : "sign", prev: fl, label, siteLogo, colors })]); }
  const clsCards = userCls.map((c) => ["c" + c.k, `📋 ${x.tName(c.k)} signs ${c.list.length}: ${x.coachName(c.k)}'s class is in`, () => G.renderClassCard({ s: school(c.k), signees: c.list.slice(0, 26).map((r) => ({ stars: r.stars, pos: r.position, name: R(r).name, rank: r.national_rank, state: r.state })), rank: clsRank.get(c.k), label, siteLogo, colors })]);
  // spread the class cards evenly through the singles
  const step = clsCards.length ? Math.max(1, Math.floor(main.length / clsCards.length)) : 1;
  clsCards.forEach((c, i) => main.splice(Math.min(main.length, (i + 1) * step + i), 0, c));
  for (const [id, t, f] of main) await card(id, t, f);
  for (const [i, r] of [...top10].reverse().entries()) { const k = keyOf(r.school), fl = flipFrom(r);
    await card("t" + (10 - i), `🔟 No. ${10 - i}: ${r.stars}★ ${r.position} ${R(r).name} → ${school(k, r.school.name).name}`, () => G.renderSigning({ r: R(r), s: school(k, r.school.name), kind: fl ? "flip" : "sign", prev: fl, countdown: 10 - i, label, siteLogo, colors })); }
  await card("close", "🏆 Signing Day final: the top classes", () => G.renderNSDBoard({ title: "Final class rankings", sub: `${season} recruiting class`,
    rows: classes.slice(0, 20).map((c) => ({ rank: c.rank, name: c.name, logo: x.logoFor(c.name, map), coach: x.userTeams.has(c.team_key) ? x.coachName(c.team_key) : "", pts: c.points != null ? `${c.points} pts` : `${c.commits?.total ?? ""}` })), label, siteLogo, colors }));

  // timing: opener at start, singles + class cards through 80% of the window, countdown to the end, final rankings last
  // start_now (testing): begin 10 minutes after the build and squeeze the show into `test_minutes`
  const quick = TEST || x.DRY || C.start_now;
  const start = quick ? Date.now() + 10 * 60e3 : nextEt(C.start_et, 20 * 60e3), H = C.start_now ? (C.test_minutes ?? 30) * 60e3 : C.hours * 3600e3;
  const mid = items.filter((q) => q.id !== "open" && q.id !== "close" && !/^t\d+$/.test(q.id)), cd = items.filter((q) => /^t\d+$/.test(q.id));
  const at = (t) => new Date(Math.round(t)).toISOString();
  for (const q of items) {
    if (q.id === "open") q.at = at(start);
    else if (q.id === "close") q.at = at(start + H);
    else if (cd.includes(q)) q.at = at(start + H * 0.82 + (cd.indexOf(q) * (H * 0.16)) / Math.max(1, cd.length - 1));
    else q.at = at(start + 2 * 60e3 + (mid.indexOf(q) * (H * 0.78)) / Math.max(1, mid.length));
  }
  const queue = { season, league_id: x.lid, channel_id: x.channelId(ch), channel: ch, start: at(start), end: at(start + H), built: new Date().toISOString(), test: TEST, items };
  await writeFile(x.DRY ? "graphics-preview/nsd/queue.json" : `data/nsd/queue.json`, JSON.stringify(queue, null, 1));
  if (!TEST) st[season] = { built: queue.built, start: queue.start, n: items.length };
  x.log(`Signing Day show queued: ${items.length} cards from ${queue.start} to ${queue.end}`);
}

/* ---------------- Record desk: Pete posts in the main chat when a record falls ----------------
   NCAA FBS records (single game / season / career, from data/ncaa-records.json) and dynasty records
   (best game, season and career in this dynasty). Dynasty season records only count once a player passes
   a mark set in an earlier season, and career/game records only once the dynasty has a finished season,
   so season one doesn't post every week. The first run just learns the current record book. */
const REC_LABEL = { passYards: "passing yards", passTD: "passing touchdowns", rushYards: "rushing yards", rushTD: "rushing touchdowns",
  receivingYards: "receiving yards", receiveReceptions: "receptions", receiveTouchdowns: "receiving touchdowns", defenseTotalTackles: "tackles",
  defenseSacks: "sacks", defenseInterceptions: "interceptions", kickFieldGoalsMade: "field goals" };
const readJ = async (p) => { try { return JSON.parse(await (await import("node:fs/promises")).readFile(p, "utf8")); } catch { return null; } };

export async function recordDesk(x) {
  const dir = `data/history/${x.lid}`;
  const [ncaa, broken, leaders, idx, highs] = await Promise.all([readJ("data/ncaa-records.json"), readJ(`${dir}/records.json`), readJ(`${dir}/leaders.json`), readJ(`${dir}/index.json`), readJ(`${dir}/game-highs.json`)]);
  if (!leaders || !idx) return;
  const season = +(x.cur.season || idx.current_season), first = Math.min(...(idx.seasons || [season]).map(Number));
  const seasoned = season > first; // dynasty has at least one finished season
  const firstRun = !x.state.recBook; const book = (x.state.recBook ??= {});
  const keyOf = (name) => [...x.teams.values()].find((t) => t.name === name)?.team_key;
  const events = [];
  const ev = (key, o) => { if (x.seen(key)) return; if (firstRun || x.seeding) { x.mark(key); return; } events.push({ key, ...o }); };

  // NCAA season / career marks (build-history keeps the list; first_seen sticks)
  for (const b of broken?.broken || []) {
    ev(`rec:ncaa:${b.scope}:${b.cat}:${b.k}:${b.y}`, { prio: 3, kind: "ncaa", scope: b.scope, cat: b.cat, n: b.n, team: b.t, tn: b.tn, v: b.v, old: b.old, y: b.y });
  }
  // single games this season (NCAA + dynasty)
  const cur = highs?.seasons?.[season] || {};
  const gameSeed = !!highs && !book._games; if (highs) book._games = true; // first time game highs exist: learn them quietly
  const gev = (key, o) => { if (gameSeed) { x.mark(key); return; } ev(key, o); };
  for (const [cat, list] of Object.entries(cur)) {
    const top = list[0]; if (!top) continue;
    const rec = ncaa?.game?.[cat];
    if (rec) for (const g of list.filter((r) => r.v > rec.value)) gev(`rec:ncaa:game:${cat}:${g.k}:${g.game}`, { prio: 3, kind: "ncaa", scope: "game", cat, n: g.n, team: g.t, v: g.v, old: rec, week: g.week, game: g.game });
    const was = book[`game:${cat}`];
    if (!was || top.v > was.v) {
      if (was && seasoned && top.game !== was.game) gev(`rec:dyn:game:${cat}:${top.k}:${top.game}`, { prio: 2, kind: "dynasty", scope: "game", cat, n: top.n, team: top.t, v: top.v, prev: was, week: top.week, game: top.game });
      book[`game:${cat}`] = { k: top.k, n: top.n, v: top.v, season, game: top.game };
    }
  }
  // dynasty season + career record book (leaders.json is already sorted, #1 first)
  for (const scope of ["season", "career"]) for (const [cat, list] of Object.entries(leaders[scope] || {})) {
    const top = list?.[0]; if (!top?.v) continue;
    const was = book[`${scope}:${cat}`], same = was && was.k === top.k && (scope === "career" || String(was.y) === String(top.y));
    if (!was || top.v > was.v) {
      const fair = scope === "season" ? was && Number(was.y) < Number(top.y) : seasoned;
      if (was && !same && fair) ev(`rec:dyn:${scope}:${cat}:${top.k}${scope === "season" ? ":" + top.y : ""}`, { prio: 1, kind: "dynasty", scope, cat, n: top.n, team: keyOf(top.tn), tn: top.tn, v: top.v, prev: was, y: top.y });
      book[`${scope}:${cat}`] = { k: top.k, n: top.n, v: top.v, y: top.y, tn: top.tn };
    }
  }
  if (!events.length) return;
  // one item per player+category+scope (an NCAA record beats the dynasty one), best first, max 3 per post
  const pick = new Map();
  for (const e of events.sort((a, b) => b.prio - a.prio)) { const k = `${e.scope}:${e.cat}:${e.n}`; if (!pick.has(k)) pick.set(k, e); else x.mark(e.key); }
  const items = [...pick.values()].slice(0, 3);
  const facts = items.map((e) => ({ type: e.kind === "ncaa" ? `NCAA FBS ${e.scope === "game" ? "single-game" : e.scope} record` : `dynasty ${e.scope === "game" ? "single-game" : e.scope} record`,
    player: e.n, school: e.tn || x.tName(e.team), coach: x.userTeams.has(e.team) ? x.coachName(e.team) : null, stat: REC_LABEL[e.cat] || e.cat, value: e.v,
    when: e.scope === "game" ? (() => { const g = x.games.find((q) => q.key === e.game); if (!g) return "this season"; const me = g.home.team_key === e.team ? g.home : g.away, o = me === g.home ? g.away : g.home;
      return `${me.score}-${o.score} ${me.score > o.score ? "win" : me.score < o.score ? "loss" : "tie"} ${me === g.home ? "vs" : "at"} ${o.team}`; })() : e.scope === "season" ? `${e.y} season` : "career",
    previous: e.old ? `${e.old.value} by ${e.old.holder} (${e.old.school}, ${e.old.years})` : e.prev ? `${e.prev.v} by ${e.prev.n}${e.prev.y ? ` (${e.prev.y})` : ""}` : null }));
  const rep = (x.cfg.reporters || []).find((r) => r.id === "pete") || { name: "Pete Thamel" };
  const text = await peteLine(x, rep, facts) || facts.map((f) => `🚨 Record alert: **${f.player}** (${f.school}) just set the ${f.type} with ${f.value} ${f.stat}${f.previous ? `, passing ${f.previous}` : ""}.${f.coach ? ` Flowers to ${f.coach}.` : ""}`).join("\n");
  const chName = x.cfg.channels?.records || x.cfg.reporter_rules?.chime_channels?.[0] || "general";
  const ch = x.channelId(chName);
  if (!ch) { x.log(`Record desk: channel #${chName} not found.`); return; }
  if (x.DRY) { x.log(`[dry] ${rep.name} in #${chName}: ${text}`); }
  else {
    let hooks = await x.dc("GET", `/channels/${ch}/webhooks`);
    let h = (hooks || []).find((w) => w.name === "TD Wire reporters" && w.token) || await x.dc("POST", `/channels/${ch}/webhooks`, { name: "TD Wire reporters" });
    const r = await fetch(`https://discord.com/api/v10/webhooks/${h.id}/${h.token}?wait=true`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: rep.name, avatar_url: rep.avatar, content: text.slice(0, 1900), allowed_mentions: { parse: [] } }) });
    if (!r.ok) throw new Error(`webhook ${r.status} ${(await r.text()).slice(0, 150)}`);
  }
  for (const e of events) x.mark(e.key);
  x.log(`Record desk: posted ${items.length} record(s) as ${rep.name} in #${chName}.`);
}

async function peteLine(x, rep, facts) {
  const key = process.env.ANTHROPIC_API_KEY; if (!key || (x.DRY && !process.env.PR_AI)) return null;
  const sys = `You are ${rep.name}, a college football reporter posting in a league's Discord chat. Voice: ${rep.discord || "warm, plugged-in national insider"}. A record just fell. Write one short Discord message (max 3 sentences per record, under 600 characters total) breaking the news: lead with the record, give the numbers exactly as provided, name the previous holder if given, and give the player (and his coach, if a coach is listed) their flowers. Use only these facts; never invent stats, games, opponents or quotes. No hashtags. Plain text, at most one emoji.`;
  try {
    const r = await fetch(`${process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"}/v1/messages`, { method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.WRITER_MODEL || "claude-sonnet-5-5", max_tokens: 600, system: sys, messages: [{ role: "user", content: JSON.stringify(facts) }] }) });
    if (!r.ok) throw new Error(`${r.status}`);
    return ((await r.json()).content?.map((c) => c.text || "").join("") || "").trim() || null;
  } catch (e) { x.log(`Record desk AI fell back to template: ${e.message}`); return null; }
}
