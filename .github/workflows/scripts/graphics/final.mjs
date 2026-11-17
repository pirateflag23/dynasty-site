// The Dynasty #final box score graphic → PNG.
// renderFinal({ week, date, away, home, siteLogo, colors }) → PNG Buffer
//   away/home: { name, abbrev, rank, score, quarters:[q1..q4, ot?], coach, logo, stats:{...API team Stats}, leaders:[{ tag, name, line }] }
import { fonts, esc, short, badge, BADGE_CSS, shoot, teamCols, lum } from "./common.mjs";
const rgb = (h) => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const near = (a, b) => { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110; };

const mmss = (sec) => `${Math.floor((sec || 0) / 60)}:${String((sec || 0) % 60).padStart(2, "0")}`;
const n = (v) => Number(v) || 0;

// [label, value fn, number used for the bar (null = no bar), lowerIsBetter]
const STATS = [
  ["Total yards", (s) => n(s.totalYardsGained) || n(s.offYardsGained)],
  ["Passing", (s) => n(s.offPassYards)],
  ["Rushing", (s) => n(s.offRushYards)],
  ["Yards / play", (s) => (n(s.offYardsPerPlay)).toFixed(1), (s) => n(s.offYardsPerPlay)],
  ["First downs", (s) => n(s.offFirstdown)],
  ["3rd down", (s) => `${n(s.thirdDownConversions)}/${n(s.thirdDowns)}`, (s) => (s.thirdDowns ? s.thirdDownConversions / s.thirdDowns : 0)],
  ["Turnovers", (s) => n(s.turnovers), null, true],
  ["Penalties", (s) => `${n(s.penalties)}-${n(s.penaltyYards)}`, (s) => n(s.penaltyYards), true],
  ["Possession", (s) => mmss(s.possessionSeconds), (s) => n(s.possessionSeconds)],
];

function side(t, won, colors, align) {
  const { c1, c2 } = teamCols(colors, t.name);
  return `<div class="side ${align}${won ? " won" : " lost"}" style="--c1:${c1};--c2:${c2}">
    <div class="logo">${badge(t.name, t.logo, colors, 120)}</div>
    <div class="who">
      <div class="rk">${t.rank > 0 && t.rank <= 25 ? `#${t.rank}` : "&nbsp;"}</div>
      <div class="tn">${esc(short(t.name))}</div>
      <div class="cn">${t.coach ? `<em>🎮 ${esc(t.coach)}</em>` : "<span>CPU</span>"}</div>
    </div>
    <div class="sc">${t.score}</div>
  </div>`;
}

// Bar/accent colors for each side, kept apart when both teams wear similar colors.
function sideColors(A, H, colors) {
  const A0 = teamCols(colors, A.name), H0 = teamCols(colors, H.name);
  return [A0.c1, near(A0.c1, H0.c1) ? (near(A0.c1, H0.c2) || lum(H0.c2) > 0.85 ? "#8a8b8e" : H0.c2) : H0.c1];
}
function statRows(A, H, colors) {
  const [ca, ch] = sideColors(A, H, colors);
  return STATS.map(([label, val, num = val, low]) => {
    const a = num ? Number(num(A.stats || {})) : 0, h = num ? Number(num(H.stats || {})) : 0;
    const tot = a + h, pa = tot ? (a / tot) * 100 : 50;
    const aBest = low ? a < h : a > h, hBest = low ? h < a : h > a;
    return `<div class="st"><b class="${aBest ? "best" : ""}">${esc(val(A.stats || {}))}</b><span>${label}</span><b class="${hBest ? "best" : ""}">${esc(val(H.stats || {}))}</b>
      <i class="bar"><i style="width:${pa}%;background:${ca}"></i><i style="width:${100 - pa}%;background:${ch}"></i></i></div>`;
  }).join("");
}

const leaderCol = (t, color) => `<div class="lc" style="--c1:${color};--ink:${lum(color) > 0.4 ? "#121213" : "#fff"}"><h3>${esc(t.abbrev || short(t.name))}</h3>${(t.leaders || []).map((l) =>
  `<div class="ld"><i>${esc(l.tag)}</i><div><b>${esc(l.name)}</b><span>${esc(l.line)}</span></div></div>`).join("") || '<div class="ld"><div><span>—</span></div></div>'}</div>`;

export async function renderFinal({ week = "", date = "", away, home, siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const fontCss = await fonts();
  const ot = Math.max(away.quarters?.length || 0, home.quarters?.length || 0) > 4 && (n(away.quarters?.[4]) || n(home.quarters?.[4]));
  const qs = ot ? 5 : 4, qh = ["1", "2", "3", "4", "OT"].slice(0, qs);
  const line = (t) => `<tr><th>${badge(t.name, t.logo, colors, 26)}${esc(t.abbrev || short(t.name))}</th>${Array.from({ length: qs }, (_, i) => `<td>${n(t.quarters?.[i])}</td>`).join("")}<td class="t">${t.score}</td></tr>`;
  const aw = away.score > home.score, hw = home.score > away.score;

  const html = `<!doctype html><html><head><style>
${fontCss}
${BADGE_CSS}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
.top{display:flex;align-items:center;gap:14px;padding:14px 28px;background:#000;border-bottom:4px solid #cc0000}
.top .fin{font:800 22px RC;letter-spacing:.12em;background:#cc0000;color:#fff;padding:4px 14px;border-radius:3px}
.top .wk{font:700 20px RC;text-transform:uppercase;letter-spacing:.04em}.top .wk small{font:500 15px R;color:#9a9b9e;text-transform:none;margin-left:10px;letter-spacing:0}
.top img{height:40px;margin-left:auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.board{display:grid;grid-template-columns:1fr 1fr;position:relative}
.side{position:relative;display:flex;align-items:center;gap:18px;height:190px;padding:0 30px;overflow:hidden}
.side::before{content:"";position:absolute;inset:0;background:linear-gradient(var(--ang),color-mix(in srgb,var(--c1) 85%,#000) 0,color-mix(in srgb,var(--c1) 40%,#111) 60%,#141517 100%)}
.side.l{--ang:90deg}.side.r{--ang:270deg;flex-direction:row-reverse;text-align:right}
.side::after{content:"";position:absolute;top:0;bottom:0;width:6px;background:var(--c2)}.side.l::after{left:0}.side.r::after{right:0}
.side>*{position:relative}
.logo{flex:none;display:grid;place-items:center;width:120px;height:120px}
.who{flex:1;min-width:0}
.rk{font:800 20px RC;color:rgba(255,255,255,.75)}
.tn{font:800 40px/1 RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 6px rgba(0,0,0,.4)}
.cn{margin-top:8px}.cn em{font-style:normal;font:700 13px R;background:#cc0000;color:#fff;padding:2px 8px;border-radius:3px}.cn span{font:700 13px R;color:rgba(255,255,255,.55);letter-spacing:.1em}
.sc{flex:none;font:800 104px/1 RC;letter-spacing:-.02em;text-shadow:0 3px 10px rgba(0,0,0,.45)}
.lost .sc{color:rgba(255,255,255,.45)}
.won .sc::after{content:"";display:inline-block;width:0;height:0;border:12px solid transparent;vertical-align:middle;margin:0 0 0 8px}
.side.l.won .sc::after{display:none}
.side.r.won .sc::after{display:none}
.strip{display:flex;justify-content:center;background:#0b0c0d;border-bottom:1px solid #26282a;padding:12px 0}.mid{background:#17181a;border:1px solid #303235;border-radius:8px;padding:6px 14px}
table{border-collapse:collapse;font:700 18px RC}
th{display:flex;align-items:center;gap:7px;padding:3px 10px 3px 2px;text-align:left;min-width:92px}
th .tb{font-size:9px!important}
td{width:38px;text-align:center;color:#9a9b9e}td.t{color:#fff;font-weight:800;font-size:21px;width:46px;border-left:1px solid #303235}
thead td{font:700 12px RC;letter-spacing:.1em;color:#6c6d6f;padding-bottom:2px}
.body{display:grid;grid-template-columns:1.08fr 1fr;gap:22px;padding:20px 28px 10px}
h2{font:700 13px RC;letter-spacing:.16em;color:#6c6d6f;text-transform:uppercase;margin-bottom:10px}
.st{display:grid;grid-template-columns:96px 1fr 96px;align-items:center;row-gap:5px;margin-bottom:9px}
.st b{font:700 21px RC;color:#9a9b9e}.st b:last-of-type{text-align:right}.st b.best{color:#fff}
.st span{font:500 14px R;color:#b9babd;text-align:center}
.bar{grid-column:1/-1;display:flex;height:6px;border-radius:3px;overflow:hidden;background:#26282a;gap:2px}.bar i{display:block;height:100%}
.leaders{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lc h3{font:800 18px RC;letter-spacing:.06em;border-bottom:3px solid var(--c1);padding-bottom:4px;margin-bottom:8px}
.ld{display:flex;gap:10px;align-items:flex-start;background:#1f2022;border-radius:6px;padding:9px 10px;margin-bottom:7px}
.ld i{font-style:normal;font:700 11px RC;letter-spacing:.08em;color:var(--ink);background:var(--c1);border-radius:3px;padding:3px 0;width:40px;text-align:center;flex:none;margin-top:2px}
.ld b{display:block;font:700 18px/1.1 RC}.ld span{display:block;font:500 14px R;color:#b9babd;margin-top:2px}
footer{display:flex;justify-content:flex-end;padding:8px 28px 14px;font:700 14px R;color:#ededee;border-top:1px solid #26282a;margin-top:6px}
</style></head><body><div class="card">
<div class="top"><span class="fin">FINAL${ot ? " / OT" : ""}</span><span class="wk">${esc(week)}<small>${esc(date)}</small></span>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}</div>
<div class="board">${side(away, aw, colors, "l")}${side(home, hw, colors, "r")}</div>
  <div class="strip"><div class="mid"><table><thead><tr><td></td>${qh.map((q) => `<td>${q}</td>`).join("")}<td>T</td></tr></thead><tbody>${line(away)}${line(home)}</tbody></table></div></div>
<div class="body">
  <section><h2>Team stats</h2>${statRows(away, home, colors)}</section>
  <section><h2>Leaders</h2><div class="leaders">${leaderCol(away, sideColors(away, home, colors)[0])}${leaderCol(home, sideColors(away, home, colors)[1])}</div></section>
</div>
<footer>thedynastycfb.com</footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}

// Top passer / rusher / receiver / defender for one team from the API box score.
export function leadersFor(players, teamKey) {
  const ps = (players || []).filter((p) => p.Team === teamKey), S = (p) => p.Stats || {};
  const top = (k) => ps.filter((p) => S(p)[k] > 0).sort((a, c) => S(c)[k] - S(a)[k])[0];
  const out = [];
  const qb = top("passAttempts"); if (qb) { const s = S(qb); out.push({ tag: "PASS", name: qb.Name, line: `${s.passCompletion}/${s.passAttempts}, ${s.passYards} yds, ${s.passTD || 0} TD${s.passINT ? `, ${s.passINT} INT` : ""}` }); }
  const rb = top("rushYards"); if (rb) { const s = S(rb); out.push({ tag: "RUSH", name: rb.Name, line: `${s.rushAttempts} car, ${s.rushYards} yds${s.rushTD ? `, ${s.rushTD} TD` : ""}` }); }
  const wr = top("receivingYards"); if (wr) { const s = S(wr); out.push({ tag: "REC", name: wr.Name, line: `${s.receiveReceptions} rec, ${s.receivingYards} yds${s.receiveTouchdowns ? `, ${s.receiveTouchdowns} TD` : ""}` }); }
  const dv = (p) => n(S(p).defenseTotalTackles) + n(S(p).defenseSacks) * 3 + n(S(p).defenseInterceptions) * 4;
  const df = ps.filter((p) => dv(p) > 0).sort((a, c) => dv(c) - dv(a))[0];
  if (df) { const s = S(df); out.push({ tag: "DEF", name: df.Name, line: `${s.defenseTotalTackles || 0} tkl${s.defenseSacks ? `, ${s.defenseSacks} sk` : ""}${s.defenseInterceptions ? `, ${s.defenseInterceptions} INT` : ""}` }); }
  return out;
}
