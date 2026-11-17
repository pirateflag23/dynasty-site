// The Dynasty: smaller weekly graphics → PNG.
//   renderAdvance({ week, year, season, lines, siteLogo })                 #announcements on each new week
//   renderHeisman({ label, players:[{ rank, name, pos, cls, team, rank_t, logo, last, stat, isNew, move, user }], siteLogo, colors })
//   renderHeadlines({ label, stories:[{ kick, h, d, user }], siteLogo })
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

export async function renderAdvance({ week = "", year = "", season = "", lines = [], siteLogo = "", chromeChannel = "chrome" }) {
  const html = `<!doctype html><html><head><style>${await fonts()}
${BASE}
.adv{position:relative;padding:54px 40px 46px;text-align:center;overflow:hidden;
  background:radial-gradient(ellipse at 50% 0%,rgba(204,0,0,.35),transparent 60%),repeating-linear-gradient(115deg,transparent 0 22px,rgba(255,255,255,.025) 22px 44px),#0f1011}
.adv img{height:150px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.7))}
.kick{font:700 22px RC;letter-spacing:.34em;color:#cc0000;text-transform:uppercase;margin-top:22px}
.wk{font:800 120px/0.95 RC;text-transform:uppercase;margin-top:6px;text-shadow:0 4px 18px rgba(0,0,0,.6)}
.yr{display:inline-block;margin-top:14px;font:700 24px RC;letter-spacing:.12em;text-transform:uppercase;background:#cc0000;padding:6px 18px;border-radius:4px}
.notes{display:grid;gap:12px;padding:26px 60px 8px}
.note{display:flex;align-items:center;gap:16px;background:#1f2022;border-left:6px solid #cc0000;border-radius:6px;padding:16px 20px;font:700 26px RC}
.note i{font-style:normal;font-size:26px}
</style></head><body><div class="card">
<div class="adv">${logoImg(siteLogo, 150)}
  <div class="kick">We have advanced to</div>
  <div class="wk">${esc(week)}</div>
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
<header>${logoImg(siteLogo)}<div class="ttl"><small>The Dynasty</small><h1>Around the <span>League</span></h1></div><div class="meta">${esc(label)}</div></header>
<div class="wrap">${lead ? `<div class="lead"><span class="k${lead.user ? " user" : ""}">${esc(lead.kick)}</span><h2>${esc(plain(lead.h))}</h2><p>${esc(plain(lead.d))}</p></div>` : ""}
<div class="grid">${rest.map((s) => `<div class="st"><span class="k${s.user ? " user" : ""}">${esc(s.kick)}</span><h3>${esc(plain(s.h))}</h3><p>${esc(plain(s.d))}</p></div>`).join("")}</div></div>
<footer><span>Gold tag = league coach's team · more on the site</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}
