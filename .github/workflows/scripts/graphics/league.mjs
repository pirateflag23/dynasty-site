// League-engagement graphics: Game of the Week, Pick'em slate + standings, coach power rankings,
// and the coach-vs-coach series band used on matchup previews.
import { fonts, esc, BADGE_CSS, badge, shoot, teamCols, short } from "./common.mjs";

const BASE = `*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;background:#0d0e0f;font-family:R,sans-serif;color:#ededee}
.card{background:linear-gradient(180deg,#17181a,#0f1011);overflow:hidden}
.top{display:flex;align-items:center;gap:14px;padding:14px 28px;background:#000;border-bottom:4px solid #cc0000}
.top .pv{font:800 22px RC;letter-spacing:.12em;background:#cc0000;color:#fff;padding:4px 14px;border-radius:3px}
.top .wk{font:700 20px RC;text-transform:uppercase;letter-spacing:.04em}.top .wk small{font:500 15px R;color:#9a9b9e;text-transform:none;margin-left:10px;letter-spacing:0}
.top img{height:40px;margin-left:auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
footer{display:flex;justify-content:space-between;padding:10px 28px 14px;font:500 14px R;color:#9a9b9e;border-top:1px solid #26282a}
footer b{color:#ededee}`;
const head = (pill, week, sub, siteLogo) => `<div class="top"><span class="pv">${esc(pill)}</span><span class="wk">${esc(week)}<small>${esc(sub || "")}</small></span>${siteLogo ? `<img src="${siteLogo}" onerror="this.remove()">` : ""}</div>`;
const rk = (r) => (r > 0 && r <= 25 ? `#${r} ` : "");
const page = async (css, body) => `<!doctype html><html><head><style>${await fonts()}\n${BADGE_CSS}\n${BASE}\n${css}</style></head><body><div class="card">${body}</div></body></html>`;

/* ---------- coach-vs-coach series band (shared by GOTW and matchup previews) ----------
   series: { away_w, home_w, ties, away_coach, home_coach, lead, last, streak, meetings: [{ y, wk, win, score, aw }] } (aw: away-side coach won) */
export const SERIES_CSS = `.series{display:grid;grid-template-columns:150px 1fr 150px;align-items:center;gap:14px;padding:14px 28px;background:linear-gradient(90deg,color-mix(in srgb,var(--ca) 30%,#121314),#121314 30%,#121314 70%,color-mix(in srgb,var(--ch) 30%,#121314))}
.series .n{font:800 54px/1 RC;text-align:center}.series .n small{display:block;font:700 12px RC;letter-spacing:.14em;color:#9a9b9e;margin-top:4px;text-transform:uppercase}
.series .mid{text-align:center}.series h4{font:800 15px RC;letter-spacing:.22em;color:#f2b134;text-transform:uppercase}
.series .ld2{font:800 24px RC;margin-top:2px}.series .sub{font:500 14px R;color:#b9babd;margin-top:2px}
.series .chips{display:flex;justify-content:center;gap:6px;margin-top:8px;flex-wrap:wrap}
.series .chip{font:700 12px RC;letter-spacing:.04em;padding:4px 8px;border-radius:4px;background:#26282a;color:#d5d6d8;border-left:4px solid var(--cc)}`;
export function seriesBand(series, ca, ch) {
  if (!series) return "";
  const first = !series.away_w && !series.home_w && !series.ties;
  return `<div class="series" style="--ca:${ca};--ch:${ch}">
    <div class="n">${first ? "–" : series.away_w}<small>${esc(series.away_coach)}</small></div>
    <div class="mid"><h4>Coach vs coach series</h4><div class="ld2">${esc(first ? "First meeting" : series.lead)}</div>
      ${series.last || series.streak ? `<div class="sub">${esc([series.last, series.streak].filter(Boolean).join(" · "))}</div>` : ""}
      ${series.meetings?.length ? `<div class="chips">${series.meetings.slice(0, 6).map((m) => `<span class="chip" style="--cc:${m.aw ? ca : ch}">${esc(`${m.y} ${m.wk}: ${m.win} ${m.score}`)}</span>`).join("")}</div>` : ""}</div>
    <div class="n">${first ? "–" : series.home_w}<small>${esc(series.home_coach)}</small></div></div>`;
}

/* ---------- Game of the Week ---------- */
export async function renderGOTW({ week = "", date = "", tag = "", away, home, series = null, stakes = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const A = teamCols(colors, away.name), H = teamCols(colors, home.name);
  const side = (t, c, cls) => `<div class="sd ${cls}" style="--c1:${c.c1};--c2:${c.c2}"><div class="lg2">${badge(t.name, t.logo, colors, 150)}</div>
    <div class="who"><div class="rk">${t.rank > 0 && t.rank <= 25 ? `No. ${t.rank}` : "&nbsp;"}</div><div class="tn">${esc(short(t.name))}</div>
    <div class="rec">${esc(t.record || "")}<small>${esc(t.conf || "")}</small></div>
    ${t.coach ? `<div class="cn"><em>${esc(t.coach)}</em></div>` : ""}
    ${t.make != null ? `<div class="odds">Playoff odds <b>${t.make}%</b></div>` : ""}</div></div>`;
  const css = `${SERIES_CSS}
.hero{position:relative;text-align:center;padding:16px 0 10px;background:radial-gradient(ellipse at center,#2a2112 0,#121314 70%)}
.hero h1{font:800 64px/1 RC;letter-spacing:.06em;text-transform:uppercase;background:linear-gradient(180deg,#fff2c9,#f2b134 55%,#a87412);-webkit-background-clip:text;color:transparent}
.hero .tg{font:700 16px RC;letter-spacing:.3em;color:#cc9a2a;text-transform:uppercase;margin-top:4px}
.board{display:grid;grid-template-columns:1fr 110px 1fr}
.sd{position:relative;display:flex;align-items:center;gap:20px;height:250px;padding:0 28px;overflow:hidden}
.sd::before{content:"";position:absolute;inset:0;background:linear-gradient(var(--ang),color-mix(in srgb,var(--c1) 88%,#000) 0,color-mix(in srgb,var(--c1) 40%,#111) 65%,#141517 100%)}
.sd.l{--ang:90deg}.sd.r{--ang:270deg;flex-direction:row-reverse;text-align:right}
.sd::after{content:"";position:absolute;top:0;bottom:0;width:7px;background:var(--c2)}.sd.l::after{left:0}.sd.r::after{right:0}
.sd>*{position:relative}.lg2{flex:none;width:150px;height:150px;display:grid;place-items:center}
.who{flex:1;min-width:0}.rk{font:800 22px RC;color:rgba(255,255,255,.8)}
.tn{font:800 46px/1 RC;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 6px rgba(0,0,0,.4)}
.rec{font:800 30px RC;margin-top:4px}.rec small{font:500 15px R;color:rgba(255,255,255,.7);margin:0 8px}
.cn{margin-top:6px}.cn em{font-style:normal;font:700 14px R;background:#cc0000;color:#fff;padding:3px 9px;border-radius:3px}
.odds{margin-top:8px;font:500 14px R;color:rgba(255,255,255,.75)}.odds b{font:800 18px RC;color:#fff}
.vs{display:grid;place-items:center;background:#141517;font:800 40px RC;color:#f2b134}
.stakes{padding:12px 28px 14px}.stakes h4{font:700 13px RC;letter-spacing:.16em;color:#6c6d6f;text-transform:uppercase;margin-bottom:6px}
.stakes li{list-style:none;font:500 16px R;color:#d5d6d8;padding:4px 0 4px 16px;position:relative}.stakes li::before{content:"";position:absolute;left:0;top:12px;width:7px;height:7px;background:#f2b134;border-radius:50%}`;
  const html = await page(css, `${head("GAME OF THE WEEK", week, date, siteLogo)}
<div class="hero"><h1>Game of the Week</h1>${tag ? `<div class="tg">${esc(tag)}</div>` : ""}</div>
<div class="board">${side(away, A, "l")}<div class="vs">VS</div>${side(home, H, "r")}</div>
${seriesBand(series, A.c1, H.c1)}
${stakes.length ? `<div class="stakes"><h4>What's on the line</h4><ul>${stakes.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>` : ""}
<footer><span>Every league game this week is on thedynastycfb.com/#schedule</span><b>thedynastycfb.com</b></footer>`);
  return shoot(html, { chromeChannel });
}

/* ---------- Pick'em slate ---------- */
export async function renderPickSlate({ week = "", sub = "", games = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const css = `.hint{padding:12px 28px;font:500 16px R;color:#b9babd;border-bottom:1px solid #26282a}.hint b{color:#f2b134}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 28px}
.g{display:grid;grid-template-columns:40px 1fr 40px 1fr;align-items:center;gap:10px;background:#1b1c1e;border-radius:8px;padding:10px 12px;border-left:5px solid #26282a}
.g.uvu{border-left-color:#cc0000}.num{font:800 22px RC;color:#6c6d6f;text-align:center}
.t{display:flex;align-items:center;gap:10px;min-width:0}.t b{font:700 19px RC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.t small{display:block;font:500 12px R;color:#9a9b9e}
.at{font:800 16px RC;color:#6c6d6f;text-align:center}`;
  const T = (t) => `<div class="t">${badge(t.name, t.logo, colors, 38)}<div style="min-width:0"><b>${esc(rk(t.rank) + short(t.name))}</b><small>${esc([t.record, t.coach].filter(Boolean).join(" · "))}</small></div></div>`;
  const html = await page(css, `${head("PICK'EM", week, sub, siteLogo)}
<div class="hint">Tap a team on the buttons under this post. <b>One point per correct pick</b>; you can change a pick until that game is played.</div>
<div class="grid">${games.map((g, i) => `<div class="g ${g.uvu ? "uvu" : ""}"><div class="num">${i + 1}</div>${T(g.away)}<div class="at">AT</div>${T(g.home)}</div>`).join("")}</div>
<footer><span>Standings post at each advance · red = coach vs coach</span><b>thedynastycfb.com</b></footer>`);
  return shoot(html, { chromeChannel });
}

/* ---------- Pick'em standings ---------- */
// rows: [{ name, w, l, last: "5/6", streak, perfect }], recap: { label, best: [names], score: "6/6" }
export async function renderPickBoard({ label = "", rows = [], recap = null, siteLogo = "", chromeChannel = "chrome" }) {
  const css = `.recap{padding:12px 28px;font:500 16px R;color:#d5d6d8;background:#141517;border-bottom:1px solid #26282a}.recap b{color:#f2b134}
table{width:100%;border-collapse:collapse}th{font:700 13px RC;letter-spacing:.14em;color:#6c6d6f;text-transform:uppercase;text-align:left;padding:10px 12px}
td{padding:9px 12px;border-top:1px solid #222325;font:500 17px R}td.r,th.r{text-align:right}
td.rk{font:800 22px RC;color:#9a9b9e;width:60px;text-align:center}tr.top1 td.rk{color:#f2b134}
td.nm{font:700 20px RC}td.big{font:800 22px RC}.wrap{padding:4px 16px 8px}
.pf{font:700 11px RC;letter-spacing:.08em;background:#f2b134;color:#141414;border-radius:3px;padding:2px 6px;margin-left:8px;vertical-align:middle}`;
  const html = await page(css, `${head("PICK'EM", "Standings", label, siteLogo)}
${recap ? `<div class="recap">${esc(recap.label)}: <b>${esc(recap.best.join(", "))}</b> went ${esc(recap.score)}${recap.n ? ` · ${recap.n} players picked` : ""}</div>` : ""}
<div class="wrap"><table><tr><th></th><th>Player</th><th class="r">Correct</th><th class="r">Wrong</th><th class="r">Pct</th><th class="r">Last week</th></tr>
${rows.map((r, i) => `<tr class="${i === 0 ? "top1" : ""}"><td class="rk">${r.rank}</td><td class="nm">${esc(r.name)}${r.perfect ? '<span class="pf">PERFECT WEEK</span>' : ""}</td>
<td class="r big">${r.w}</td><td class="r">${r.l}</td><td class="r">${r.w + r.l ? (r.w / (r.w + r.l)).toFixed(3).replace(/^0/, "") : "—"}</td><td class="r">${esc(r.last || "—")}</td></tr>`).join("") || '<tr><td colspan="6" style="text-align:center;color:#9a9b9e;padding:26px">No picks graded yet</td></tr>'}
</table></div>
<footer><span>Full board on thedynastycfb.com/#standings</span><b>thedynastycfb.com</b></footer>`);
  return shoot(html, { chromeChannel });
}

/* ---------- Coach power rankings ---------- */
// rows: [{ rank, move (number|null new), name, logo, coach, record, tag, blurb }]
export async function renderPowerRankings({ label = "", sub = "", rows = [], siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const css = `.hero{padding:14px 28px 6px}.hero h1{font:800 46px/1 RC;text-transform:uppercase;letter-spacing:.03em}.hero p{font:500 15px R;color:#9a9b9e;margin-top:4px}
.row{display:grid;grid-template-columns:64px 58px 64px 1fr;align-items:center;gap:14px;padding:12px 28px;border-top:1px solid #222325;position:relative}
.row::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--c1)}
.n{font:800 40px RC;text-align:center}.mv{font:800 17px RC;text-align:center}.mv.up{color:#2fbf5f}.mv.dn{color:#e5484d}.mv.eq{color:#6c6d6f}.mv.nw{color:#f2b134;font-size:13px;letter-spacing:.08em}
.tm{min-width:0}.tm b{font:800 24px RC;text-transform:uppercase}.tm .meta{font:500 14px R;color:#9a9b9e;margin-left:10px}
.tm .tg{font:700 11px RC;letter-spacing:.1em;background:#26282a;color:#d5d6d8;border-radius:3px;padding:2px 6px;margin-left:8px;vertical-align:3px;text-transform:uppercase}
.tm p{font:500 16px/1.35 R;color:#d5d6d8;margin-top:3px}`;
  const mv = (m) => (m === null ? '<span class="mv nw">NEW</span>' : m > 0 ? `<span class="mv up">▲${m}</span>` : m < 0 ? `<span class="mv dn">▼${-m}</span>` : '<span class="mv eq">–</span>');
  const html = await page(css, `${head("POWER RANKINGS", label, sub, siteLogo)}
<div class="hero"><h1>Coach Power Rankings</h1><p>Every coach in The Dynasty, ranked. Record, résumé, momentum and playoff odds all count.</p></div>
${rows.map((r) => `<div class="row" style="--c1:${teamCols(colors, r.name).c1}"><div class="n">${r.rank}</div>${mv(r.move)}${badge(r.name, r.logo, colors, 56)}
<div class="tm"><b>${esc(short(r.name))}</b><span class="meta">${esc([r.coach, r.record].filter(Boolean).join(" · "))}</span>${r.tag ? `<span class="tg">${esc(r.tag)}</span>` : ""}<p>${esc(r.blurb || "")}</p></div></div>`).join("")}
<footer><span>Posted midweek · rankings move every week</span><b>thedynastycfb.com</b></footer>`);
  return shoot(html, { chromeChannel });
}

/* ---------- Coaching carousel card ---------- */
// kind: move | join | leave; from/to: { name, logo, record, rank } (either may be null)
export async function renderCarousel({ kind = "move", coach = "", from = null, to = null, headline = "", text = "", label = "", siteLogo = "", colors = {}, chromeChannel = "chrome" }) {
  const css = `.hero{text-align:center;padding:16px 0 4px;background:radial-gradient(ellipse at center,#2a1212 0,#121314 70%)}
.hero h1{font:800 54px/1 RC;letter-spacing:.08em;text-transform:uppercase;color:#fff}.hero .tg{font:700 15px RC;letter-spacing:.3em;color:#cc0000;text-transform:uppercase;margin-top:4px}
.move{display:grid;grid-template-columns:1fr 140px 1fr;align-items:center;padding:20px 40px 10px}
.tm{text-align:center}.tm .lg3{display:grid;place-items:center;height:170px}.tm b{display:block;font:800 30px RC;text-transform:uppercase;margin-top:6px}.tm small{font:500 15px R;color:#9a9b9e}
.tm.gone{opacity:.55;filter:grayscale(.6)}.arrow{font:800 70px RC;color:#cc0000;text-align:center}
.coach{text-align:center;padding:4px 0 10px}.coach em{font-style:normal;font:800 24px RC;background:#cc0000;color:#fff;padding:5px 16px;border-radius:4px;letter-spacing:.04em}
.story{padding:12px 40px 18px;text-align:center}.story h2{font:800 30px/1.15 RC}.story p{font:500 18px/1.45 R;color:#d5d6d8;margin-top:8px}`;
  const T = (t, gone) => t ? `<div class="tm ${gone ? "gone" : ""}"><div class="lg3">${badge(t.name, t.logo, colors, 160)}</div><b>${esc(short(t.name))}</b><small>${esc([t.rank > 0 && t.rank <= 25 ? `No. ${t.rank}` : "", t.record].filter(Boolean).join(" · "))}</small></div>`
    : `<div class="tm gone"><div class="lg3" style="font:800 30px RC;color:#6c6d6f">${kind === "join" ? "NEW TO THE LEAGUE" : "CPU"}</div></div>`;
  const tag = kind === "move" ? "On the move" : kind === "join" ? "New hire" : "Departure";
  const html = await page(css, `${head("BREAKING", "Coaching carousel", label, siteLogo)}
<div class="hero"><h1>Coaching Carousel</h1><div class="tg">${tag}</div></div>
<div class="move">${T(from, kind !== "join")}<div class="arrow">➜</div>${T(to, false)}</div>
${coach ? `<div class="coach"><em>${esc(coach)}</em></div>` : ""}
<div class="story">${headline ? `<h2>${esc(headline)}</h2>` : ""}${text ? `<p>${esc(text)}</p>` : ""}</div>
<footer><span>TD Wire · coaching carousel</span><b>thedynastycfb.com</b></footer>`);
  return shoot(html, { chromeChannel });
}
