// The Dynasty #scores weekly scoreboard → PNG.
// renderScores({ label, sub, league, upsets, ranked, siteLogo, colors }) → PNG Buffer
//   each game: { away:{ name, rank, score, logo, coach }, home:{...} }   (coach set → league coach's team)
import { fonts, esc, short, badge, BADGE_CSS, shoot, teamCols } from "./common.mjs";

const rk = (r) => (r > 0 && r <= 25 ? `<i>${r}</i>` : "");

function line(t, won, colors) {
  return `<div class="tl${won ? " w" : ""}">${badge(t.name, t.logo, colors, 26)}${rk(t.rank)}<span class="n">${esc(short(t.name))}</span>${t.coach ? `<em>🎮 ${esc(t.coach)}</em>` : ""}<b>${t.score}</b></div>`;
}
const tile = (g, colors, cls = "") => {
  const aw = g.away.score > g.home.score, hw = g.home.score > g.away.score;
  const win = aw ? g.away : g.home;
  return `<div class="g ${cls}" style="--tc:${teamCols(colors, win.name).c1}">${line(g.away, aw, colors)}${line(g.home, hw, colors)}</div>`;
};

export async function renderScores({ label = "", sub = "", league = [], upsets = [], ranked = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const fontCss = await fonts();
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
.sec{padding:16px 28px 4px}
h2{font:700 13px RC;letter-spacing:.16em;color:#6c6d6f;text-transform:uppercase;margin-bottom:10px}
h2.gold{color:#f2b134}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.grid.big{grid-template-columns:repeat(2,1fr)}
.g{position:relative;background:#1f2022;border-radius:6px;padding:8px 12px 8px 16px;overflow:hidden}
.g::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--tc)}
.g.up{box-shadow:inset 0 0 0 2px #f2b134}
.g.lg{box-shadow:inset 0 0 0 2px #cc0000}
.tl{display:flex;align-items:center;gap:8px;height:34px;color:#8a8b8e}
.tl.w{color:#fff}
.tl i{font-style:normal;font:700 13px RC;color:#9a9b9e}
.tl .n{font:700 19px RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.tl em{font-style:normal;font:700 11px R;background:#cc0000;color:#fff;padding:1px 6px;border-radius:3px;white-space:nowrap}
.tl b{font:800 24px RC;min-width:34px;text-align:right}
.big .tl{height:44px}.big .tl .n{font-size:24px}.big .tl b{font-size:32px}
.empty{color:#8a8b8e;font:500 15px R;padding:12px 14px;background:#1f2022;border-radius:6px}
footer{display:flex;justify-content:space-between;padding:10px 28px 14px;font:500 14px R;color:#9a9b9e;border-top:1px solid #26282a;margin-top:12px}footer b{color:#ededee}
</style></head><body><div class="card">
<header>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}<div class="ttl"><small>The Dynasty</small><h1>Score<span>board</span></h1></div>
  <div class="meta">${esc(label)}<small>${esc(sub)}</small></div></header>
<div class="sec"><h2>League games</h2>${league.length ? `<div class="grid big">${league.map((g) => tile(g, colors, "lg")).join("")}</div>` : '<div class="empty">No league games this week.</div>'}</div>
${upsets.length ? `<div class="sec"><h2 class="gold">Upsets</h2><div class="grid">${upsets.map((g) => tile(g, colors, "up")).join("")}</div></div>` : ""}
${ranked.length ? `<div class="sec"><h2>Top 25 around the country</h2><div class="grid">${ranked.map((g) => tile(g, colors)).join("")}</div></div>` : ""}
<footer><span>Box scores for every game on the site</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}
