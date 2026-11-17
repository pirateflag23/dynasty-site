// The Dynasty #recruiting report graphic → PNG.
// renderRecruiting({ label, sub, classes, commits, battles, siteLogo, colors }) → PNG Buffer
//   classes: [{ rank, name, prev, user, total, five, four, points, logo }]          (top 10)
//   commits: [{ stars, pos, name, rank, state, school, logo, user, from }]          (from = previous school on a flip)
//   battles: [{ stars, pos, name, rank, state, schools:[{ name, logo, inf, user }] }]
import { fonts, esc, short, badge, BADGE_CSS, shoot, teamCols, lum } from "./common.mjs";

const rgb = (h) => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const near = (a, b) => { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110; };
const starStr = (n) => `<span class="stars">${"★".repeat(n || 0)}<s>${"★".repeat(Math.max(0, 5 - (n || 0)))}</s></span>`;

function move(c) {
  if (c.prev === undefined) return "";
  if (!c.prev) return `<i class="mv new">NEW</i>`;
  const d = c.prev - c.rank;
  return d === 0 ? `<i class="mv eq">–</i>` : d > 0 ? `<i class="mv up">▲${d}</i>` : `<i class="mv dn">▼${-d}</i>`;
}

const classRow = (c, colors) => `<div class="cl${c.user ? " user" : ""}" style="--tc:${teamCols(colors, c.name).c1}">
  <b class="rk">${c.rank}</b>${badge(c.name, c.logo, colors, 40)}
  <div class="nm"><b>${esc(short(c.name))}</b><small>${c.total} commits · ${c.five} five-star · ${c.four} four-star${c.user ? " · 🎮" : ""}</small></div>
  <span class="pts">${Number(c.points || 0).toFixed(1)}<small>PTS</small></span>${move(c)}</div>`;

const commitRow = (r, colors) => `<div class="cm${r.user ? " user" : ""}">
  ${r.from ? `<i class="flip">FLIP</i>` : ""}<div class="who">${starStr(r.stars)}<b>${esc(r.name)}</b><small>${esc(r.pos)} · #${r.rank}${r.state ? ` · ${esc(r.state)}` : ""}${r.from ? ` · from ${esc(short(r.from))}` : ""}</small></div>
  <span class="arrow">→</span>${badge(r.school, r.logo, colors, 36)}<span class="sch">${esc(short(r.school))}</span></div>`;

function battleRow(r, colors) {
  const [a, b, c] = r.schools;
  const ca = teamCols(colors, a.name).c1, cb0 = teamCols(colors, b.name);
  const cb = near(ca, cb0.c1) ? (lum(cb0.c2) > 0.85 ? "#8a8b8e" : cb0.c2) : cb0.c1;
  const tot = a.inf + b.inf, pa = tot ? (a.inf / tot) * 100 : 50;
  return `<div class="bt">
    <div class="who">${starStr(r.stars)}<b>${esc(r.name)}</b><small>${esc(r.pos)} · #${r.rank}${r.state ? ` · ${esc(r.state)}` : ""}</small></div>
    <div class="vs"><span class="s${a.user ? " user" : ""}">${badge(a.name, a.logo, colors, 28)}${esc(short(a.name))}<b>${a.inf}</b></span>
      <span class="s r${b.user ? " user" : ""}"><b>${b.inf}</b>${esc(short(b.name))}${badge(b.name, b.logo, colors, 28)}</span></div>
    <i class="bar"><i style="width:${pa}%;background:${ca}"></i><i style="width:${100 - pa}%;background:${cb}"></i></i>
    ${c ? `<small class="third">Also: ${esc(short(c.name))} ${c.inf}</small>` : ""}</div>`;
}

export async function renderRecruiting({ label = "", sub = "", classes = [], commits = [], battles = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const fontCss = await fonts();
  const top = classes.slice(0, 10), cols = [top.slice(0, 5), top.slice(5, 10)];
  const hasMove = top.some((c) => c.prev !== undefined);
  const html = `<!doctype html><html><head><style>
${fontCss}
${BADGE_CSS}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
header{position:relative;display:flex;align-items:center;gap:22px;padding:22px 32px 20px;background:#000;border-bottom:5px solid #cc0000}
header::after{content:"";position:absolute;right:0;top:0;bottom:0;width:420px;background:repeating-linear-gradient(115deg,transparent 0 18px,rgba(204,0,0,.10) 18px 36px)}
header img{height:72px;position:relative;z-index:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.ttl{position:relative;z-index:1}.ttl small{display:block;font:700 15px RC;letter-spacing:.22em;color:#cc0000;text-transform:uppercase}
.ttl h1{font:800 54px/0.95 RC;text-transform:uppercase}.ttl h1 span{color:#cc0000}
.meta{margin-left:auto;text-align:right;position:relative;z-index:1;font:700 22px RC;text-transform:uppercase;line-height:1.15}
.meta small{display:block;font:500 15px R;color:#9a9b9e;text-transform:none}
h2{font:700 13px RC;letter-spacing:.16em;color:#6c6d6f;text-transform:uppercase;margin:0 0 10px}
.sec{padding:18px 28px 6px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
.cl{position:relative;display:grid;grid-template-columns:40px 40px 1fr 70px ${hasMove ? "52px" : "0"};gap:12px;align-items:center;height:58px;padding:0 12px;margin-bottom:6px;border-radius:6px;overflow:hidden;
  background:linear-gradient(90deg,color-mix(in srgb,var(--tc) 30%,#1f2022) 0,#1f2022 40%)}
.cl::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--tc)}
.cl.user{box-shadow:inset 0 0 0 2px #cc0000}
.cl .rk{font:800 28px RC;text-align:center}
.cl .nm b{display:block;font:700 22px/1.05 RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl .nm small{font:500 13px R;color:#9a9b9e}
.pts{font:800 24px RC;text-align:right}.pts small{display:block;font:700 10px RC;letter-spacing:.14em;color:#6c6d6f;margin-top:-2px}
.mv{font:700 14px RC;font-style:normal;text-align:center;border-radius:4px;padding:3px 0}
.up{color:#3ccf6e;background:rgba(60,207,110,.12)}.dn{color:#ff5a5a;background:rgba(255,90,90,.12)}.eq{color:#6c6d6f}.new{color:#f2b134;background:rgba(242,177,52,.14)}
.lower{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:12px 28px 6px}
.stars{color:#f2b134;font-size:15px;letter-spacing:1px;margin-right:8px}.stars s{text-decoration:none;color:#3a3b3e}
.who b{font:700 20px RC;margin-right:8px}.who small{display:block;font:500 13px R;color:#9a9b9e;margin-top:1px}
.cm{display:flex;gap:10px;align-items:center;background:#1f2022;border-radius:6px;padding:8px 12px;margin-bottom:6px}
.cm.user{box-shadow:inset 0 0 0 2px #cc0000}
.cm .flip{font-style:normal;font:700 11px RC;letter-spacing:.08em;background:#f2b134;color:#141414;border-radius:3px;padding:3px 6px}
.cm .who{flex:1;min-width:0}.cm .arrow{color:#6c6d6f;font:700 18px R}.cm .sch{width:150px;font:700 16px RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt{background:#1f2022;border-radius:6px;padding:10px 12px;margin-bottom:8px}
.vs{display:flex;justify-content:space-between;margin-top:8px;font:700 15px RC;text-transform:uppercase}
.vs .s{display:flex;align-items:center;gap:7px}.vs .s b{font:800 17px RC;color:#fff;margin-left:4px}.vs .s.r b{margin:0 4px 0 0}
.vs .s.user{color:#ff6b6b}
.bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:#26282a;margin-top:6px;gap:2px}.bar i{display:block;height:100%}
.third{display:block;font:500 12px R;color:#8a8b8e;margin-top:5px}
.empty{color:#8a8b8e;font:500 15px R;padding:14px;background:#1f2022;border-radius:6px}
footer{display:flex;justify-content:space-between;padding:10px 28px 14px;font:500 14px R;color:#9a9b9e;border-top:1px solid #26282a;margin-top:8px}footer b{color:#ededee}
</style></head><body><div class="card">
<header>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}<div class="ttl"><small>The Dynasty</small><h1>Recruiting <span>Report</span></h1></div>
  <div class="meta">${esc(label)}<small>${esc(sub)}</small></div></header>
<div class="sec"><h2>Top 10 classes</h2><div class="grid2">${cols.map((c) => `<div>${c.map((x) => classRow(x, colors)).join("")}</div>`).join("")}</div></div>
<div class="lower">
  <section><h2>Biggest commitments this week</h2>${commits.length ? commits.map((r) => commitRow(r, colors)).join("") : '<div class="empty">No new commitments this week.</div>'}</section>
  <section><h2>Top recruiting battles</h2>${battles.length ? battles.map((r) => battleRow(r, colors)).join("") : '<div class="empty">No contested recruits right now.</div>'}</section>
</div>
<footer><span>Highlighted = league coach's school · full board on the site</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}
