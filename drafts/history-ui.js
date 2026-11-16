/* =========================================================
   HISTORY: coach careers, player careers, leaders, champions
   Data is archived by the GitHub Action into data/history/<league_id>/
   ========================================================= */
const HISTORY_BASE = "https://pirateflag23.github.io/dynasty-site/data/history";
const H_CSS = `
.h-sub{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line)}
.h-sub a{font:700 13px var(--head);padding:6px 12px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none}
.h-sub a[aria-current="page"]{background:var(--nav-2);color:#fff;border-color:var(--nav-2)}
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
.h-sec{margin:18px 14px 8px;font:800 17px var(--head);border-bottom:2px solid var(--red);padding-bottom:4px}
.h-natty{margin:12px 14px;padding:14px;border-radius:10px;color:#fff;background:radial-gradient(ellipse at 20% 0,color-mix(in srgb,#f2b134 45%,transparent),transparent 60%),var(--nav-2)}
.h-natty .lbl{font:800 13px var(--head);letter-spacing:.5px;text-transform:uppercase;color:#f2b134;margin-bottom:8px}
.h-natty .h-res b a,.h-natty .h-res a{color:#fff}.h-natty small{color:var(--nav-dim)}
.h-res{display:flex;align-items:center;gap:10px;min-width:0}.h-res .tb{flex:none}
.h-res-m{flex:1;min-width:0;font-size:14px;line-height:1.35}.h-res-m small{display:block;color:var(--dim);font-size:12px}
.h-res .sc{font:800 15px var(--head);margin:0 6px 0 4px;font-variant-numeric:tabular-nums}.h-res .sc.l{color:var(--dim)}
.h-res .vs{color:var(--dim);font-size:12px;margin-right:6px}
.h-res.big .h-res-m{font-size:20px}.h-res.big .sc{font-size:24px}
.h-bracket{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;padding:0 14px}
.h-round h4,.h-agrp h4{margin:6px 0;font:800 12px var(--head);text-transform:uppercase;letter-spacing:.5px;color:var(--dim)}
.h-bowl{padding:8px 10px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px}
.h-bowl .bn{display:block;font:700 11px var(--head);color:var(--red);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}
.h-bowl .bn:empty{display:none}
.h-confs{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0 10px;padding:0 14px}
.h-agrp{padding:0 14px}
.h-awards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;padding:0 0 8px}
.h-sec + .h-awards{padding:0 14px 8px}
.h-award{border:1px solid var(--line);border-radius:8px;padding:9px 11px}
.h-award small{display:block;font:700 11px var(--head);color:#b07d10;text-transform:uppercase;letter-spacing:.3px}
.h-award b{display:block;font:800 15px var(--head);margin:2px 0}.h-award span{font-size:12px;color:var(--dim)}
.h-aa{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px 12px;font-size:13px;padding-bottom:8px}
.h-aa b{display:inline-block;min-width:40px;color:var(--dim);font-size:11px}
.h-trophies{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;padding:14px}
.h-tcard{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.h-tcard h4{margin:0;padding:9px 12px;font:800 15px var(--head);background:var(--bg-2,#f4f4f5);border-bottom:1px solid var(--line)}
.h-tcard h4 small{display:block;font:500 11px var(--body);color:var(--dim)}
.h-tcard.cfp h4{background:color-mix(in srgb,#f2b134 22%,var(--bg-2,#f4f4f5))}
.h-trow{display:grid;grid-template-columns:42px 1fr;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid var(--line-2)}
.h-trow:first-of-type{border-top:0}.h-trow .yr{font:800 13px var(--head);color:var(--dim)}
`;

const H = { cache: {} };
const hLeague = () => D.league?.league_id ?? D.league?.data?.league_id;
const hGet = (path) => (H.cache[path] ??= fetch(`${HISTORY_BASE}/${hLeague()}/${path}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
const coachLabel = (c, link = true) => {
  const txt = c.name ? `${esc(c.name)} <span class="h-gt">(${esc(c.gamertag)})</span>` : esc(c.gamertag);
  return link ? `<a class="tl" href="#coach/${encodeURIComponent(c.gamertag)}">${txt}</a>` : txt;
};
const hWl = (w, l, t) => `${w}-${l}${t ? "-" + t : ""}`;
const hPct = (v) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));
const hNum = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));

function hShell(sub, inner) {
  const tabs = [["coaches", "Coaches"], ["careers", "Career leaders"], ["seasons", "Season leaders"], ["champions", "Champions"], ["trophies", "Trophy room"]];
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
          <td>${c.n_seasons}</td><td><b>${hWl(c.w, c.l, c.t)}</b></td><td>${hPct(c.pct)}</td><td>${hWl(c.conf_w, c.conf_l)}</td><td>${hWl(c.ranked_w, c.ranked_l)}</td>
          <td>${hWl(c.rival_w, c.rival_l)}</td><td>${hWl(c.bowl_w, c.bowl_l)}</td><td>${c.cc_wins}${c.cc_apps ? ` <small>/ ${c.cc_apps}</small>` : ""}</td>
          <td>${c.cfp_apps}</td><td>${hWl(c.cfp_w, c.cfp_l)}</td><td>${c.natty_wins ? "🏆".repeat(c.natty_wins) : "0"}</td></tr>`).join("")}</tbody></table></div>
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
    await renderChampions();
  } else if (sub === "trophies") {
    await renderTrophies();
  }
}

/* ---------- shared: archived seasons + coach lookup ---------- */
async function hSeasons() {
  const idx = await hGet("index.json");
  const years = [...(idx?.seasons || [])].sort((a, b) => b - a);
  const list = (await Promise.all(years.map((y) => hGet(`seasons/${y}.json`)))).filter(Boolean);
  const coaches = (await hGet("coaches.json"))?.coaches || [];
  const byTag = new Map(coaches.map((c) => [c.gamertag, c]));
  return { list, byTag };
}
const hSide = (g, won) => { const aw = g.a.s > g.h.s; return won === aw ? g.a : g.h; };
const hTeam = (x) => `${x.r ? `<span class="rk">${x.r}</span>` : ""}${tLink(x.t, x.k)}`;
const hCoachOf = (x, byTag) => (x.u ? (byTag.get(x.u) ? coachLabel(byTag.get(x.u)) : esc(x.u)) : "");
function hResult(g, byTag, opts = {}) {
  const W = hSide(g, true), L = hSide(g, false);
  const wc = hCoachOf(W, byTag), lc = hCoachOf(L, byTag);
  return `<div class="h-res${opts.big ? " big" : ""}">${badge(W.t)}<div class="h-res-m"><div><b>${hTeam(W)}</b> <span class="sc">${W.s}</span><span class="vs">def.</span>${hTeam(L)} <span class="sc l">${L.s}</span></div>
    ${wc || lc ? `<small>${wc ? `🎮 ${wc}` : ""}${wc && lc ? " · " : ""}${lc ? `vs 🎮 ${lc}` : ""}</small>` : ""}</div><a class="bx-link" href="#game/${g.key}">Box</a></div>`;
}

// Award titles grouped so the season page reads like a trophy case, not a list.
const AWARD_GROUPS = [
  ["Player of the year", /heisman|maxwell|walter camp|player of the year|archie griffin/i],
  ["Offense", /o'?brien|unitas|manning|doak walker|biletnikoff|mackey|hornung|offensive/i],
  ["Line", /outland|rimington|lombardi|joe moore|lineman/i],
  ["Defense", /bednarik|nagurski|butkus|thorpe|lott|hendricks|defensive|edge rusher/i],
  ["Special teams", /groza|ray guy|returner|special|jet award/i],
  ["Freshman", /freshman|shaun alexander/i],
];
const awardGroup = (title) => (AWARD_GROUPS.find(([, re]) => re.test(title)) || ["Other"])[0];

let hChampYear = null;
async function renderChampions() {
  const { list, byTag } = await hSeasons();
  if (!list.length) { $("#h-in").innerHTML = '<div class="empty">No seasons archived yet.</div>'; return; }
  if (!list.some((s) => s.season === hChampYear)) hChampYear = (list.find((s) => s.final) || list[0]).season;
  const s = list.find((x) => x.season === hChampYear);
  const played = s.games.filter((g) => g.played);
  const natty = played.find((g) => g.type === "natty");
  // CFP rounds: First Round games, then the New Year's Six bowls (earlier week = quarterfinals, later = semifinals)
  const cfp = played.filter((g) => g.type === "cfp");
  const first = cfp.filter((g) => /First Round/i.test(g.label));
  const ny6 = cfp.filter((g) => !/First Round/i.test(g.label));
  const wks = [...new Set(ny6.map((g) => g.w))].sort((a, b) => a - b);
  const qf = wks.length > 1 ? ny6.filter((g) => g.w === wks[0]) : ny6.slice(0, 4);
  const sf = wks.length > 1 ? ny6.filter((g) => g.w !== wks[0]) : ny6.slice(4);
  const round = (title, games) => (games.length ? `<div class="h-round"><h4>${title}</h4>${games.map((g) => `<div class="h-bowl"><span class="bn">${esc(/First Round/i.test(g.label) ? "" : g.label)}</span>${hResult(g, byTag)}</div>`).join("")}</div>` : "");
  const confG = played.filter((g) => g.type === "confchamp").sort((a, b) => a.label.localeCompare(b.label));
  const awards = s.annual_awards.filter((a) => !/HC|OC|DC/.test(a.position || ""));
  const coachAw = s.annual_awards.filter((a) => /HC|OC|DC/.test(a.position || ""));
  const groups = {}; for (const a of awards) (groups[awardGroup(a.title)] ??= []).push(a);
  const order = [...AWARD_GROUPS.map(([g]) => g), "Other"];
  const awardCard = (a) => `<div class="h-award"><small>${esc(a.title)}</small><b>${esc(a.name)}</b><span>${esc(a.position || "")} · ${esc(a.team?.name || "")}</span></div>`;
  const aa = s.all_americans.filter((t) => t.conf === "National" && !/preseason/i.test(t.team));

  $("#h-in").innerHTML = `
    <div class="ctrl">${list.map((x) => `<button class="pill" data-cy="${x.season}" aria-pressed="${x.season === hChampYear}">${x.season}${x.final ? "" : " •"}</button>`).join("")}</div>
    ${natty ? `<div class="h-natty"><div class="lbl">🏆 ${s.season} National Champion</div>${hResult(natty, byTag, { big: true })}</div>` : `<div class="h-note">${s.season} is still in progress. The national champion appears here after the title game.</div>`}
    ${cfp.length || natty ? `<h3 class="h-sec">College Football Playoff</h3><div class="h-bracket">${round("First round", first)}${round("Quarterfinals", qf)}${round("Semifinals", sf)}${natty ? round("National Championship", [natty]) : ""}</div>` : ""}
    ${confG.length ? `<h3 class="h-sec">Conference champions</h3><div class="h-confs">${confG.map((g) => `<div class="h-bowl"><span class="bn">${esc(g.label.replace(/ Championship$/, ""))}</span>${hResult(g, byTag)}</div>`).join("")}</div>` : ""}
    ${awards.length ? `<h3 class="h-sec">Player awards</h3>${order.filter((g) => groups[g]).map((g) => `<div class="h-agrp"><h4>${g}</h4><div class="h-awards">${groups[g].map(awardCard).join("")}</div></div>`).join("")}` : ""}
    ${coachAw.length ? `<h3 class="h-sec">Coaching awards</h3><div class="h-awards">${coachAw.map(awardCard).join("")}</div>` : ""}
    ${aa.length ? `<h3 class="h-sec">All-Americans</h3>${aa.map((t) => `<div class="h-agrp"><h4>${esc(t.team)}</h4><div class="h-aa">${t.players.map((p) => `<span><b>${esc(p.p)}</b> <a class="pl-link" href="#player/${p.k}">${esc(p.n)}</a> <small>${esc(p.tn)}</small></span>`).join("")}</div></div>`).join("")}` : ""}`;
  document.querySelectorAll("[data-cy]").forEach((b) => b.onclick = () => { hChampYear = +b.dataset.cy; renderChampions(); });
}

/* ---------- trophy room: every title, bowl and rivalry trophy, with its history ---------- */
let hTrophyFilter = "all";
async function renderTrophies() {
  const [{ list, byTag }, rv] = await Promise.all([hSeasons(), fetch(`${HISTORY_BASE.replace(/\/data\/history$/, "")}/rivalries.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : { rivalries: [] })).catch(() => ({ rivalries: [] }))]);
  const nm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rivalOf = new Map(); for (const [a, b, n] of rv.rivalries || []) { rivalOf.set(nm(a) + "|" + nm(b), n); rivalOf.set(nm(b) + "|" + nm(a), n); }
  const T = new Map();
  const add = (name, kind, rank, season, g) => { const t = T.get(name) || { name, kind, rank, games: [] }; t.games.push({ season, g }); T.set(name, t); };
  for (const s of list) for (const g of s.games.filter((x) => x.played)) {
    if (g.type === "natty") add("National Championship", "cfp", 0, s.season, g);
    else if (g.type === "cfp") add(/First Round/i.test(g.label) ? "CFP First Round" : g.label, "cfp", /First Round/i.test(g.label) ? 2 : 1, s.season, g);
    else if (g.type === "confchamp") add(g.label, "conf", 3, s.season, g);
    else if (g.type === "bowl") add(g.label, "bowl", 4, s.season, g);
    else { const r = rivalOf.get(nm(g.a.t) + "|" + nm(g.h.t)); if (r) add(r, "rivalry", 5, s.season, g); }
  }
  const kinds = [["all", "All"], ["cfp", "Playoff"], ["conf", "Conference titles"], ["bowl", "Bowls"], ["rivalry", "Rivalry trophies"]];
  let rows = [...T.values()].filter((t) => hTrophyFilter === "all" || t.kind === hTrophyFilter).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const icon = { cfp: "🏆", conf: "🥇", bowl: "🏈", rivalry: "⚔️" };
  $("#h-in").innerHTML = `<div class="ctrl">${kinds.map(([k, l]) => `<button class="pill" data-tf="${k}" aria-pressed="${k === hTrophyFilter}">${l}</button>`).join("")}</div>
    <div class="h-trophies">${rows.map((t) => `<div class="h-tcard ${t.kind}"><h4>${icon[t.kind]} ${esc(t.name)}${t.kind === "rivalry" ? ` <small>${esc(t.games[0].g.a.t)} vs ${esc(t.games[0].g.h.t)}</small>` : ""}</h4>
      ${t.games.sort((a, b) => b.season - a.season || b.g.w - a.g.w).map(({ season, g }) => `<div class="h-trow"><span class="yr">${season}</span>${hResult(g, byTag)}</div>`).join("")}</div>`).join("") || '<div class="empty">No trophies in this category yet.</div>'}</div>
    <div class="h-note">Every championship, playoff game, bowl and rivalry trophy in this dynasty. 🎮 marks a league coach.</div>`;
  document.querySelectorAll("[data-tf]").forEach((b) => b.onclick = () => { hTrophyFilter = b.dataset.tf; renderTrophies(); });
}

async function renderCoach(tag) {
  $("#view").innerHTML = '<div class="card"><div class="empty">Loading coach…</div></div>';
  const d = await hGet("coaches.json");
  const c = d?.coaches?.find((x) => x.gamertag === tag);
  if (!c) { $("#view").innerHTML = `<div class="card"><div class="empty">No history for ${esc(tag)} yet. <a href="#history/coaches">All coaches</a></div></div>`; return; }
  document.title = `${c.name || c.gamertag} · ${CONFIG.SITE_NAME}`;
  const tiles = [["Record", hWl(c.w, c.l, c.t)], ["Win %", hPct(c.pct)], ["Conference", hWl(c.conf_w, c.conf_l)], ["vs Top 25", hWl(c.ranked_w, c.ranked_l)],
    ["Rivalry", hWl(c.rival_w, c.rival_l)], ["Bowls", hWl(c.bowl_w, c.bowl_l)], ["Conf titles", `${c.cc_wins}/${c.cc_apps}`], ["CFP apps", c.cfp_apps], ["CFP", hWl(c.cfp_w, c.cfp_l)], ["Natl titles", c.natty_wins]];
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
        ${yrs.map((y) => { const r = c.seasons[y]; return `<tr><td>${y}</td><td>${tLink(r.team, r.team_key)}</td><td><b>${hWl(r.w, r.l, r.t)}</b></td><td>${hWl(r.conf_w, r.conf_l)}</td><td style="text-align:left;white-space:normal">${esc(r.notes.join(" · ") || "—")}</td></tr>`; }).join("")}</tbody></table></div></section>
    </div><div>
      <section class="card"><h2 class="card-h">Jobs</h2><div class="scroll"><table class="tbl"><thead><tr><th>Team</th><th>Years</th><th>W-L</th></tr></thead><tbody>
        ${c.stints.map((s) => `<tr><td>${tLink(s.team, s.team_key)}</td><td>${s.from}${s.to !== s.from ? "–" + s.to : ""}</td><td>${hWl(s.w, s.l, s.t)}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="card"><h2 class="card-h">Rivalries</h2>${Object.keys(c.rivalry_games).length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Rivalry</th><th>vs</th><th>W-L</th></tr></thead><tbody>
        ${Object.entries(c.rivalry_games).map(([n, r]) => `<tr><td>${esc(n)}</td><td>${esc(r.vs)}</td><td>${hWl(r.w, r.l)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No rivalry games yet.</div>'}</section>
      <section class="card"><h2 class="card-h">Head to head <small>vs league coaches</small></h2>${h2h.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Coach</th><th>W-L</th></tr></thead><tbody>
        ${h2h.map(([u, r]) => `<tr><td>${coachBy.get(u) ? coachLabel(coachBy.get(u)) : esc(u)}</td><td>${hWl(r.w, r.l, r.t)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">No games against league coaches yet.</div>'}</section>
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
