// The Dynasty: smaller weekly graphics → PNG.
//   renderAdvance({ week, year, season, lines, siteLogo })                 #announcements on each new week
//   renderHeisman({ label, players:[{ rank, name, pos, cls, team, rank_t, logo, last, stat, isNew, move, user }], siteLogo, colors })
//   renderHeismanWinner({ season, name, pos, cls, team, rank_t, record, coach, logo, user, stats:[[label, value]], line, trophy, siteLogo, colors })
//   renderHeadlines({ label, stories:[{ kick, h, d, user }], siteLogo })
//   renderOnDeck({ label, sub, games:[{ away:{name,rank,record,coach,logo}, home:{...}, tag }], siteLogo, colors })
import { fonts, esc, short, badge, BADGE_CSS, shoot, teamCols } from "./common.mjs";

const BASE = `*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
header{position:relative;display:flex;align-items:center;gap:22px;padding:22px 32px 20px;background:#000;border-bottom:5px solid var(--accent,#cc0000)}
header::after{content:"";position:absolute;right:0;top:0;bottom:0;width:420px;background:repeating-linear-gradient(115deg,transparent 0 18px,rgba(204,0,0,.10) 18px 36px)}
header img{height:72px;position:relative;z-index:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.ttl{position:relative;z-index:1}.ttl small{display:block;font:700 15px RC;letter-spacing:.22em;color:var(--accent,#cc0000);text-transform:uppercase}
.ttl h1{font:800 54px/0.95 RC;text-transform:uppercase}.ttl h1 span{color:var(--accent,#cc0000)}
.meta{margin-left:auto;text-align:right;position:relative;z-index:1;font:700 22px RC;text-transform:uppercase;line-height:1.15}
footer{display:flex;justify-content:space-between;padding:10px 28px 14px;font:500 14px R;color:#9a9b9e;border-top:1px solid #26282a;margin-top:10px}footer b{color:#ededee}`;
const logoImg = (src, h = 72) => (src ? `<img src="${src}" style="height:${h}px" onerror="this.remove()">` : "");
// [[p:123|Name]] / [[t:..|Team]] / [[r:..|Recruit]] → Name
export const plain = (s) => String(s || "").replace(/\[\[[a-z]:[^|\]]*\|([^\]]*)\]\]/g, "$1");

export async function renderAdvance({ week = "", round = "", year = "", season = "", lines = [], siteLogo = "", chromeChannel = "chrome" }) {
  const html = `<!doctype html><html><head><style>${await fonts()}
${BASE}
.adv{position:relative;padding:54px 40px 46px;text-align:center;overflow:hidden;
  background:radial-gradient(ellipse at 50% 0%,rgba(204,0,0,.35),transparent 60%),repeating-linear-gradient(115deg,transparent 0 22px,rgba(255,255,255,.025) 22px 44px),#0f1011}
.adv img{height:150px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.7))}
.kick{font:700 22px RC;letter-spacing:.34em;color:#cc0000;text-transform:uppercase;margin-top:22px}
.wk{font:800 120px/0.95 RC;text-transform:uppercase;margin-top:6px;text-shadow:0 4px 18px rgba(0,0,0,.6)}
.rnd{font:800 44px RC;letter-spacing:.06em;text-transform:uppercase;color:#f2b134;margin-top:8px}
.yr{display:inline-block;margin-top:14px;font:700 24px RC;letter-spacing:.12em;text-transform:uppercase;background:#cc0000;padding:6px 18px;border-radius:4px}
.notes{display:grid;gap:12px;padding:26px 60px 8px}
.note{display:flex;align-items:center;gap:16px;background:#1f2022;border-left:6px solid #cc0000;border-radius:6px;padding:16px 20px;font:700 26px RC}
.note i{font-style:normal;font-size:26px}
</style></head><body><div class="card">
<div class="adv">${logoImg(siteLogo, 150)}
  <div class="kick">We have advanced to</div>
  <div class="wk">${esc(week)}</div>
  ${round ? `<div class="rnd">${esc(round)}</div>` : ""}
  <div class="yr">${esc([year, season].filter(Boolean).join(" · "))}</div></div>
<div class="notes">${lines.map(([icon, t]) => `<div class="note"><i>${icon}</i><span>${esc(t)}</span></div>`).join("")}</div>
<footer><span>Matchup chats are open under Matchups</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}

export async function renderHeisman({ label = "", players = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const mv = (p) => (p.isNew ? `<i class="mv new">NEW</i>` : !p.move ? `<i class="mv eq">–</i>` : p.move > 0 ? `<i class="mv up">▲${p.move}</i>` : `<i class="mv dn">▼${-p.move}</i>`);
  const row = (p) => { const c = teamCols(colors, p.team).c1; return `<div class="hr${p.user ? " user" : ""}" style="--tc:${c}">
    <b class="rk">${p.rank}</b>${badge(p.team, p.logo, colors, 64)}
    <div class="who"><b>${esc(p.name)}</b><small>${esc(p.pos)} · ${esc(p.cls || "")} · ${p.rank_t > 0 && p.rank_t <= 25 ? `#${p.rank_t} ` : ""}${esc(short(p.team))}${p.user ? " · 🎮" : ""}</small>
      <div class="lg">${esc(String(p.last || "").replace(/^Last Game\s*/i, "Last: ").replace(/:$/, ""))}</div>
      <div class="st">${String(p.stat || "").split(/\n|,\s*/).filter(Boolean).map((s) => `<span>${esc(s.trim())}</span>`).join("")}</div></div>
    ${mv(p)}</div>`; };
  const html = `<!doctype html><html><head><style>${await fonts()}
${BADGE_CSS}
${BASE}
.card{--accent:#f2b134}
.list{padding:18px 28px 4px}
.hr{position:relative;display:grid;grid-template-columns:54px 64px 1fr 60px;gap:16px;align-items:center;padding:14px 16px;margin-bottom:10px;border-radius:8px;overflow:hidden;
  background:linear-gradient(90deg,color-mix(in srgb,var(--tc) 32%,#1f2022) 0,#1f2022 45%)}
.hr::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--tc)}
.hr.user{box-shadow:inset 0 0 0 2px #cc0000}
.hr .rk{font:800 44px RC;text-align:center;color:#f2b134}
.who b{font:800 30px/1 RC;text-transform:uppercase}.who small{display:block;font:500 15px R;color:#b9babd;margin-top:4px}
.lg{font:500 14px R;color:#9a9b9e;margin-top:6px}
.st{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.st span{font:700 16px RC;background:#2a2b2e;border-radius:4px;padding:4px 9px}
.mv{font:700 16px RC;font-style:normal;text-align:center;border-radius:4px;padding:4px 0}
.up{color:#3ccf6e;background:rgba(60,207,110,.12)}.dn{color:#ff5a5a;background:rgba(255,90,90,.12)}.eq{color:#6c6d6f}.new{color:#f2b134;background:rgba(242,177,52,.14)}
</style></head><body><div class="card">
<header>${logoImg(siteLogo)}<div class="ttl"><small>The Dynasty</small><h1>Heisman <span>Watch</span></h1></div><div class="meta">${esc(label)}</div></header>
<div class="list">${players.map(row).join("") || '<div class="hr"><div></div><div></div><div class="who"><small>No candidates yet.</small></div></div>'}</div>
<footer><span>Ranked by the game's Heisman watch</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}

// Season stat tiles for a player, picked by position. s = player-stats-all.json stats.
export function heismanStatTiles(pos = "", s = {}) {
  const n = (v) => (v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 }));
  const p = String(pos).toUpperCase(), t = [];
  const add = (l, v, keep = true) => { if (keep && v != null) t.push([l, n(v)]); };
  if (p === "QB") { add("Pass yds", s.passYards); add("Pass TD", s.passTD); add("INT", s.passINT); add("Comp %", s.passCompPerc); add("Rush yds", s.rushYards, s.rushYards > 150); add("Rush TD", s.rushTD, s.rushTD > 2); }
  else if (/^(HB|RB|FB)$/.test(p)) { add("Rush yds", s.rushYards); add("Rush TD", s.rushTD); add("Yds/carry", s.rushAvg); add("Carries", s.rushAttempts); add("Rec yds", s.receivingYards, s.receivingYards > 100); add("Broken tkl", s.rushBrokenTackles); }
  else if (/^(WR|TE)$/.test(p)) { add("Receptions", s.receiveReceptions); add("Rec yds", s.receivingYards); add("Rec TD", s.receiveTouchdowns); add("Yds/game", s.receiveYardsPerGame); add("Yds/catch", s.receiveAvgYdsPerReception); add("Long", s.receiveLongReception); }
  else if (/^(K|P)$/.test(p)) { add("FG made", s.kickFieldGoalsMade); add("FG %", s.kickFieldGoalPercentage); add("Long", s.kickFieldGoalLong); add("Punt avg", s.puntsAverage, s.punts > 0); }
  else { add("Tackles", s.defenseTotalTackles); add("TFL", s.defenseTacklesForLoss); add("Sacks", s.defenseSacks); add("INT", s.defenseInterceptions); add("Forced fum", s.defenseFumbleForced); add("Def TD", s.defenseTouchdowns, s.defenseTouchdowns > 0); }
  if (s.gamesPlayed) t.push(["Games", n(s.gamesPlayed)]);
  return t.slice(0, 6);
}

// Generic gold trophy (a football on a tiered pedestal) — original art, swap in your own image with trophy=URL.
const TROPHY_SVG = `<svg viewBox="0 0 240 360" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#8a5a12"/><stop offset=".35" stop-color="#ffe28a"/><stop offset=".55" stop-color="#f2b134"/><stop offset="1" stop-color="#7a4c0c"/></linearGradient>
<linearGradient id="w" x1="0" x2="1"><stop offset="0" stop-color="#2a1d10"/><stop offset=".5" stop-color="#4a3420"/><stop offset="1" stop-color="#1c130a"/></linearGradient></defs>
<ellipse cx="120" cy="92" rx="86" ry="52" transform="rotate(-28 120 92)" fill="url(#g)"/>
<path d="M62 118 Q120 40 178 66" stroke="#7a4c0c" stroke-width="3" fill="none" opacity=".55"/>
<g stroke="#fff6d8" stroke-width="5" stroke-linecap="round"><path d="M98 96 L142 72"/><path d="M106 78 l8 14M116 72 l8 14M126 67 l8 14"/></g>
<path d="M100 150 h40 l-6 40 h-28z" fill="url(#g)"/><rect x="84" y="188" width="72" height="16" rx="3" fill="url(#g)"/>
<path d="M92 204 h56 l10 70 h-76z" fill="url(#g)"/><rect x="62" y="272" width="116" height="20" rx="3" fill="url(#g)"/>
<rect x="44" y="292" width="152" height="54" rx="4" fill="url(#w)"/><rect x="74" y="306" width="92" height="26" rx="2" fill="url(#g)"/></svg>`;

export async function renderHeismanWinner({ season = "", name = "", pos = "", cls = "", team = "", rank_t = 0, record = "", coach = "", logo = "", user = false, stats = [], line = "", trophy = "", siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const { c1, c2 } = teamCols(colors, team);
  const [first, ...rest] = String(name).split(" ");
  const tiles = stats.length ? stats : String(line || "").split(/\n|,\s*/).filter(Boolean).map((x) => { const m = /^([\d,.]+%?)\s+(.*)$/.exec(x.trim()); return m ? [m[2], m[1]] : [x.trim(), ""]; }).slice(0, 6);
  const html = `<!doctype html><html><head><style>${await fonts()}
${BADGE_CSS}
${BASE}
.card{--accent:#f2b134;--tc:${c1};--tc2:${c2}}
.hero{position:relative;display:grid;grid-template-columns:300px 1fr;gap:34px;align-items:center;padding:40px 44px 34px;overflow:hidden;
  background:radial-gradient(ellipse at 18% 40%,rgba(242,177,52,.32),transparent 55%),linear-gradient(110deg,color-mix(in srgb,var(--tc) 38%,#121314) 0,#121314 70%)}
.hero::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 22px,rgba(255,255,255,.025) 22px 44px);pointer-events:none}
.tro{position:relative;z-index:1;display:grid;place-items:center;height:380px}
.tro svg,.tro img{height:360px;max-width:280px;object-fit:contain;filter:drop-shadow(0 0 30px rgba(242,177,52,.45)) drop-shadow(0 8px 14px rgba(0,0,0,.7))}
.info{position:relative;z-index:1}
.kick{font:700 20px RC;letter-spacing:.3em;color:#f2b134;text-transform:uppercase}
.yr{display:inline-block;margin-top:10px;font:800 22px RC;letter-spacing:.1em;background:#f2b134;color:#121213;padding:4px 14px;border-radius:4px}
.nm{font:800 96px/.9 RC;text-transform:uppercase;margin-top:16px;text-shadow:0 4px 18px rgba(0,0,0,.6)}.nm span{display:block;font-size:46px;color:#d6d7d9}
.tm{display:flex;align-items:center;gap:16px;margin-top:18px}.tm b{font:800 30px RC;text-transform:uppercase}.tm small{display:block;font:500 17px R;color:#b9babd;margin-top:2px}
.tm .u{font:700 14px RC;letter-spacing:.08em;background:#cc0000;padding:3px 9px;border-radius:4px;margin-left:6px;vertical-align:middle}
.tiles{display:grid;grid-template-columns:repeat(${Math.min(6, Math.max(3, tiles.length))},1fr);gap:12px;padding:22px 32px 8px}
.tile{background:#1f2022;border-radius:8px;padding:16px 10px;text-align:center;border-top:5px solid var(--tc)}
.tile b{display:block;font:800 46px/1 RC}.tile small{display:block;font:700 15px RC;letter-spacing:.12em;text-transform:uppercase;color:#9a9b9e;margin-top:8px}
</style></head><body><div class="card">
<header>${logoImg(siteLogo)}<div class="ttl"><small>The Dynasty</small><h1>Heisman <span>Trophy</span></h1></div><div class="meta">${esc(season)} winner</div></header>
<div class="hero"><div class="tro">${trophy ? `<img src="${esc(trophy)}">` : TROPHY_SVG}</div>
<div class="info"><div class="kick">${esc(season)} Heisman Trophy winner</div>
<div class="nm">${rest.length ? `<span>${esc(first)}</span>${esc(rest.join(" "))}` : esc(first)}</div>
<div class="tm">${badge(team, logo, colors, 84)}<div><b>${rank_t > 0 && rank_t <= 25 ? `#${rank_t} ` : ""}${esc(short(team))}${user ? '<i class="u">🎮 LEAGUE</i>' : ""}</b>
<small>${esc([pos, cls, record && `${record} team`, coach && `Coach ${coach}`].filter(Boolean).join(" · "))}</small></div></div></div></div>
${tiles.length ? `<div class="tiles">${tiles.map(([l, v]) => `<div class="tile"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join("")}</div>` : ""}
<footer><span>Final Heisman update of the ${esc(season)} season · the watch returns in Week 0</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}

export async function renderHeadlines({ label = "", stories = [], siteLogo = "", chromeChannel = "chrome" }) {
  const [lead, ...rest] = stories;
  const html = `<!doctype html><html><head><style>${await fonts()}
${BASE}
.wrap{padding:20px 28px 4px}
.lead{background:#1f2022;border-left:6px solid #cc0000;border-radius:8px;padding:20px 22px;margin-bottom:12px}
.lead h2{font:800 38px/1.05 RC;margin-top:8px}.lead p{font:400 18px/1.4 R;color:#c9cacd;margin-top:10px}
.k{display:inline-block;font:700 12px RC;letter-spacing:.14em;text-transform:uppercase;background:#cc0000;color:#fff;padding:3px 8px;border-radius:3px}
.k.user{background:#f2b134;color:#141414}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.st{background:#1f2022;border-radius:8px;padding:14px 16px}
.st h3{font:700 22px/1.1 RC;margin-top:8px}.st p{font:400 15px/1.35 R;color:#b9babd;margin-top:6px}
</style></head><body><div class="card">
<header>${logoImg(siteLogo)}<div class="ttl"><small>TD Wire</small><h1>Around the <span>League</span></h1></div><div class="meta">${esc(label)}</div></header>
<div class="wrap">${lead ? `<div class="lead"><span class="k${lead.user ? " user" : ""}">${esc(lead.kick)}</span><h2>${esc(plain(lead.h))}</h2><p>${esc(plain(lead.d))}</p></div>` : ""}
<div class="grid">${rest.map((s) => `<div class="st"><span class="k${s.user ? " user" : ""}">${esc(s.kick)}</span><h3>${esc(plain(s.h))}</h3><p>${esc(plain(s.d))}</p></div>`).join("")}</div></div>
<footer><span>Gold tag = league coach's team · more on the site</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}

export async function renderOnDeck({ label = "", sub = "", games = [], heading = ["On", "Deck"], foot = "Coming up after this week · red outline = coach vs coach", siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const side = (t) => `<div class="sd">${badge(t.name, t.logo, colors, 40)}<div class="tx"><b>${t.rank > 0 && t.rank <= 25 ? `<i>${t.rank}</i> ` : ""}${esc(short(t.name))}</b>
    <small>${esc(t.record || "")}${t.coach ? ` · <em>🎮 ${esc(t.coach)}</em>` : " · CPU"}</small></div></div>`;
  const tile = (g) => `<div class="g${g.uvu ? " uvu" : ""}" style="--a:${teamCols(colors, g.away.name).c1};--h:${teamCols(colors, g.home.name).c1}">
    ${g.tag ? `<span class="tag">${esc(g.tag)}</span>` : ""}${side(g.away)}<span class="at">AT</span>${side(g.home)}</div>`;
  const html = `<!doctype html><html><head><style>${await fonts()}
${BADGE_CSS}
${BASE}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px 28px 4px}
.g{position:relative;display:grid;grid-template-columns:1fr 34px 1fr;align-items:center;gap:8px;background:#1f2022;border-radius:8px;padding:14px 14px 12px;overflow:hidden}
.g::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--a)}.g::after{content:"";position:absolute;right:0;top:0;bottom:0;width:5px;background:var(--h)}
.g.uvu{box-shadow:inset 0 0 0 2px #cc0000}
.sd{display:flex;align-items:center;gap:10px;min-width:0}.g .sd:last-child{flex-direction:row-reverse;text-align:right}
.tx{min-width:0}.tx b{display:block;font:700 20px/1.1 RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tx b i{font-style:normal;color:#9a9b9e;font-size:14px}
.tx small{display:block;font:500 13px R;color:#9a9b9e;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tx em{font-style:normal;color:#ff8a8a}
.at{text-align:center;font:800 15px RC;color:#6c6d6f}
.tag{position:absolute;top:0;left:50%;transform:translateX(-50%);font:700 10px RC;letter-spacing:.14em;text-transform:uppercase;background:#cc0000;color:#fff;padding:2px 8px;border-radius:0 0 4px 4px}
.empty{margin:18px 28px;color:#8a8b8e;font:500 16px R;padding:14px;background:#1f2022;border-radius:8px}
</style></head><body><div class="card">
<header>${logoImg(siteLogo)}<div class="ttl"><small>The Dynasty</small><h1>${esc(heading[0])} <span>${esc(heading[1])}</span></h1></div><div class="meta">${esc(label)}<small style="display:block;font:500 15px R;color:#9a9b9e;text-transform:none">${esc(sub)}</small></div></header>
${games.length ? `<div class="grid">${games.map(tile).join("")}</div>` : '<div class="empty">No league games that week.</div>'}
<footer><span>${esc(foot)}</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}

// #big-performances card: one row per player (league teams only).
// renderBigPerformances({ label, sub, rows:[{ name, pos, jersey, ovr, team, rank, logo, coach, chips:[..], result, opp, oppLogo }], siteLogo, colors })
export async function renderBigPerformances({ label = "", sub = "", rows = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const fontCss = await fonts();
  const row = (p) => {
    const { c1, c2 } = teamCols(colors, p.team);
    const win = /^W/.test(p.result || "");
    return `<div class="r" style="--c1:${c1};--c2:${c2}">
      <div class="lgo">${badge(p.team, p.logo, colors, 78)}${p.jersey != null ? `<span class="jn">${p.jersey}</span>` : ""}</div>
      <div class="who"><div class="nm">${esc(p.name)}</div>
        <div class="mt">${esc([p.pos, p.ovr ? `${p.ovr} OVR` : ""].filter(Boolean).join(" · "))} · ${p.rank > 0 && p.rank <= 25 ? `<i>#${p.rank}</i> ` : ""}${esc(short(p.team))}${p.coach ? `<em>🎮 ${esc(p.coach)}</em>` : ""}</div>
        <div class="ch">${p.chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div></div>
      <div class="res ${win ? "w" : "l"}"><b>${esc(p.result || "")}</b><small>${esc(p.opp || "")}</small></div></div>`;
  };
  const html = `<!doctype html><html><head><style>
${fontCss}
${BADGE_CSS}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
header{display:flex;align-items:center;gap:22px;padding:20px 32px 18px;background:#000;border-bottom:5px solid #f2b134}
header img{height:64px}
.ttl small{display:block;font:700 15px RC;letter-spacing:.22em;color:#f2b134;text-transform:uppercase}
.ttl h1{font:800 48px/0.95 RC;text-transform:uppercase}
.hm{margin-left:auto;text-align:right;font:700 22px RC;text-transform:uppercase}.hm small{display:block;font:500 15px R;color:#9a9b9e;text-transform:none}
.list{padding:16px 24px 6px;display:grid;gap:12px}
.r{display:grid;grid-template-columns:110px 1fr 190px;align-items:center;gap:18px;background:#1f2022;border-radius:10px;overflow:hidden;border-left:8px solid var(--c1)}
.lgo{position:relative;height:110px;display:grid;place-items:center;background:radial-gradient(circle,color-mix(in srgb,var(--c1) 70%,#000),#141516 80%)}
.jn{position:absolute;right:4px;bottom:-6px;font:800 46px/1 RC;color:rgba(255,255,255,.18)}
.who{padding:12px 0}
.nm{font:800 32px/1 RC;text-transform:uppercase}
.mt{font:500 15px R;color:#b9babd;margin-top:6px;display:flex;align-items:center;gap:8px}.mt i{font-style:normal;color:#9a9b9e}
.mt em{font-style:normal;font:700 12px R;background:#cc0000;color:#fff;padding:2px 7px;border-radius:3px}
.ch{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ch span{font:800 19px RC;background:#2a2b2e;border-left:4px solid #f2b134;padding:5px 11px;border-radius:4px}
.res{text-align:center;padding:0 16px}.res b{display:block;font:800 30px RC}.res.w b{color:#3ecf6e}.res.l b{color:#ff5a5a}
.res small{display:block;font:500 14px R;color:#9a9b9e;margin-top:4px}
footer{display:flex;justify-content:flex-end;padding:10px 28px 14px;font:700 14px R;border-top:1px solid #26282a;margin-top:8px}
</style></head><body><div class="card">
<header>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}<div class="ttl"><small>League coaches</small><h1>Big Performances</h1></div><div class="hm">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</div></header>
<div class="list">${rows.map(row).join("")}</div>
<footer>thedynastycfb.com</footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}
