// ODL slash-command bot — a Cloudflare Worker that answers Discord slash commands.
//   /player /team /box /schedule /standings /top25 /leaders /rta
//
// Worker settings → Variables and secrets:
//   DISCORD_PUBLIC_KEY  (secret)  Discord Developer Portal → General Information → Public Key
//   DISCORD_APP_ID      (text)    Application ID
//   DYNASTY_API_KEY     (secret)  a Dynasty API key
//   SITE_URL            (text)    https://thedynastycfb.com
//   DATA_URL            (text)    https://pirateflag23.github.io/dynasty-site/data/bot
// Then paste this Worker's URL into Discord → General Information → Interactions Endpoint URL.

const API = "https://dynasty.prestonchoate.dev/v1";
const RED = 0xc8102e, GOLD = 0xf2b134, BLUE = 0x2b6cb0, GREEN = 0x2f9e44;

export default {
  async fetch(req, env, ctx) {
    if (req.method === "GET" && new URL(req.url).pathname === "/pickem") return pickemDump(env, new URL(req.url).searchParams.get("round"));
    if (req.method !== "POST") return new Response("The Dynasty bot is running.");
    const body = await req.text();
    if (!(await verify(req, body, env.DISCORD_PUBLIC_KEY))) return new Response("bad signature", { status: 401 });
    const i = JSON.parse(body);
    if (i.type === 1) return json({ type: 1 }); // PING
    if (i.type === 2) {
      // Defer (Discord needs an answer within 3 s), then edit the reply when the data is ready.
      ctx.waitUntil(handle(i, env).catch((e) => ({ content: `⚠️ ${e.message}` })).then((msg) => edit(env, i.token, msg)));
      return json({ type: 5 });
    }
    if (i.type === 3 && String(i.data?.custom_id || "").startsWith("pk|")) {
      // Pick'em button: answer privately once the pick is saved.
      ctx.waitUntil(pick(i, env).catch((e) => ({ content: `⚠️ ${e.message}` })).then((msg) => edit(env, i.token, msg)));
      return json({ type: 5, data: { flags: 64 } });
    }
    return json({ type: 4, data: { content: "Unsupported interaction." } });
  },
};

const json = (o) => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });

async function verify(req, body, pub) {
  const sig = req.headers.get("X-Signature-Ed25519"), ts = req.headers.get("X-Signature-Timestamp");
  if (!sig || !ts || !pub) return false;
  const hex = (h) => new Uint8Array(h.match(/.{2}/g).map((b) => parseInt(b, 16)));
  try {
    const msg = new TextEncoder().encode(ts + body);
    try {
      const key = await crypto.subtle.importKey("raw", hex(pub), { name: "Ed25519" }, false, ["verify"]);
      return await crypto.subtle.verify("Ed25519", key, hex(sig), msg);
    } catch { // older Workers runtimes
      const key = await crypto.subtle.importKey("raw", hex(pub), { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["verify"]);
      return await crypto.subtle.verify("NODE-ED25519", key, hex(sig), msg);
    }
  } catch { return false; }
}

/* ---------------- Pick'em ----------------
   custom_id "pk|<round>|<gameKey>|<teamKey>|<teamName>". One KV entry per player per round: pk:<round>:<userId>. */
async function pick(i, env) {
  if (!env.PICKS) return { content: "Pick'em storage isn't set up yet." };
  const [, round, game, team, tname] = i.data.custom_id.split("|");
  const u = i.member?.user || i.user, uid = u.id, name = i.member?.nick || u.global_name || u.username;
  try { // locked once the game has been played
    const r = await fetch(`${API}/games/${game}`, { headers: { Authorization: `Bearer ${env.DYNASTY_API_KEY}` } });
    if (r.ok) { const g = (await r.json()).data || {}; if (g.played || g.box_score) return { content: `🔒 That game's already been played. Picks are locked.` }; }
  } catch { /* if the API is down, take the pick */ }
  const k = `pk:${round}:${uid}`;
  const cur = (await env.PICKS.get(k, "json")) || { name, picks: {} };
  const was = cur.picks[game];
  cur.name = name; cur.picks[game] = team; cur.at = new Date().toISOString();
  await env.PICKS.put(k, JSON.stringify(cur), { expirationTtl: 200 * 86400 });
  const n = Object.keys(cur.picks).length;
  return { content: `${was && was !== team ? "🔁 Switched to" : "✅ Locked in:"} **${tname || "your pick"}**. You have ${n} pick${n === 1 ? "" : "s"} in this week. You can change any pick until that game is played.` };
}
async function pickemDump(env, round) {
  if (!env.PICKS || !/^[\w-]+$/.test(round || "")) return json({ round, picks: {} });
  const out = {}; let cursor;
  do {
    const l = await env.PICKS.list({ prefix: `pk:${round}:`, cursor });
    for (const k of l.keys) { const v = await env.PICKS.get(k.name, "json"); if (v) out[k.name.split(":")[2]] = v; }
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  return new Response(JSON.stringify({ round, picks: out }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function edit(env, token, msg) {
  await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${token}/messages/@original`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...msg }),
  });
}

/* ---------------- data ---------------- */
function mk(env) {
  const cache = {};
  const api = (p) => (cache[p] ??= fetch(API + p, { headers: { Authorization: `Bearer ${env.DYNASTY_API_KEY}` } }).then((r) => { if (!r.ok) throw new Error(`Dynasty API ${p} → ${r.status}`); return r.json(); }));
  const file = (n) => (cache["f:" + n] ??= fetch(`${env.DATA_URL.replace(/\/$/, "")}/${n}`, { cf: { cacheTtl: 300 } }).then((r) => { if (!r.ok) throw new Error(`Stats file ${n} → ${r.status}`); return r.json(); }));
  const site = (h) => `${(env.SITE_URL || "").replace(/\/$/, "")}/#${h}`;
  return { api, file, site };
}
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const rk = (r) => (r > 0 && r <= 25 ? `#${r} ` : "");
const f1 = (v) => (v == null || !isFinite(v) ? "—" : (Math.round(v * 10) / 10).toFixed(1));
const n0 = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
const pad = (s, n) => String(s).slice(0, n).padEnd(n);
const lpad = (s, n) => String(s).slice(0, n).padStart(n);
const POS_RATINGS = {
  QB: ["throwPower", "throwAccuracyShort", "throwAccuracyMid", "throwAccuracyDeep", "throwOnTheRun", "throwUnderPressure"],
  RB: ["speed", "acceleration", "ballCarrierVision", "breakTackle", "jukeMove", "carrying"],
  WR: ["speed", "catching", "catchInTraffic", "routeRunningShort", "routeRunningMed", "routeRunningDeep"],
  TE: ["catching", "routeRunningShort", "runBlock", "passBlock", "speed", "catchInTraffic"],
  OL: ["passBlock", "runBlock", "strength", "impactBlocking", "passBlockPower", "runBlockPower"],
  DL: ["blockShedding", "powerMoves", "finesseMoves", "pursuit", "tackle", "strength"],
  LB: ["tackle", "pursuit", "playRecognition", "hitPower", "zoneCoverage", "blockShedding"],
  DB: ["manCoverage", "zoneCoverage", "speed", "press", "playRecognition", "tackle"],
  K: ["kickPower", "kickAccuracy"],
};
const posGroup = (pos) => ({ QB: "QB", HB: "RB", FB: "RB", WR: "WR", TE: "TE", LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL",
  DT: "DL", LEDG: "DL", REDG: "DL", LE: "DL", RE: "DL", MIKE: "LB", WILL: "LB", SAM: "LB", CB: "DB", FS: "DB", SS: "DB", K: "K", P: "K" }[pos]);
const opt = (i, name) => i.data.options?.find((o) => o.name === name)?.value;

function findTeam(standings, q) {
  const n = norm(q), all = standings.data;
  return all.find((t) => norm(t.name) === n) || all.find((t) => norm(`${t.name} ${t.nickname}`) === n || norm(t.nickname) === n)
    || all.find((t) => norm(t.name).startsWith(n)) || all.find((t) => norm(`${t.name} ${t.nickname}`).includes(n));
}

/* ---------------- commands ---------------- */
async function handle(i, env) {
  const d = mk(env);
  switch (i.data.name) {
    case "player": return player(d, opt(i, "name"), opt(i, "team"));
    case "team": return team(d, opt(i, "name"));
    case "box": return boxScore(d, opt(i, "team"));
    case "schedule": return schedule(d, opt(i, "team"));
    case "standings": return standings(d, opt(i, "conference"));
    case "top25": return top25(d);
    case "leaders": return leaders(d, opt(i, "category") || "passing", opt(i, "scope") || "all");
    case "rta": return rta(d);
    default: return { content: "Unknown command." };
  }
}

async function player(d, q, teamQ) {
  const [{ data: idx }, st] = await Promise.all([d.file("players.json"), d.api("/standings")]);
  const n = norm(q);
  let list = idx;
  if (teamQ) { const t = findTeam(st, teamQ); if (t) list = list.filter((p) => p.t === t.team_key); }
  const full = (p) => norm(`${p.f || ""} ${p.l || ""}`);
  let hits = list.filter((p) => full(p) === n || norm(p.n) === n);
  if (!hits.length) hits = list.filter((p) => norm(p.l) === n);
  if (!hits.length) hits = list.filter((p) => full(p).includes(n) || norm(p.n).includes(n));
  if (!hits.length) return { content: `No player found for **${q}**${teamQ ? ` on ${teamQ}` : ""}. Players appear once they've played a game.` };
  hits.sort((a, b) => (b.u - a.u) || (b.s.gamesPlayed || 0) - (a.s.gamesPlayed || 0) || (b.o || 0) - (a.o || 0));
  const exact = hits.filter((p) => full(p) === n || norm(p.n) === n);
  const pick = exact.length === 1 ? exact : hits.length === 1 ? hits : null;
  if (!pick) {
    const opts = (exact.length ? exact : hits).slice(0, 8).map((p) => `• ${p.f || ""} ${p.l || p.n} · ${p.p} · ${p.tn}`).join("\n");
    return { content: `Several players match **${q}**. Add \`team:\` to pick one:\n${opts}` };
  }
  const p = pick[0];
  const roster = await d.api(`/rosters?team=${p.t}`).catch(() => null);
  const r = roster?.data?.find((x) => x.player_key === p.k) || {};
  const s = p.s, lines = [];
  if (s.passAttempts) lines.push(`🎯 ${s.passCompletion}/${s.passAttempts}, ${n0(s.passYards)} yds, ${s.passTD || 0} TD, ${s.passINT || 0} INT · ${f1(s.passerRating)} rtg`);
  if (s.rushAttempts) lines.push(`🏃 ${s.rushAttempts} car, ${n0(s.rushYards)} yds, ${s.rushTD || 0} TD · ${f1((s.rushYards || 0) / s.rushAttempts)} avg`);
  if (s.receiveReceptions) lines.push(`🙌 ${s.receiveReceptions} rec, ${n0(s.receivingYards)} yds, ${s.receiveTouchdowns || 0} TD`);
  if (s.defenseTotalTackles || s.defenseSacks || s.defenseInterceptions) lines.push(`🛡️ ${s.defenseTotalTackles || 0} tkl, ${s.defenseTacklesForLoss || 0} TFL, ${s.defenseSacks || 0} sk, ${s.defenseInterceptions || 0} INT`);
  if (s.kickFieldGoalAttempts) lines.push(`🦶 FG ${s.kickFieldGoalsMade}/${s.kickFieldGoalAttempts}`);
  if (s.punts) lines.push(`🦵 ${s.punts} punts · ${f1(s.puntsAverage)} avg`);
  const keys = POS_RATINGS[posGroup(p.p)] || [];
  const R = r.ratings || {};
  const picked = keys.filter((k) => R[k] != null).map((k) => [k, R[k]]);
  const rt = (picked.length ? picked : Object.entries(R).filter(([k]) => !["stamina", "injury", "toughness"].includes(k)).sort((a, b) => b[1] - a[1])).slice(0, 6).map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())} **${v}**`);
  const cls = `${r.class_year || ""}${r.redshirted ? " (RS)" : ""}`;
  return { embeds: [{
    title: `${r.jersey ?? p.j ?? ""} ${r.first_name || p.f || ""} ${r.last_name || p.l || p.n}`.trim(), url: d.site(`player/${p.k}`), color: p.u ? RED : BLUE,
    description: `**${p.p}** · ${p.tn}${p.u ? " 🎮" : ""} · ${r.overall ?? p.o ?? "—"} OVR${r.archetype ? ` · ${r.archetype}` : ""}${cls ? ` · ${cls}` : ""}${r.dev_trait && r.dev_trait !== "Normal" ? ` · ⭐ ${r.dev_trait}` : ""}`,
    fields: [
      { name: `Season · ${s.gamesPlayed || 0} G`, value: lines.join("\n") || "—" },
      ...(rt.length ? [{ name: "Top ratings", value: rt.join(" · ") }] : []),
    ],
    footer: { text: "Full card, game log and ratings on the league site" },
  }] };
}

async function team(d, q) {
  const [st, ts, { data: idx }] = await Promise.all([d.api("/standings"), d.api("/team-stats"), d.file("players.json")]);
  const t = findTeam(st, q); if (!t) return { content: `No team found for **${q}**.` };
  const s = ts.data.find((x) => x.team_key === t.team_key)?.stats || {};
  const ps = idx.filter((p) => p.t === t.team_key);
  const top = (k) => ps.filter((p) => p.s[k]).sort((a, b) => b.s[k] - a.s[k])[0];
  const L = [];
  const qb = top("passYards"); if (qb) L.push(`🎯 ${qb.n} ${n0(qb.s.passYards)} yds, ${qb.s.passTD || 0} TD`);
  const rb = top("rushYards"); if (rb) L.push(`🏃 ${rb.n} ${n0(rb.s.rushYards)} yds, ${rb.s.rushTD || 0} TD`);
  const wr = top("receivingYards"); if (wr) L.push(`🙌 ${wr.n} ${wr.s.receiveReceptions}-${n0(wr.s.receivingYards)}`);
  const dt = top("defenseTotalTackles"); if (dt) L.push(`🛡️ ${dt.n} ${dt.s.defenseTotalTackles} tkl`);
  return { embeds: [{
    title: `${rk(t.rank)}${t.name} ${t.nickname || ""} (${t.record})`, url: d.site(`team/${t.team_key}`), color: t.user_controlled ? RED : BLUE,
    description: `${t.conference} · conf ${t.conference_record} · ${t.overall} OVR (${t.offense} OFF / ${t.defense} DEF) · ${"★".repeat(Math.round(t.prestige_stars || 0))} prestige`,
    fields: [
      { name: "Offense", value: `${f1(s.OffPointsPerGame)} pts/g · ${f1(s.OffYardsPerGame)} yds/g\n${f1(s.OffPassYardsPerGame)} pass · ${f1(s.OffRushYardsPerGame)} rush`, inline: true },
      { name: "Defense", value: `${f1(s.DefPointsPerGame)} pts/g · ${f1(s.DefYardsPerGame)} yds/g\n${s.DefSacks ?? 0} sacks · ${s.TurnoverTakeaways ?? 0} takeaways`, inline: true },
      { name: "Leaders", value: L.join("\n") || "—" },
    ],
  }] };
}

async function teamGames(d, q) {
  const st = await d.api("/standings"); const t = findTeam(st, q);
  if (!t) return {}; const sch = await d.api(`/teams/${t.team_key}/schedule`); return { t, sch: sch.data };
}

async function schedule(d, q) {
  const { t, sch } = await teamGames(d, q); if (!t) return { content: `No team found for **${q}**.` };
  const lines = sch.map((g) => {
    const at = g.location === "away" ? "@" : g.location === "neutral" ? "vs*" : "vs";
    const res = g.status === "completed" ? `**${g.outcome} ${g.team_score}-${g.opponent_score}**` : g.date || "TBD";
    return `\`${pad((g.displayed_week || "").replace("Week ", "Wk "), 6)}\` ${at} ${g.opponent}${g.matchup_type === "user_vs_user" ? " 🎮" : ""} · ${res}`;
  });
  return { embeds: [{ title: `${t.name} schedule · ${t.record}`, url: d.site(`team/${t.team_key}`), color: RED, description: lines.join("\n").slice(0, 4000) || "No games" }] };
}

async function boxScore(d, q) {
  const { t, sch } = await teamGames(d, q); if (!t) return { content: `No team found for **${q}**.` };
  const last = sch.filter((g) => g.status === "completed").sort((a, b) => b.week - a.week)[0];
  if (!last) return { content: `${t.name} hasn't played yet.` };
  const g = (await d.api(`/games/${last.game_key}`)).data, b = g.box_score;
  if (!b) return { content: `No box score for ${g.matchup} yet.` };
  const H = b.Home, A = b.Away, q4 = (x) => (x.Quarters || []).slice(0, 4);
  const line = [`${pad("", 6)}${["1", "2", "3", "4"].map((x) => lpad(x, 4)).join("")}${lpad("T", 5)}`, ...[A, H].map((x) => `${pad(x.Abbrev, 6)}${q4(x).map((v) => lpad(v, 4)).join("")}${lpad(x.Score, 5)}`)].join("\n");
  const s = (x, k) => x.Stats?.[k] ?? 0;
  const tbl = [`${pad("", 10)}${lpad(A.Abbrev, 7)}${lpad(H.Abbrev, 7)}`, ...[["Yards", "totalYardsGained"], ["Pass", "offPassYards"], ["Rush", "offRushYards"], ["Turnovers", "turnovers"]].map(([l, k]) => `${pad(l, 10)}${lpad(s(A, k), 7)}${lpad(s(H, k), 7)}`)].join("\n");
  const lead = (tk) => {
    const ps = b.Players.filter((p) => p.Team === tk), top = (k) => ps.filter((p) => p.Stats[k] > 0).sort((a, c) => c.Stats[k] - a.Stats[k])[0], o = [];
    const qb = top("passAttempts"); if (qb) o.push(`🎯 ${qb.Name} ${qb.Stats.passCompletion}/${qb.Stats.passAttempts}, ${qb.Stats.passYards}, ${qb.Stats.passTD} TD`);
    const rb = top("rushYards"); if (rb) o.push(`🏃 ${rb.Name} ${rb.Stats.rushAttempts}-${rb.Stats.rushYards}`);
    const wr = top("receivingYards"); if (wr) o.push(`🙌 ${wr.Name} ${wr.Stats.receiveReceptions}-${wr.Stats.receivingYards}`);
    return o.join("\n") || "—";
  };
  return { embeds: [{ title: `${g.result} · ${g.displayed_week}`, url: d.site(`game/${g.key}`), color: RED, description: "```\n" + line + "\n```",
    fields: [{ name: "Team stats", value: "```\n" + tbl + "\n```" }, { name: A.Abbrev, value: lead(g.away.team_key), inline: true }, { name: H.Abbrev, value: lead(g.home.team_key), inline: true }] }] };
}

async function standings(d, conf) {
  const st = await d.api("/standings");
  const confs = conf ? [conf] : ["ACC", "Big 12", "Big Ten", "SEC"];
  const wl = (r) => r.split("-").map(Number);
  const embeds = confs.map((c) => {
    const rows = st.data.filter((t) => t.conference === c).sort((a, b) => { const [aw, al] = wl(a.conference_record), [bw, bl] = wl(b.conference_record); return (bw - bl) - (aw - al) || b.wins - a.wins || a.losses - b.losses; });
    const lines = rows.map((t, i) => `\`${lpad(i + 1, 2)}\` ${t.user_controlled ? "**" : ""}${rk(t.rank)}${t.name}${t.user_controlled ? "** 🎮" : ""} · ${t.conference_record} conf · ${t.record}`);
    return { title: `${c} standings`, color: BLUE, description: lines.join("\n").slice(0, 4000) || "—" };
  });
  return { embeds };
}

async function top25(d) {
  const st = await d.api("/standings");
  const lines = st.data.filter((t) => t.rank > 0 && t.rank <= 25).sort((a, b) => a.rank - b.rank).map((t) => `\`${lpad(t.rank, 2)}\` ${t.user_controlled ? `**${t.name}** 🎮` : t.name} (${t.record})`);
  return { embeds: [{ title: `🏆 Top 25 · ${st.period?.season_text || ""}`, url: d.site("standings"), color: RED, description: lines.join("\n") }] };
}

async function leaders(d, cat, scope) {
  const { leaders: L, period } = await d.file("leaders.json");
  const rows = L[`${cat}:${scope}`] || [];
  const fmt = {
    passing: (p) => `${n0(p.v)} yds · ${p.s.passTD || 0} TD · ${p.s.passINT || 0} INT`, rushing: (p) => `${n0(p.v)} yds · ${p.s.rushTD || 0} TD`,
    receiving: (p) => `${p.s.receiveReceptions || 0}-${n0(p.v)} · ${p.s.receiveTouchdowns || 0} TD`, tackles: (p) => `${p.v} tkl`, sacks: (p) => `${p.v} sacks`, interceptions: (p) => `${p.v} INT`,
  }[cat] || ((p) => p.v);
  const lines = rows.map((p, i) => `\`${lpad(i + 1, 2)}\` [${p.n}](${d.site(`player/${p.k}`)}) · ${p.p} · ${p.tn} — ${fmt(p)}`);
  return { embeds: [{ title: `${cat[0].toUpperCase() + cat.slice(1)} leaders · ${scope === "league" ? "League teams" : "All FBS"} · ${period}`, url: d.site("stats/players"), color: GOLD, description: lines.join("\n") || "No data yet" }] };
}

async function rta(d) {
  const m = await d.api("/members");
  const ready = m.data.filter((x) => x.ready_to_advance).length;
  const lines = [...m.data].sort((a, b) => a.ready_to_advance - b.ready_to_advance || a.team_name.localeCompare(b.team_name))
    .map((x) => `${x.ready_to_advance ? "🟢" : "🔴"} **${x.team_name}** · ${x.user_name} · ${x.game_result === "---" ? `⏳ vs ${x.opponent}` : `✅ ${x.game_result}`}${x.auto_pilot !== "Off" ? " · 🤖" : ""}`);
  return { embeds: [{ title: `Ready to advance: ${ready}/${m.data.length} · ${m.period?.season_text || ""}`, color: ready === m.data.length ? GREEN : RED, description: lines.join("\n").slice(0, 4000) }] };
}
