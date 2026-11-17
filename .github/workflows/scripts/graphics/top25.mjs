// The Dynasty Top 25 graphic → PNG. Renders an HTML card in headless Chrome and screenshots it.
// renderTop25({ label, sub, teams:[{rank,name,conference,record,prev,user,coach,logo}], dropped, siteLogo, colors }) → PNG Buffer
//   prev: undefined = no earlier poll (movement column hidden) · 0/26+ = NEW · n = last poll rank
//   logo: image URL (falls back to a team-color badge if missing or it fails to load)
import { fonts, esc, CONF, short, badge, BADGE_CSS, shoot, siteTeamColors } from "./common.mjs";
export { siteTeamColors };

function move(t) {
  if (t.prev === undefined) return "";                       // no prior poll available
  if (!t.prev || t.prev > 25) return `<i class="mv new">NEW</i>`;
  const d = t.prev - t.rank;
  return d === 0 ? `<i class="mv eq">–</i>` : d > 0 ? `<i class="mv up">▲${d}</i>` : `<i class="mv dn">▼${-d}</i>`;
}

function row(t, colors) {
  const c1 = (colors[t.name] || [])[0] || "#555555";
  const b = badge(t.name, t.logo, colors, 46);
  return `<div class="row${t.user ? " user" : ""}" style="--tc:${c1}">
    <b class="rk">${t.rank}</b>${b}
    <div class="nm"><b>${esc(short(t.name))}</b>
      <small>${esc(CONF[t.conference] || t.conference || "")}${t.user ? `<em>🎮 ${esc(t.coach || "USER")}</em>` : ""}</small></div>
    <span class="rec">${esc(t.record)}</span>${move(t)}</div>`;
}

export async function renderTop25({ label, sub = "", teams, dropped = [], siteLogo, colors = {}, chromeChannel = "chrome" }) {
  const fontCss = await fonts();
  const top = [...teams].sort((a, b) => a.rank - b.rank).slice(0, 25);
  const cols = [top.slice(0, 13), top.slice(13)];
  const hasMove = top.some((t) => t.prev !== undefined);

  const html = `<!doctype html><html><head><style>
${fontCss}
${BADGE_CSS}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
header{position:relative;display:flex;align-items:center;gap:22px;padding:26px 36px 24px;background:#000;border-bottom:5px solid #cc0000}
header::after{content:"";position:absolute;right:0;top:0;bottom:0;width:420px;background:repeating-linear-gradient(115deg,transparent 0 18px,rgba(204,0,0,.10) 18px 36px)}
header img{height:84px;position:relative;z-index:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.ttl{position:relative;z-index:1}
.ttl small{display:block;font:700 15px RC;letter-spacing:.22em;color:#cc0000;text-transform:uppercase}
.ttl h1{font:800 64px/0.95 RC;letter-spacing:-.01em;text-transform:uppercase}
.ttl h1 span{color:#cc0000}
.meta{margin-left:auto;text-align:right;position:relative;z-index:1;font:700 22px RC;text-transform:uppercase;line-height:1.15}
.meta small{display:block;font:500 15px R;color:#9a9b9e;text-transform:none}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 22px;padding:20px 28px 10px}
.colh{display:grid;grid-template-columns:52px 50px 1fr 70px ${hasMove ? "56px" : "0"};gap:12px;padding:0 14px 8px;font:700 12px RC;letter-spacing:.14em;color:#6c6d6f;text-transform:uppercase}
.colh span:nth-child(4){text-align:right}.colh span:nth-child(5){text-align:center}
.row{position:relative;display:grid;grid-template-columns:52px 50px 1fr 70px ${hasMove ? "56px" : "0"};gap:12px;align-items:center;height:62px;padding:0 14px;margin-bottom:6px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--tc) 30%,#1f2022) 0,#1f2022 38%);border-radius:6px;overflow:hidden}
.row::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--tc)}
.row.user{background:linear-gradient(90deg,color-mix(in srgb,var(--tc) 45%,#2a1214) 0,#2a1517 55%,#1f2022);box-shadow:inset 0 0 0 2px #cc0000}
.rk{font:800 34px RC;text-align:center;color:#fff}
.nm b{display:block;font:700 25px/1.05 RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm small{font:500 13px R;color:#9a9b9e;letter-spacing:.06em;text-transform:uppercase}
.nm em{font-style:normal;text-transform:none;margin-left:8px;padding:1px 7px;border-radius:3px;background:#cc0000;color:#fff;font:700 11px R;letter-spacing:.05em}
.rec{font:700 24px RC;text-align:right}
.mv{font:700 15px RC;font-style:normal;text-align:center;border-radius:4px;padding:3px 0}
.up{color:#3ccf6e;background:rgba(60,207,110,.12)}.dn{color:#ff5a5a;background:rgba(255,90,90,.12)}.eq{color:#6c6d6f}.new{color:#f2b134;background:rgba(242,177,52,.14)}
footer{display:flex;justify-content:space-between;gap:20px;padding:12px 36px 18px;font:500 14px R;color:#9a9b9e;border-top:1px solid #26282a;margin-top:6px}
footer b{color:#ededee;font-weight:700}
</style></head><body><div class="card">
<header>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}<div class="ttl"><small>The Dynasty</small><h1>Top <span>25</span></h1></div>
  <div class="meta">${esc(label)}<small>${esc(sub)}</small></div></header>
<div class="grid">${cols.map((c) => `<div><div class="colh"><span>RK</span><span></span><span>Team</span><span>Rec</span><span>${hasMove ? "+/−" : ""}</span></div>${c.map((t) => row(t, colors)).join("")}</div>`).join("")}</div>
<footer><span>${dropped.length ? `<b>Dropped out:</b> ${esc(dropped.join(", "))}` : "&nbsp;"}</span><span><b>thedynastycfb.com</b></span></footer>
</div></body></html>`;

  return shoot(html, { chromeChannel });
}
