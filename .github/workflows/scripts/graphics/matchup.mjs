// The Dynasty matchup preview card → PNG (posted in each game's matchup chat).
// renderMatchup({ week, date, tag, away, home, siteLogo, colors }) → PNG Buffer
//   tag: rivalry name, "Conference game", etc. (optional banner)
//   away/home: { name, rank, record, confRecord, conference, ovr, off, def, ppg, oppg, last, coach, logo, leaders:[{ tag, name, line }] }
import { fonts, esc, short, badge, BADGE_CSS, shoot, teamCols, lum, CONF } from "./common.mjs";

const rgb = (h) => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
const near = (a, b) => { const [x, y] = [rgb(a), rgb(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110; };
function sideColors(A, H, colors) {
  const A0 = teamCols(colors, A.name), H0 = teamCols(colors, H.name);
  return [A0.c1, near(A0.c1, H0.c1) ? (near(A0.c1, H0.c2) || lum(H0.c2) > 0.85 ? "#8a8b8e" : H0.c2) : H0.c1];
}
const num = (v) => (v == null || v === "" || isNaN(v) ? null : Number(v));
const f1 = (v) => (num(v) == null ? "—" : Number(v).toFixed(1));

function side(t, colors, align) {
  const { c1, c2 } = teamCols(colors, t.name);
  return `<div class="side ${align}" style="--c1:${c1};--c2:${c2}">
    <div class="logo">${badge(t.name, t.logo, colors, 120)}</div>
    <div class="who">
      <div class="rk">${t.rank > 0 && t.rank <= 25 ? `#${t.rank}` : "&nbsp;"}</div>
      <div class="tn">${esc(short(t.name))}</div>
      <div class="rec">${esc(t.record || "0-0")}${t.confRecord ? `<small>${esc(t.confRecord)} ${esc(CONF[t.conference] || t.conference || "")}</small>` : ""}</div>
      <div class="cn">${t.coach ? `<em>🎮 ${esc(t.coach)}</em>` : "<span>CPU</span>"}</div>
    </div>
  </div>`;
}

// [label, value fn, compare fn (higher wins unless low), [min, max] for the butterfly bar, lowerIsBetter]
const TAPE = [
  ["Overall", (t) => t.ovr ?? "—", (t) => num(t.ovr), [55, 99]],
  ["Offense", (t) => t.off ?? "—", (t) => num(t.off), [55, 99]],
  ["Defense", (t) => t.def ?? "—", (t) => num(t.def), [55, 99]],
  ["Points / game", (t) => f1(t.ppg), (t) => num(t.ppg), [0, 55]],
  ["Allowed / game", (t) => f1(t.oppg), (t) => num(t.oppg), [0, 55], true],
];

function tape(A, H, ca, ch) {
  return TAPE.map(([label, val, cmp, [lo, hi], low]) => {
    const a = cmp(A), h = cmp(H);
    const aB = a != null && h != null && (low ? a < h : a > h), hB = a != null && h != null && (low ? h < a : h > a);
    const w = (v) => (v == null ? 0 : Math.max(4, Math.min(100, ((v - lo) / (hi - lo)) * 100)));
    return `<div class="tp"><b class="${aB ? "best" : ""}">${esc(val(A))}</b>
      <div class="bf"><i class="l"><i style="width:${w(a)}%;background:${ca};opacity:${aB ? 1 : 0.55}"></i></i><span>${label}</span><i class="r"><i style="width:${w(h)}%;background:${ch};opacity:${hB ? 1 : 0.55}"></i></i></div>
      <b class="${hB ? "best" : ""}">${esc(val(H))}</b></div>`;
  }).join("");
}

const leaderCol = (t, color, last) => `<div class="lc" style="--c1:${color};--ink:${lum(color) > 0.4 ? "#121213" : "#fff"}">
  <h3>${esc(short(t.name))}<small>${last ? `Last: ${esc(last)}` : ""}</small></h3>${(t.leaders || []).map((l) =>
  `<div class="ld"><i>${esc(l.tag)}</i><b>${esc(l.name)}</b><span>${esc(l.line)}</span></div>`).join("") || '<div class="ld"><span>No stats yet</span></div>'}</div>`;

export async function renderMatchup({ week = "", date = "", tag = "", note = "", away, home, siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const fontCss = await fonts();
  const [ca, ch] = sideColors(away, home, colors);
  const html = `<!doctype html><html><head><style>
${fontCss}
${BADGE_CSS}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
.top{display:flex;align-items:center;gap:14px;padding:14px 28px;background:#000;border-bottom:4px solid #cc0000}
.top .pv{font:800 22px RC;letter-spacing:.12em;background:#cc0000;color:#fff;padding:4px 14px;border-radius:3px}
.top .wk{font:700 20px RC;text-transform:uppercase;letter-spacing:.04em}.top .wk small{font:500 15px R;color:#9a9b9e;text-transform:none;margin-left:10px;letter-spacing:0}
.top img{height:40px;margin-left:auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.tag{background:linear-gradient(90deg,#8a6a12,#f2b134 50%,#8a6a12);color:#141414;text-align:center;font:800 18px RC;letter-spacing:.28em;text-transform:uppercase;padding:6px 0}
.board{display:grid;grid-template-columns:1fr 120px 1fr}
.side{position:relative;display:flex;align-items:center;gap:18px;height:190px;padding:0 26px;overflow:hidden}
.side::before{content:"";position:absolute;inset:0;background:linear-gradient(var(--ang),color-mix(in srgb,var(--c1) 85%,#000) 0,color-mix(in srgb,var(--c1) 40%,#111) 65%,#141517 100%)}
.side.l{--ang:90deg}.side.r{--ang:270deg;flex-direction:row-reverse;text-align:right}
.side::after{content:"";position:absolute;top:0;bottom:0;width:6px;background:var(--c2)}.side.l::after{left:0}.side.r::after{right:0}
.side>*{position:relative}
.logo{flex:none;display:grid;place-items:center;width:120px;height:120px}
.who{flex:1;min-width:0}
.rk{font:800 20px RC;color:rgba(255,255,255,.75)}
.tn{font:800 40px/1 RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 6px rgba(0,0,0,.4)}
.rec{font:800 28px RC;margin-top:4px}.rec small{font:500 14px R;color:rgba(255,255,255,.7);margin:0 8px;letter-spacing:.04em}
.side.r .rec small{margin:0 8px}
.cn{margin-top:6px}.cn em{font-style:normal;font:700 13px R;background:#cc0000;color:#fff;padding:2px 8px;border-radius:3px}.cn span{font:700 13px R;color:rgba(255,255,255,.55);letter-spacing:.1em}
.at{display:grid;place-items:center;background:#141517;font:800 34px RC;color:#6c6d6f}
.body{padding:18px 28px 6px}
h2{font:700 13px RC;letter-spacing:.16em;color:#6c6d6f;text-transform:uppercase;margin-bottom:10px;text-align:center}
.tp{display:grid;grid-template-columns:90px 1fr 90px;align-items:center;margin-bottom:8px}
.tp b{font:700 24px RC;color:#8a8b8e}.tp b:last-child{text-align:right}.tp b.best{color:#fff}
.bf{display:grid;grid-template-columns:1fr 150px 1fr;align-items:center;gap:10px}
.bf span{font:500 14px R;color:#b9babd;text-align:center}
.bf>i{display:flex;height:10px;background:#26282a;border-radius:5px;overflow:hidden}.bf>i.l{justify-content:flex-end}
.bf>i>i{display:block;height:100%;border-radius:5px}
.leaders{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:14px 28px 6px}
.lc h3{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font:800 18px RC;letter-spacing:.06em;text-transform:uppercase;border-bottom:3px solid var(--c1);padding-bottom:4px;margin-bottom:8px}
.lc h3 small{font:500 13px R;color:#9a9b9e;letter-spacing:0;text-transform:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ld{display:grid;grid-template-columns:44px auto 1fr;gap:10px;align-items:center;background:#1f2022;border-radius:6px;padding:8px 10px;margin-bottom:6px}
.ld i{font-style:normal;font:700 11px RC;letter-spacing:.08em;color:var(--ink);background:var(--c1);border-radius:3px;padding:3px 0;text-align:center}
.ld b{font:700 18px RC;white-space:nowrap}.ld span{font:500 14px R;color:#b9babd;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
footer{display:flex;justify-content:space-between;padding:10px 28px 14px;font:500 14px R;color:#9a9b9e;border-top:1px solid #26282a;margin-top:8px}
footer b{color:#ededee}
</style></head><body><div class="card">
<div class="top"><span class="pv">PREVIEW</span><span class="wk">${esc(week)}<small>${esc(date)}</small></span>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}</div>
${tag ? `<div class="tag">${esc(tag)}</div>` : ""}
<div class="board">${side(away, colors, "l")}<div class="at">AT</div>${side(home, colors, "r")}</div>
<div class="body"><h2>Tale of the tape</h2>${tape(away, home, ca, ch)}</div>
<div class="leaders">${leaderCol(away, ca, away.last)}${leaderCol(home, ch, home.last)}</div>
<footer><span>${esc(note)}</span><b>thedynastycfb.com</b></footer>
</div></body></html>`;
  return shoot(html, { chromeChannel });
}

// Season leaders for one team from data/player-stats-all.json rows ({ name, team_key, stats }).
export function seasonLeaders(players, teamKey) {
  const ps = (players || []).filter((p) => p.team_key === teamKey), S = (p) => p.stats || {};
  const top = (k) => ps.filter((p) => S(p)[k] > 0).sort((a, b) => S(b)[k] - S(a)[k])[0];
  const n0 = (v) => Number(v || 0).toLocaleString("en-US");
  const out = [];
  const qb = top("passYards"); if (qb) { const s = S(qb); out.push({ tag: "PASS", name: qb.name, line: `${n0(s.passYards)} yds, ${s.passTD || 0} TD, ${s.passINT || 0} INT` }); }
  const rb = top("rushYards"); if (rb) { const s = S(rb); out.push({ tag: "RUSH", name: rb.name, line: `${n0(s.rushYards)} yds, ${s.rushTD || 0} TD` }); }
  const wr = top("receivingYards"); if (wr) { const s = S(wr); out.push({ tag: "REC", name: wr.name, line: `${s.receiveReceptions || 0} rec, ${n0(s.receivingYards)} yds, ${s.receiveTouchdowns || 0} TD` }); }
  const tk = top("defenseTotalTackles"); if (tk) out.push({ tag: "TKL", name: tk.name, line: `${S(tk).defenseTotalTackles} tackles` });
  const sk = top("defenseSacks"); if (sk) out.push({ tag: "SACK", name: sk.name, line: `${S(sk).defenseSacks} sack${S(sk).defenseSacks === 1 ? "" : "s"}` });
  return out;
}

