/* =========================================================
   HISTORY: coach careers, player careers, leaders, champions
   Data is archived by the GitHub Action into data/history/<league_id>/
   ========================================================= */
const HISTORY_BASE = "https://pirateflag23.github.io/dynasty-site/data/history";
const H_CSS = `
.h-sub{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line)}
.h-sub a{font:700 13px var(--head);padding:6px 12px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none}
.h-sub a[aria-current="page"]{background:var(--ink);color:var(--bg,#fff);border-color:var(--ink)}
.h-tbl th[data-k]{cursor:pointer;user-select:none}.h-tbl th[data-k]:hover{color:var(--ink)}
.h-tbl th.on{color:var(--red)}
.h-tbl td small,.h-coach small{color:var(--dim);font-weight:500}
.h-gt{color:var(--dim);font-weight:500}
.h-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;padding:14px}
.h-tiles div{background:var(--bg-2,#f4f4f5);border-radius:8px;padding:10px 12px}
.h-tiles b{display:block;font:800 22px/1.1 var(--head)}.h-tiles span{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.4px}
.h-head{padding:18px;background:var(--nav-2);color:#fff;border:0}
.h-head h1{margin:0;font:800 28px/1.1 var(--head)}.h-head .gt{color:var(--nav-dim);font-weight:600}
.h-head .cur{margin-top:6px;color:var(--nav-dim);font-size:13px}
.h-trophy{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 14px}
.h-trophy span{font:700 12px var(--body);background:color-mix(in srgb,#f2b134 22%,transparent);border:1px solid color-mix(in srgb,#f2b134 55%,transparent);border-radius:999px;padding:4px 10px}
.h-aw{display:flex;flex-direction:column}
.h-aw div{display:grid;grid-template-columns:48px 1fr;gap:8px;padding:8px 14px;border-top:1px solid var(--line-2)}
.h-aw b{font:800 13px var(--head)}.h-aw .maj{color:#b07d10}.h-aw small{display:block;color:var(--dim);font-size:12px}
.h-season{padding:12px 14px;border-top:1px solid var(--line-2)}
.h-season h3{margin:0 0 6px;font:800 16px var(--head)}
.h-season ul{margin:0;padding-left:18px;font-size:13px;line-height:1.6}
.h-note{padding:10px 14px;font-size:12px;color:var(--dim)}
`;

const H = { cache: {} };
const hLeague = () => D.league?.league_id ?? D.league?.data?.league_id;
const hGet = (path) => (H.cache[path] ??= fetch(`${HISTORY_BASE}/${hLeague()}/${path}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
const coachLabel = (c, link = true) => {
  const txt = c.name ? `${esc(c.name)} <span class="h-gt">(${esc(c.gamertag)})</span>` : esc(c.gamertag);
  return link ? `<a class="tl" href="#coach/${encodeURIComponent(c.gamertag)}">${txt}</a>` : txt;
};
const wl = (w, l, t) => `${w}-${l}${t ? "-" + t : ""}`;
const pct = (v) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));
const hNum = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));

function hShell(sub, inner) {
  const tabs = [["coaches", "Coaches"], ["careers", "Career leaders"], ["seasons", "Season leaders"], ["champions", "Champions"]];
  return `<section class="card"><h2 class="card-h">Dynasty history <small>${esc(D.league?.data?.name || "")}</small></h2>
    <nav class="h-sub">${tabs.map(([k, l]) => `<a href="#history/${k}" ${k === sub ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <div id="h-in">${inner}</div></section>`;
}

let hSort = { k: "w", dir: -1 }, hCat = "passYards", hYear = "all";
async function renderHistory(sub = "coaches") {
  $("#view").innerHTML = hShell(sub, '<div class="empty">Loading history…</div>');
  if (sub === "coaches") {
    const d = await hGet("coaches.json");
    if (!d?.coaches?.length) { $("#h-in").innerHTML = '<div class="empty">No coach history yet. It builds automatically after the next sync.</div>'; return; }
    const cols = [["name", "Coach"], ["n_seasons", "Yrs"], ["w", "W-L"], ["pct", "Pct"], ["conf_w", "Conf"], ["ranked_w", "vs Top 25"], ["rival_w", "Rivalry"],
      ["bowl_w", "Bowls"], ["cc_wins", "Conf titles"], ["cfp_apps", "CFP"], ["cfp_w", "CFP W-L"], ["natty_wins", "Natl titles"]];
    const draw = () => {
      const rows = [...d.coaches].sort((a, b) => (hSort.k === "name" ? (a.name || a.gamertag).localeCompare(b.name || b.gamertag) : (a[hSort.k] ?? 0) - (b[hSort.k] ?? 0)) * hSort.dir);
      $("#h-in").innerHTML = `<div class="scroll"><table class="tbl h-tbl"><thead><tr>${cols.map(([k, l]) => `<th data-k="${k}" class="${hSort.k === k ? "on" : ""}">${l}</th>`).join("")}</tr></thead><tbody>
        ${rows.map((c) => `<tr><td class="pl">${coachLabel(c)}<br><small>${esc(c.current_team || "")}${c.stints.length > 1 ? ` · ${c.stints.length} jobs` : ""}</small></td>
          <td>${c.n_seasons}</td><td><b>${wl(c.w, c.l, c.t)}</b></td><td>${pct(c.pct)}</td><td>${wl(c.conf_w, c.conf_l)}</td><td>${wl(c.ranked_w, c.ranked_l)}</td>
          <td>${wl(c.rival_w, c.rival_l)}</td><td>${wl(c.bowl_w, c.bowl_l)}</td><td>${c.cc_wins}${c.cc_apps ? ` <small>/ ${c.cc_apps}</small>` : ""}</td>
          <td>${c.cfp_apps}</td><td>${wl(c.cfp_w, c.cfp_l)}</td><td>${c.natty_wins ? "🏆".repeat(c.natty_wins) : "0"}</td></tr>`).join("")}</tbody></table></div>
        <div class="h-note">Click a column to sort. Conf titles show wins / title-game appearances. Records follow the coach across every job in this dynasty.</div>`;
      document.querySelectorAll(".h-tbl th[data-k]").forEach((th) => th.onclick = () => { const k = th.dataset.k; hSort = { k, dir: hSort.k === k ? -hSort.dir : k === "name" ? 1 : -1 }; draw(); });
    };
    draw();
  } else if (sub === "careers" || sub === "seasons") {
    const d = await hGet("leaders.json");
    if (!d) { $("#h-in").innerHTML = '<div class="empty">No leaders yet.</div>'; return; }
    const draw = () => {
      let rows = (sub === "careers" ? d.career : d.season)[hCat] || [];
      if (sub === "seasons" && hYear !== "all") rows = rows.filter((r) => String(r.y) === String(hYear));
      $("#h-in").innerHTML = `<div class="ctrl">${Object.entries(d.cats).map(([k, l]) => `<button class="pill" data-cat="${k}" aria-pressed="${k === hCat}">${esc(l)}</button>`).join("")}</div>
        ${sub === "seasons" ? `<div class="ctrl"><button class="pill" data-yr="all" aria-pressed="${hYear === "all"}">All seasons</button>${d.seasons.map((y) => `<button class="pill" data-yr="${y}" aria-pressed="${String(y) === String(hYear)}">${y}</button>`).join("")}</div>` : ""}
        <div class="scroll"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>${sub === "careers" ? "Seasons" : "Season"}</th><th>Team</th><th>G</th><th>${esc(d.cats[hCat])}</th></tr></thead><tbody>
        ${rows.slice(0, 25).map((r, i) => `<tr><td>${i + 1}</td><td class="pl"><a class="pl-link" href="#player/${r.k}">${esc(r.n)}</a> <small>${esc(r.p || "")}</small></td><td>${sub === "careers" ? esc(r.span) : r.y}</td><td>${esc(r.tn)}</td><td>${r.g}</td><td><b>${hNum(r.v)}</b></td></tr>`).join("") || '<tr><td colspan="6">No data</td></tr>'}</tbody></table></div>
        <div class="h-note">${sub === "careers" ? "Totals across every season of this dynasty, all teams combined." : "Best single seasons in dynasty history. Pick a season to compare years."}</div>`;
      document.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { hCat = b.dataset.cat; draw(); });
      document.querySelectorAll("[data-yr]").forEach((b) => b.onclick = () => { hYear = b.dataset.yr; draw(); });
    };
    draw();
  } else if (sub === "champions") {
    const idx = await hGet("index.json");
    const seasons = [...(idx?.seasons || [])].reverse();
    const all = await Promise.all(seasons.map((y) => hGet(`seasons/${y}.json`)));
    const coaches = (await hGet("coaches.json"))?.coaches || [];
    const userCoach = (s, teamKey) => { const g = s.games.find((x) => (x.type === "natty" || x.type === "confchamp") && (x.a.k === teamKey || x.h.k === teamKey)); const side = g && (g.a.k === teamKey ? g.a : g.h); const c = side?.u && coaches.find((c) => c.gamertag === side.u); return c ? ` · ${coachLabel(c)}` : ""; };
    $("#h-in").innerHTML = all.filter(Boolean).map((s) => {
      const nat = s.champions.find((c) => c.kind === "national_championship");
      const confs = s.champions.filter((c) => c.kind === "conference_championship");
      const awards = s.annual_awards.filter((a) => !/HC|OC|DC/.test(a.position || ""));
      return `<div class="h-season"><h3>${s.season}${s.final ? "" : " <small>(in progress)</small>"}</h3>
        ${nat ? `<p style="margin:0 0 8px">🏆 <b>National champion: ${esc(nat.team.name)}</b> (${esc(nat.team.record || "")}) def. ${esc(nat.opponent?.name || "")}, ${esc(nat.result || "")}${userCoach(s, nat.team.team_key)}</p>` : ""}
        ${confs.length ? `<ul>${confs.map((c) => `<li><b>${esc(c.conference)}:</b> ${esc(c.team.name)} def. ${esc(c.opponent?.name || "")}, ${esc(c.result || "")}${userCoach(s, c.team.team_key)}</li>`).join("")}</ul>` : ""}
        ${awards.length ? `<p style="margin:8px 0 0;font-size:13px">${awards.map((a) => `<b>${esc(a.title)}:</b> ${esc(a.name)} (${esc(a.position || "")}, ${esc(a.team?.name || "")})`).join(" · ")}</p>` : ""}</div>`;
    }).join("") || '<div class="empty">No seasons archived yet.</div>';
  }
}

async function renderCoach(tag) {
  $("#view").innerHTML = '<div class="card"><div class="empty">Loading coach…</div></div>';
  const d = await hGet("coaches.json");
  const c = d?.coaches?.find((x) => x.gamertag === tag);
  if (!c) { $("#view").innerHTML = `<div class="card"><div class="empty">No history for ${esc(tag)} yet. <a href="#history/coaches">All coaches</a></div></div>`; return; }
  document.title = `${c.name || c.gamertag} · ${CONFIG.SITE_NAME}`;
  const tiles = [["Record", wl(c.w, c.l, c.t)], ["Win %", pct(c.pct)], ["Conference", wl(c.conf_w, c.conf_l)], ["vs Top 25", wl(c.ranked_w, c.ranked_l)],
    ["Rivalry", wl(c.rival_w, c.rival_l)], ["Bowls", wl(c.bowl_w, c.bowl_l)], ["Conf titles", `${c.cc_wins}/${c.cc_apps}`], ["CFP apps", c.cfp_apps], ["CFP", wl(c.cfp_w, c.cfp_l)], ["Natl titles", c.natty_wins]];
  const yrs = Object.keys(c.seasons).sort((a, b) => b - a);
  const h2h = Object.entries(c.h2h).sort((a, b) => b[1].w + b[1].l - (a[1].w + a[1].l));
  const coachBy = new Map((d.coaches || []).map((x) => [x.gamertag, x]));
  $("#view").innerHTML = `
    <section class="card h-head"><h1>${c.name ? esc(c.name) + ` <span class="gt">(${esc(c.gamertag)})</span>` : esc(c.gamertag)}</h1>
      <div class="cur">${c.current_team ? `Current: ${tLink(c.current_team, c.stints[c.stints.length - 1].team_key)} · ` : ""}${c.n_seasons} season${c.n_seasons === 1 ? "" : "s"} · ${c.first}${c.last !== c.first ? "–" + c.last : ""}</div></section>
    <div class="tp-grid"><div>
      <section class="card"><h2 class="card-h">Career</h2><div class="h-tiles">${tiles.map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>
        ${c.titles.length ? `<div class="h-trophy">${c.titles.map((t) => `<span>🏆 ${t.season} ${esc(t.title)} · ${esc(t.team)}</span>`).join("")}</div>` : ""}</section>
      <section class="card"><h2 class="card-h">Season by season</h2><div class="scroll"><table class="tbl"><thead><tr><th>Season</th><th>Team</th><th>W-L</th><th>Conf</th><th>Postseason</th></tr></thead><tbody>
        ${yrs.map((y) => { const r = c.seasons[y]; return `<tr><td>${y}</td><td>${tLink(r.team, r.team_key)}</td><td><b>${wl(r.w, r.l, r.t)}</b></td><td>${wl(r.conf_w, r.conf_l)}</td><td style="text-align:left;white-space:normal">${esc(r.notes.join(" · ") || "—")}</td></tr>`; }).join("")}</tbody></table></div></section>
    </div><div>
      <section class="card"><h2 class="card-h">Jobs</h2><div class="scroll"><table class="tbl"><thead><tr><th>Team</th><th>Years</th><th>W-L</th></tr></thead><tbody>
        ${c.stints.map((s) => `<tr><td>${tLink(s.team, s.team_key)}</td><td>${s.from}${s.to !== s.from ? "–" + s.to : ""}</td><td>${wl(s.w, s.l, s.t)}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="card"><h2 class="card-h">Rivalries</h2>${Object.keys(c.rivalry_games).length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Rivalry</th><th>vs</th><th>W-L</th></tr></thead><tbody>
        ${Object.entries(c.rivalry_games).map(([n, r]) => `<tr><td>${esc(n)}</td><td>${esc(r.vs)}</td><td>${wl(r.w, r.l)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No rivalry games yet.</div>'}</section>
      <section class="card"><h2 class="card-h">Head to head <small>vs league coaches</small></h2>${h2h.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Coach</th><th>W-L</th></tr></thead><tbody>
        ${h2h.map(([u, r]) => `<tr><td>${coachBy.get(u) ? coachLabel(coachBy.get(u)) : esc(u)}</td><td>${wl(r.w, r.l, r.t)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No games against league coaches yet.</div>'}</section>
    </div></div>`;
  window.scrollTo(0, 0);
}

// Player card: awards and dynasty career (season rows + totals).
async function playerHistory(key) {
  const idx = await hGet("index.json"); if (!idx) return;
  const shard = await hGet(`careers/${key % (idx.shards || 64)}.json`);
  const c = shard?.[key];
  if (!c || location.hash !== "#player/" + key) return;
  const cols = [["G", "gamesPlayed"], ["Pass yds", "passYards"], ["Pass TD", "passTD"], ["INT", "passINT"], ["Rush yds", "rushYards"], ["Rush TD", "rushTD"],
    ["Rec", "receiveReceptions"], ["Rec yds", "receivingYards"], ["Rec TD", "receiveTouchdowns"], ["Tkl", "defenseTotalTackles"], ["Sacks", "defenseSacks"], ["Def INT", "defenseInterceptions"]]
    .filter(([, k]) => k === "gamesPlayed" || c.totals[k]);
  const car = $("#pc-career");
  if (car) {
    car.hidden = false;
    car.querySelector(".in").innerHTML = `<div class="scroll"><table class="tbl"><thead><tr><th>Season</th><th>Team</th>${cols.map(([l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>
      ${c.seasons.map((r) => `<tr><td>${r.y}${r.partial ? "*" : ""}</td><td>${tLink(r.tn, r.t)}</td>${cols.map(([, k]) => `<td>${hNum(r.s[k] || 0)}</td>`).join("")}</tr>`).join("")}
      ${c.seasons.length > 1 ? `<tr style="font-weight:800"><td>Career</td><td></td>${cols.map(([, k]) => `<td>${hNum(c.totals[k] || 0)}</td>`).join("")}</tr>` : ""}</tbody></table></div>
      ${c.seasons.some((r) => r.partial) ? '<div class="h-note">* Season archived before full-FBS tracking began.</div>' : ""}`;
  }
  const aw = $("#pc-awards");
  if (aw && c.awards.length) {
    aw.hidden = false;
    const list = [...c.awards].sort((a, b) => b.y - a.y || (b.major ? 1 : 0) - (a.major ? 1 : 0) || (a.w ?? 99) - (b.w ?? 99));
    aw.querySelector(".in").innerHTML = `<div class="h-aw">${list.map((a) => `<div><b>${a.y}</b><span class="${a.major ? "maj" : ""}">${a.major ? "🏆 " : ""}${esc(a.award)}${a.w != null ? ` · Wk ${a.w}` : ""}<small>${esc(a.team || "")}${a.line ? " · " + esc(a.line) : ""}</small></span></div>`).join("")}</div>`;
    aw.querySelector(".card-h small").textContent = `${c.awards.length} total`;
  }
}
