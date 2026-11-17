/* =========================================================
   OUTLOOK: Crystal Ball, Playoff odds, offseason features (TD Wire latest.json)
   ========================================================= */
const CB_ICON = `<svg class="cb-ico" viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="cbg" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#f3e8ff"/><stop offset=".45" stop-color="#a78bfa"/><stop offset="1" stop-color="#4c1d95"/></radialGradient></defs><circle cx="16" cy="13.5" r="11" fill="url(#cbg)"/><ellipse cx="12" cy="9.5" rx="3.6" ry="2.2" fill="#fff" opacity=".55" transform="rotate(-30 12 9.5)"/><path d="M9 25.5h14l2 4H7z" fill="#7c3aed"/><rect x="8" y="23.5" width="16" height="2.4" rx="1.2" fill="#5b21b6"/></svg>`;
const OUT_CSS = `
.cb-ico{width:22px;height:22px;vertical-align:-5px;margin-right:6px}
.cb-hero{display:flex;gap:14px;align-items:center;padding:14px}.cb-hero .cb-ico{width:54px;height:54px;margin:0;flex:none}
.cb-hero p{margin:4px 0 0;font-size:13px;color:var(--dim);line-height:1.45}.cb-rec{font:800 20px var(--head)}
.cb{padding:14px;border-top:1px solid var(--line-2)}.cb:first-of-type{border-top:0}.cb.mine{background:color-mix(in srgb,var(--red) 6%,transparent)}
.cb-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}
.cb-nm{font:800 16px var(--head)}.cb-nm a{color:inherit}.cb-meta{font-size:12px;color:var(--dim);margin-top:2px}
.cb-chip{display:inline-block;font:700 10px var(--head);text-transform:uppercase;letter-spacing:.3px;padding:3px 7px;border-radius:999px;border:1px solid var(--line-2);color:var(--dim);margin:6px 4px 0 0}
.cb-rows{margin:10px 0 8px;display:grid;gap:5px}
.cb-row{display:grid;grid-template-columns:22px minmax(0,130px) minmax(0,1fr) 44px 40px;gap:8px;align-items:center;font-size:12px}
.cb-row .bar{height:8px;border-radius:4px;background:color-mix(in srgb,currentColor 10%,transparent);overflow:hidden}.cb-row .bar i{display:block;height:100%;background:color-mix(in srgb,currentColor 35%,transparent)}
.cb-row.pk{font-weight:800}.cb-row.pk .bar i{background:#7c3aed}.cb-row .n{text-align:right;font-variant-numeric:tabular-nums;color:var(--dim)}.cb-row .mo{color:#16a34a}
.cb-pick{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:800 13px var(--head);margin-top:4px}.cb-pick .conf{font:700 10px var(--head);padding:3px 7px;border-radius:999px;color:#fff;background:#7c3aed}
.cb-pick .conf.Medium{background:#a78bfa}.cb-pick .conf.Low{background:color-mix(in srgb,currentColor 45%,transparent)}
.cb p{margin:6px 0 0;font-size:13px;line-height:1.5;color:var(--ink)}.cb .call{font-style:italic;color:var(--dim)}
.cb-calls li{display:flex;gap:8px;align-items:center;padding:6px 14px;font-size:12px;border-top:1px solid var(--line-2)}.cb-calls .ok{color:#16a34a;font-weight:800}.cb-calls .x{color:var(--red);font-weight:800}
.cfp-t td,.cfp-t th{white-space:nowrap}.cfp-bar{display:flex;align-items:center;gap:6px}.cfp-bar .b{width:70px;height:8px;border-radius:4px;background:color-mix(in srgb,currentColor 10%,transparent);overflow:hidden}.cfp-bar .b i{display:block;height:100%;background:var(--red)}
.cfp-t tr.cut td{border-bottom:2px dashed var(--red)}.cfp-d.up{color:#16a34a}.cfp-d.dn{color:var(--red)}
.cfp-n{padding:8px 14px;border-top:1px solid var(--line-2);font-size:13px;line-height:1.45}.cfp-n b{font:800 11px var(--head);text-transform:uppercase;color:var(--red);margin-right:6px}
.cfp-legend{padding:10px 14px;font-size:12px;color:var(--dim);line-height:1.5}.cfp-legend summary{cursor:pointer;font-weight:700;color:inherit}
.cfp-mini td{padding:5px 8px}.feat{padding:14px;border-top:1px solid var(--line-2)}.feat:first-of-type{border-top:0}
.feat .kick{font:800 11px var(--head);color:var(--red);text-transform:uppercase;letter-spacing:.4px}.feat h3{margin:4px 0;font:800 18px/1.2 var(--head)}.feat h3 a{color:inherit}.feat p{margin:0;font-size:13px;color:var(--dim);line-height:1.45}
.art-h{padding:16px 16px 6px}.art-h h1{margin:4px 0 6px;font:800 26px/1.15 var(--head)}.art-h p{margin:0;color:var(--dim);font-size:14px;line-height:1.5}
.ni{display:grid;grid-template-columns:34px 40px minmax(0,1fr);gap:10px;padding:12px 16px;border-top:1px solid var(--line-2);align-items:start}.ni.mine{background:color-mix(in srgb,var(--red) 6%,transparent)}
.ni .rk{font:800 22px var(--head);color:var(--red);text-align:center}.ni h3{margin:0 0 3px;font:800 15px/1.25 var(--head)}.ni h3 a{color:inherit}
.ni .money{font:800 13px var(--head)}.ni .money .up{color:#16a34a}.ni p{margin:4px 0 0;font-size:13px;color:var(--dim);line-height:1.45}
`;
const wireTeamTok = (k, fallback) => { const n = wireTeamName(k) || fallback || ""; return n ? `${badge(n)}` : ""; };
const pctTxt = (v) => (v >= 99.5 ? ">99%" : v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`);

/* ---------- Crystal Ball ---------- */
function renderCrystalBall(nav) {
  const list = WIRE?.crystal || [], rec = WIRE?.crystal_record || { hits: 0, misses: 0, calls: [] };
  const tot = rec.hits + rec.misses;
  const filters = [["", "All"], ["user", "League teams"], ["low", "Toss-ups"], ["upset", "Upset picks"], ["high", "Locks"]];
  const row = (s, pk) => `<div class="cb-row${s.team === pk ? " pk" : ""}"><span>${wireTeamTok(s.team, s.name)}</span><span><a class="tl" href="#team/${s.team}">${esc(s.name)}</a></span><span class="bar"><i style="width:${Math.max(2, s.pct)}%"></i></span><span class="n">${s.influence}${s.mom > 0 ? ` <span class="mo">+${s.mom}</span>` : ""}</span><span class="n">${pctTxt(s.pct)}</span></div>`;
  const card = (c) => `<article class="cb${c.user ? " mine" : ""}" data-f="${[c.user ? "user" : "", c.confidence === "Low" ? "low" : "", c.upset ? "upset" : "", c.confidence === "High" ? "high" : ""].join(" ")}">
    <div class="cb-top"><div><div class="cb-nm"><a href="#recruit/${c.recruit}">${esc(c.name)}</a></div>
      <div class="cb-meta">${"★".repeat(c.stars || 0)} ${esc(c.position)}${c.archetype ? ` · ${esc(c.archetype)}` : ""}${c.rank ? ` · No. ${c.rank} overall` : ""}${c.hometown ? ` · ${esc(c.hometown)}, ${esc(c.state || "")}` : ""}</div></div></div>
    <div>${c.dealbreaker ? `<span class="cb-chip">Dealbreaker: ${esc(c.dealbreaker)}</span>` : ""}${c.stage ? `<span class="cb-chip">${esc(c.stage)}</span>` : ""}${c.desired_nil ? `<span class="cb-chip">Asking $${c.desired_nil}K</span>` : ""}</div>
    <div class="cb-rows">${c.schools.map((s) => row(s, c.pick)).join("")}</div>
    <div class="cb-pick">${CB_ICON}Crystal Ball: <a class="tl" href="#team/${c.pick}">${esc(c.pick_name)}</a> <span class="conf ${c.confidence}">${c.pct}% · ${c.confidence}</span>${c.upset ? '<span class="cb-chip" style="margin:0">Upset pick</span>' : ""}</div>
    <p>${wireHtml(c.d)} <span class="call">${esc(c.call)}</span></p></article>`;
  $("#view").innerHTML = `${nav}<div class="tp-grid"><div>
    <section class="card"><div class="cb-hero">${CB_ICON}<div><h2 class="card-h" style="padding:0;border:0">Crystal Ball</h2><p>Where the top uncommitted prospects will land, and why. Influence from the recruiting board, this week's movement, dealbreakers, depth charts, NIL and fit. Updated every advance.</p></div></div></section>
    <section class="card"><div class="pw-pills" style="padding:12px 14px 0">${filters.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${!k}">${l}</button>`).join("")}</div>
      <div id="cblist">${list.length ? list.map(card).join("") : `<div class="empty">${WIRE ? "No open recruitments to predict right now." : "Loading…"}</div>`}</div></section>
  </div><div>
    <section class="card"><h2 class="card-h">${CB_ICON}Track record</h2><div class="cb-hero" style="padding-top:4px"><div><div class="cb-rec">${rec.hits}-${rec.misses}</div><p>${tot ? `${Math.round((rec.hits / tot) * 100)}% of our calls have been right.` : "Calls get graded as recruits commit."}</p></div></div>
      ${(rec.calls || []).length ? `<ul class="cb-calls" style="list-style:none;margin:0;padding:0">${rec.calls.map((x) => `<li><span class="${x.hit ? "ok" : "x"}">${x.hit ? "✓" : "✗"}</span><span><a class="tl" href="#recruit/${x.recruit}">${esc(x.name)}</a> → ${esc(x.landed_name || "")}${x.hit ? "" : ` <span style="color:var(--dim)">(we said ${esc(x.pick_name)})</span>`}</span></li>`).join("")}</ul>` : ""}</section>
    <section class="card"><h2 class="card-h">How to read it</h2><div class="cfp-legend">Bars show each school's share of our projection. The number beside the school is its recruiting influence, with this week's gain in green. Confidence: <b>High</b> 75%+, <b>Medium</b> 50 to 74%, <b>Low</b> under 50%. An upset pick is a school we like even though it isn't leading on the board.</div></section>
  </div></div>`;
  $("#view").querySelector(".pw-pills").onclick = (ev) => { const b = ev.target.closest("button"); if (!b) return; const k = b.dataset.k;
    ev.currentTarget.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    $("#cblist").querySelectorAll(".cb").forEach((el) => (el.style.display = !k || el.dataset.f.split(" ").includes(k) ? "" : "none")); };
}

/* ---------- Playoff odds ---------- */
function cfpCard() {
  const c = WIRE?.cfp; if (!c?.teams?.length) return "";
  return `<section class="card"><h2 class="card-h">Playoff odds <small><a class="tl" href="#standings/cfp">Full outlook</a></small></h2><table class="tbl cfp-mini"><tbody>${c.teams.slice(0, 12).map((t, i) => `<tr class="${t.user ? "user" : ""}"><td><div class="team-cell"><span class="num">${i + 1}</span>${badge(t.name)}<span class="nm">${rk(t.rank)}${tLink(t.name, t.team)}</span></div></td><td style="text-align:right;font-weight:800">${pctTxt(t.make)}</td></tr>`).join("")}</tbody></table>
    <div class="wire-tag">${c.final ? "Final projection" : `${c.sims.toLocaleString()} simulations · ${esc(c.season_text || "")}`}</div></section>`;
}
function renderCfp() {
  const c = WIRE?.cfp;
  const nav = `<nav class="subnav" aria-label="Standings"><h1>Standings</h1><a href="#standings">Conferences</a><a href="#standings/cfp" aria-current="page">Playoff odds</a></nav>`;
  if (!c?.teams?.length) { $("#view").innerHTML = `${nav}<div class="card"><div class="empty">${WIRE ? "Playoff odds run during the regular season." : "Loading…"}</div></div>`; return; }
  const d = (v) => (v == null ? "" : v === 0 ? "–" : `<span class="cfp-d ${v > 0 ? "up" : "dn"}">${v > 0 ? "▲" : "▼"}${Math.abs(v)}</span>`);
  const rows = c.teams.map((t, i) => `<tr class="${[t.user ? "user" : "", i === 11 ? "cut" : ""].join(" ")}">
    <td><div class="team-cell"><span class="num">${i + 1}</span>${badge(t.name)}<span class="nm">${rk(t.rank)}${tLink(t.name, t.team)}</span></div></td><td>${esc(t.record)}</td>
    <td><div class="cfp-bar"><span class="b"><i style="width:${t.make}%"></i></span><b>${pctTxt(t.make)}</b></div></td><td>${d(t.delta)}</td><td>${pctTxt(t.bye)}</td><td>${/independent/i.test(t.conf || "") ? "–" : pctTxt(t.conf_title)}</td><td>${pctTxt(t.title)}</td>
    <td>${esc(t.proj)}</td><td>${t.power ?? ""}</td><td>${t.sos ?? ""}</td><td>${t.rem_sos ?? "–"}</td><td>${t.ppg_diff > 0 ? "+" : ""}${t.ppg_diff}</td><td>${t.ovr ?? ""}</td></tr>`).join("");
  const sw = (c.games || []).map((g) => { const big = g.away_swing >= g.home_swing ? [g.away_name, g.away_swing, 100 - g.win_home] : [g.home_name, g.home_swing, g.win_home];
    return `<div class="cfp-n"><a class="tl" href="#game/${g.game}">${esc(g.away_name)} at ${esc(g.home_name)}</a>: ${esc(big[0])}'s playoff odds swing ${big[1]} points on this one (win chance ${big[2]}%).</div>`; }).join("");
  $("#view").innerHTML = `${nav}<div class="tp-grid"><div>
    <section class="card"><h2 class="card-h">Playoff odds <small>${esc(c.season_text || "")}${c.final ? " · final" : ""}</small></h2>
      <div class="scroll"><table class="tbl cfp-t"><thead><tr><th>Team</th><th>Rec</th><th>Make CFP</th><th>Δ</th><th>Bye</th><th>Conf</th><th>Title</th><th>Proj</th><th>Power</th><th>SOS</th><th>Rem SOS</th><th>Pt diff</th><th>OVR</th></tr></thead><tbody>${rows}</tbody></table></div>
      <details class="cfp-legend"><summary>What drives these numbers</summary><p>${esc(c.method)}</p><p><b>Make CFP</b> chance to reach the 12-team field. <b>Δ</b> change since last advance. <b>Bye</b> top-four seed. <b>Conf</b> conference title. <b>Title</b> national championship. <b>Proj</b> average final record. <b>Power</b> rank from team ratings and scoring margin. <b>SOS</b> full-schedule strength rank (1 = hardest). <b>Rem SOS</b> remaining schedule rank (1 = hardest). <b>Pt diff</b> average scoring margin. The dashed line marks the 12-team cut.</p></details></section>
  </div><div>
    <section class="card"><h2 class="card-h">The committee room</h2>${(c.notes || []).map((n) => `<div class="cfp-n"><b>${esc(n.k)}</b>${wireHtml(n.d)}</div>`).join("") || '<div class="empty">Notes appear after the first full week.</div>'}</section>
    ${sw ? `<section class="card"><h2 class="card-h">Games that swing the field <small>Week ${esc(c.next_week ?? "")}</small></h2>${sw}</section>` : ""}
  </div></div>`;
}

/* ---------- offseason features ---------- */
function featureCards() {
  const o = WIRE?.offseason; if (!o) return "";
  return `<section class="card"><h2 class="card-h">Offseason report <small>TD Wire</small></h2>
    ${o.nil?.list?.length ? `<div class="feat"><div class="kick">Payday</div><h3><a href="#feature/nil">${esc(o.nil.h)}</a></h3><p>${wireHtml(o.nil.d)}</p></div>` : ""}
    ${o.breakouts?.list?.length ? `<div class="feat"><div class="kick">Breakout watch</div><h3><a href="#feature/breakouts">${esc(o.breakouts.h)}</a></h3><p>${wireHtml(o.breakouts.d)}</p></div>` : ""}</section>`;
}
function renderFeature(id) {
  const o = WIRE?.offseason;
  if (!o) { $("#view").innerHTML = `<div class="card"><div class="empty">${WIRE ? "The offseason report runs from the end of the transfer portal until Week 1." : "Loading…"}</div></div>`; return; }
  if (id === "nil") {
    const items = o.nil.list.map((n) => `<div class="ni${n.user ? " mine" : ""}"><div class="rk">${n.rank}</div><div>${wireTeamTok(n.team)}</div><div>
      <h3><a href="#player/${n.player}">${esc(n.name)}</a> <span style="color:var(--dim);font-weight:700">${esc(n.position)} · ${esc(wireTeamName(n.team))}</span></h3>
      <div class="money">${n.before}K → ${n.now}K <span class="up">+${n.raise}K${n.pct != null ? ` (+${n.pct}%)` : ""}</span></div><p>${wireHtml(n.d)}</p></div></div>`).join("");
    $("#view").innerHTML = `<article class="card"><div class="art-h"><div class="kick" style="font:800 11px var(--head);color:var(--red);text-transform:uppercase">Offseason report · Payday</div><h1>${esc(o.nil.h)}</h1><p>${wireHtml(o.nil.d)}</p></div>${items}</article>`;
  } else {
    const items = o.breakouts.list.map((b) => `<div class="ni${b.user ? " mine" : ""}"><div class="rk">${b.rank}</div><div>${wireTeamTok(b.team)}</div><div>
      <h3>${wireHtml(b.h)}</h3><div class="money">${b.was} → ${b.ovr} OVR${b.archetype ? ` · ${esc(b.archetype)}` : ""}</div><p>${wireHtml(b.d)}</p>${b.last ? `<p style="font-size:12px">Last season: ${esc(b.last)}</p>` : ""}</div></div>`).join("");
    $("#view").innerHTML = `<article class="card"><div class="art-h"><div class="kick" style="font:800 11px var(--head);color:var(--red);text-transform:uppercase">Offseason report · Breakout watch</div><h1>${esc(o.breakouts.h)}</h1><p>${esc(o.breakouts.d)}</p></div>${items}</article>`;
  }
}
