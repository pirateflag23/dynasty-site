// The Dynasty Players of the Week card → PNG (one per conference channel).
// renderPotw({ label, scope, players, siteLogo, colors }) → PNG Buffer
//   scope: "National" or a conference name
//   players: [{ side:"Offense"|"Defense", name, pos, jersey, cls, ovr, team, rank, logo, game, stat, user, coach }]
import { fonts, esc, short, badge, BADGE_CSS, shoot, teamCols } from "./common.mjs";

function panel(p, colors) {
  const { c1, c2 } = teamCols(colors, p.team);
  const stats = String(p.stat || "").split(/\n|,\s*/).map((s) => s.trim()).filter(Boolean);
  return `<div class="pl" style="--c1:${c1};--c2:${c2}">
    <div class="side">${esc(p.side)}</div>
    <div class="hero"><div class="logo">${badge(p.team, p.logo, colors, 150)}</div>${p.jersey != null ? `<span class="num">${p.jersey}</span>` : ""}</div>
    <div class="info">
      <div class="nm">${esc(p.name)}</div>
      <div class="meta">${esc(p.pos)}${p.cls ? ` · ${esc(p.cls)}` : ""}${p.ovr ? ` · ${p.ovr} OVR` : ""}</div>
      <div class="tm">${p.rank > 0 && p.rank <= 25 ? `<i>#${p.rank}</i> ` : ""}${esc(short(p.team))}${p.user ? `<em>🎮 ${esc(p.coach || "League coach")}</em>` : ""}</div>
      <div class="gm">${esc(p.game)}</div>
      <div class="st">${stats.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
    </div></div>`;
}

export async function renderPotw({ label = "", scope = "National", players = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const fontCss = await fonts();
  const html = `<!doctype html><html><head><style>
${fontCss}
${BADGE_CSS}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
header{position:relative;display:flex;align-items:center;gap:22px;padding:20px 32px 18px;background:#000;border-bottom:5px solid ${scope === "National" ? "#f2b134" : "#cc0000"}}
header img{height:64px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.ttl small{display:block;font:700 15px RC;letter-spacing:.22em;color:${scope === "National" ? "#f2b134" : "#cc0000"};text-transform:uppercase}
.ttl h1{font:800 48px/0.95 RC;text-transform:uppercase}
.mt{margin-left:auto;text-align:right;font:700 22px RC;text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(${Math.min(Math.max(players.length, 1), 2)},1fr);gap:18px;padding:20px 28px 10px}
.pl{position:relative;border-radius:10px;overflow:hidden;background:#1f2022}
.side{position:absolute;top:14px;left:14px;z-index:2;font:800 14px RC;letter-spacing:.18em;text-transform:uppercase;background:rgba(0,0,0,.55);padding:4px 10px;border-radius:3px}
.hero{position:relative;height:210px;display:grid;place-items:center;overflow:hidden;
  background:radial-gradient(circle at 50% 45%,color-mix(in srgb,var(--c1) 80%,#fff 8%),var(--c1) 55%,color-mix(in srgb,var(--c1) 50%,#000));border-bottom:6px solid var(--c2)}
.hero .logo{position:relative;z-index:1}
.num{position:absolute;right:18px;bottom:-14px;font:800 150px/1 RC;color:rgba(255,255,255,.14)}
.info{padding:16px 18px 18px}
.nm{font:800 38px/1 RC;text-transform:uppercase}
.meta{font:500 15px R;color:#b9babd;margin-top:6px}
.tm{font:700 20px RC;text-transform:uppercase;margin-top:10px;display:flex;align-items:center;gap:8px}.tm i{font-style:normal;color:#9a9b9e}
.tm em{font-style:normal;font:700 12px R;background:#cc0000;color:#fff;padding:2px 7px;border-radius:3px;text-transform:none}
.gm{font:500 15px R;color:#9a9b9e;margin-top:4px}
.st{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.st span{font:800 20px RC;background:#2a2b2e;border-left:4px solid var(--c1);padding:6px 12px;border-radius:4px}
footer{display:flex;justify-content:flex-end;padding:8px 28px 14px;font:700 14px R;border-top:1px solid #26282a;margin-top:6px}
</style></head><body><div class="card">
<header>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}<div class="ttl"><small>${esc(scope === "National" ? "National" : scope)}</small><h1>Players of the Week</h1></div><div class="mt">${esc(label)}</div></header>
<div class="grid">${players.map((p) => panel(p, colors)).join("")}</div>
<footer>thedynastycfb.com</footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}
