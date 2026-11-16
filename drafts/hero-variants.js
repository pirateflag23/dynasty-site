// Hero ("Top result") card variants for the ODL site. Uses the site's own helpers:
// winnerLoser, headline, badge, rk, tLink, coach, teamRec, teamColor, teamAccent, esc, loadGame, initials.
const HERO_CSS = `
.hero{position:relative;overflow:hidden;isolation:isolate}
.hero .hero-tag,.hero .hero-body,.hero .hero-line,.hero .hero-extra{position:relative;z-index:2}
.hero-badges{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:0 18px 6px;position:relative;z-index:2}
.hero-badges span{font:800 10px/1 var(--head);letter-spacing:.6px;padding:5px 8px;border-radius:3px;background:rgba(255,255,255,.12);color:#fff;text-transform:uppercase;backdrop-filter:blur(2px)}
.hero-badges .hot{background:var(--red)}
.hero-badges .gold{background:#f2b134;color:#121213}
.hero-extra{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:stretch;margin:0 18px 18px;padding:12px 14px;border-radius:8px;background:rgba(0,0,0,.38);backdrop-filter:blur(3px);border:1px solid rgba(255,255,255,.08)}
.hero-ls{font:700 12px/1.55 var(--body);font-variant-numeric:tabular-nums;border-collapse:collapse;color:#d7d8da}
.hero-ls th{font-weight:700;color:#8d8f93;padding:0 7px;text-align:center}
.hero-ls td{padding:0 7px;text-align:center}.hero-ls td:first-child,.hero-ls th:first-child{text-align:left;padding-left:0}
.hero-ls td:last-child{font-weight:800;color:#fff}
.hero-pog{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;border-left:1px solid rgba(255,255,255,.12);padding-left:14px}
.hero-pog div{min-width:0}.hero-pog small{display:block;font:800 10px/1 var(--head);letter-spacing:.5px;color:#8d8f93;text-transform:uppercase;margin-bottom:4px}
.hero-pog b{display:block;font:700 13px/1.2 var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hero-pog b a{color:#fff}.hero-pog span{font-size:12px;color:#c9cacd}
@media (max-width:640px){.hero-extra{grid-template-columns:1fr}.hero-pog{border-left:0;padding-left:0;border-top:1px solid rgba(255,255,255,.12);padding-top:10px}}
.hero-score span{display:inline-block}
@keyframes heroIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.hero-score span{animation:heroIn .5s ease-out both}.hero-score span+span{animation-delay:.12s}
@keyframes sweep{0%{transform:translateX(-120%) skewX(-18deg)}60%,100%{transform:translateX(320%) skewX(-18deg)}}
.hero .sweep{position:absolute;top:0;bottom:0;left:0;width:30%;z-index:1;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);animation:sweep 6s ease-in-out 1s infinite}
@media (prefers-reduced-motion:reduce){.hero .sweep,.hero-score span{animation:none}}

/* A · Team split */
.hero.v-split{background:#121213}
.hero.v-split .bg{position:absolute;inset:0;z-index:0;background:
  linear-gradient(105deg,var(--ca) 0 49.6%,transparent 50%),linear-gradient(105deg,transparent 50.4%,var(--ch) 50.6%)}
.hero.v-split .bg::after{content:"";position:absolute;inset:0;background:
  linear-gradient(105deg,transparent 48.5%,var(--cx) 49%,var(--cx) 51%,transparent 51.5%),
  linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.72) 70%),
  repeating-linear-gradient(105deg,rgba(255,255,255,.035) 0 2px,transparent 2px 14px)}
.hero.v-split .bg .lose{position:absolute;inset:0}
.hero.v-split .wm{position:absolute;top:50%;transform:translateY(-58%);font:900 190px/1 var(--head);font-style:italic;color:rgba(255,255,255,.09);letter-spacing:-6px;z-index:1;pointer-events:none;white-space:nowrap}
.hero.v-split .wm.a{left:-10px}.hero.v-split .wm.h{right:-10px}
.hero.v-split .hero-tag{display:inline-block;clip-path:polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%);padding-right:22px}

/* B · Gridiron */
.hero.v-field{background:#173d22}
.hero.v-field .bg{position:absolute;inset:0;z-index:0;background:
  linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.62)),
  repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 2px,transparent 2px 10%),
  repeating-linear-gradient(90deg,transparent 0 5%,rgba(255,255,255,.035) 5% 10%),
  radial-gradient(ellipse at 50% 35%,#2f7a40,#163a20 75%);background-position:0 0,5% 0,0 0,0 0}
.hero.v-field .bg::before{content:"";position:absolute;left:0;right:0;top:22%;height:3px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 2px,transparent 2px 2%)}
.hero.v-field .bg::after{content:"";position:absolute;left:0;right:0;bottom:30%;height:3px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 2px,transparent 2px 2%)}
.hero.v-field .ez{position:absolute;top:0;bottom:0;width:11%;z-index:1;display:flex;align-items:center;justify-content:center}
.hero.v-field .ez.a{left:0;background:linear-gradient(90deg,var(--ca),color-mix(in srgb,var(--ca) 70%,transparent))}
.hero.v-field .ez.h{right:0;background:linear-gradient(270deg,var(--ch),color-mix(in srgb,var(--ch) 70%,transparent))}
.hero.v-field .ez span{writing-mode:vertical-rl;font:900 28px/1 var(--head);letter-spacing:6px;color:rgba(255,255,255,.55);text-transform:uppercase;font-style:italic}
.hero.v-field .ez.a span{transform:rotate(180deg)}
.hero.v-field .hero-body,.hero.v-field .hero-line,.hero.v-field .hero-badges,.hero.v-field .hero-extra{margin-left:11%;margin-right:11%}
.hero.v-field .hero-line{text-shadow:0 2px 10px rgba(0,0,0,.6)}
@media (max-width:640px){.hero.v-field .ez{width:7%}.hero.v-field .ez span{font-size:16px;letter-spacing:3px}.hero.v-field .hero-body,.hero.v-field .hero-line,.hero.v-field .hero-badges,.hero.v-field .hero-extra{margin-left:7%;margin-right:7%}}

/* C · Spotlight (photo-ready) */
.hero.v-spot{background:#0b0b0c}
.hero.v-spot .bg{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;filter:saturate(1.1)}
.hero.v-spot .bg::after{content:"";position:absolute;inset:0;background:
  radial-gradient(ellipse 55% 85% at var(--wx) 30%,color-mix(in srgb,var(--cw) 70%,transparent),transparent 70%),
  radial-gradient(ellipse 40% 60% at var(--lx) 40%,color-mix(in srgb,var(--cl) 30%,transparent),transparent 70%),
  linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.85) 75%)}
.hero.v-spot.has-photo .bg::after{background:
  radial-gradient(ellipse 55% 85% at var(--wx) 30%,color-mix(in srgb,var(--cw) 45%,transparent),transparent 70%),
  linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,.88) 72%)}
.hero.v-spot .grain{position:absolute;inset:0;z-index:1;opacity:.18;mix-blend-mode:overlay;pointer-events:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.hero.v-spot .hero-score span:not(.l){text-shadow:0 0 24px color-mix(in srgb,var(--cw) 80%,transparent)}
.hero.v-spot .hero-line{border-left:4px solid var(--cw);margin:0 18px 16px;padding:2px 0 2px 12px}
`;

function heroBadges(g, h, b) {
  const out = [];
  const ra = g.away.rank_at_game, rh = g.home.rank_at_game, ranked = (r) => r > 0 && r <= 25;
  const margin = Math.abs(g.home.score - g.away.score);
  if (g.kind === "user_vs_user") out.push(["gold", "Game of the week"]);
  if (h.upset) out.push(["hot", "Upset"]);
  if (ranked(ra) && ranked(rh)) out.push(["", "Ranked matchup"]);
  const q = b?.Home?.Quarters || [];
  if (q.length > 4 && (q[4] || b.Away.Quarters[4])) out.push(["hot", "Overtime"]);
  if (margin <= 3) out.push(["", "Nail-biter"]);
  if (margin >= 28) out.push(["", "Blowout"]);
  return out.length ? `<div class="hero-badges">${out.map(([c, t]) => `<span class="${c}">${t}</span>`).join("")}</div>` : "";
}

function heroExtra(g, b) {
  if (!b) return "";
  const ot = (b.Home.Quarters || []).length > 4 && (b.Home.Quarters[4] || b.Away.Quarters[4]);
  const qs = (t) => (t.Quarters || []).slice(0, ot ? 5 : 4);
  const ls = `<table class="hero-ls"><tr><th></th>${["1", "2", "3", "4"].concat(ot ? ["OT"] : []).map((x) => `<th>${x}</th>`).join("")}<th>T</th></tr>
    ${[b.Away, b.Home].map((t) => `<tr><td>${esc(t.Abbrev)}</td>${qs(t).map((v) => `<td>${v}</td>`).join("")}<td>${t.Score}</td></tr>`).join("")}</table>`;
  const P = b.Players || [], ab = (p) => (p.Team === g.home.team_key ? b.Home.Abbrev : b.Away.Abbrev);
  const best = (score) => P.filter((p) => score(p.Stats) > 0).sort((x, y) => score(y.Stats) - score(x.Stats))[0];
  const qb = best((s) => s.passYards + 20 * s.passTD - 25 * s.passINT);
  const sk = best((s) => s.rushYards + s.receivingYards + 20 * (s.rushTD + s.receiveTouchdowns));
  const df = best((s) => s.defenseTotalTackles + 4 * s.defenseSacks + 6 * s.defenseInterceptions + 2 * s.defenseTacklesForLoss);
  const pl = (p) => `<a href="#player/${p.Key}">${esc(p.Name)}</a> <span>${esc(ab(p))}</span>`;
  const cell = (label, p, line) => (p ? `<div><small>${label}</small><b>${pl(p)}</b><span>${line(p.Stats)}</span></div>` : "");
  const pog = [
    cell("Passing", qb, (s) => `${s.passCompletion}/${s.passAttempts}, ${s.passYards} yds, ${s.passTD} TD`),
    cell(sk && sk.Stats.receivingYards > sk.Stats.rushYards ? "Receiving" : "Rushing", sk, (s) => (s.receivingYards > s.rushYards ? `${s.receiveReceptions} rec, ${s.receivingYards} yds, ${s.receiveTouchdowns} TD` : `${s.rushAttempts} car, ${s.rushYards} yds, ${s.rushTD} TD`)),
    cell("Defense", df, (s) => [`${s.defenseTotalTackles} tkl`, s.defenseSacks && `${s.defenseSacks} sk`, s.defenseInterceptions && `${s.defenseInterceptions} INT`].filter(Boolean).join(", ")),
  ].join("");
  return `<div class="hero-extra">${ls}<div class="hero-pog">${pog}</div></div>`;
}

function heroCard(g) {
  if (!g) return "";
  const v = window.HERO_VARIANT || "split";
  const [w] = winnerLoser(g);
  const h = headline(g);
  const ca = teamColor(g.away.team), ch = teamColor(g.home.team);
  const side = (s) => `<div class="hero-team ${g.played && s !== w ? "lost" : ""}">${badge(s.team, true)}
      <div class="n">${rk(s.rank_at_game)}${tLink(s.team, s.team_key)}</div><div class="u">${esc(coach(s) || "CPU")}${teamRec(s.team_key) ? " · " + esc(teamRec(s.team_key)) : ""}</div></div>`;
  const wl = g.away === w ? ["22%", "78%"] : ["78%", "22%"];
  const bg = {
    split: `<div class="bg"></div><div class="wm a">${esc(initials(g.away.team))}</div><div class="wm h">${esc(initials(g.home.team))}</div>`,
    field: `<div class="bg"></div><div class="ez a"><span>${esc(g.away.team)}</span></div><div class="ez h"><span>${esc(g.home.team)}</span></div>`,
    spot: `<div class="bg"></div><div class="grain"></div>`,
  }[v];
  const style = `--ca:${ca};--ch:${ch};--cx:${teamAccent(w.team)};--cw:${teamColor(w.team)};--cl:${teamColor((g.away === w ? g.home : g.away).team)};--wx:${wl[0]};--lx:${wl[1]}`;
  setTimeout(() => heroEnrich(g), 0);
  return `<section class="card hero v-${v}" id="hero" style="${style}">${bg}<div class="sweep"></div>
    <div class="hero-tag">${g.kind === "user_vs_user" ? "Game of the Week" : "Top result"}</div>
    <div class="hero-body">${side(g.away)}
      <div><div class="hero-score"><span class="${g.away === w ? "" : "l"}">${g.away.score}</span><span class="${g.home === w ? "" : "l"}">${g.home.score}</span></div><span class="f">Final · <a class="tl" href="#game/${g.key}" style="text-decoration:underline">Box score</a></span></div>
      ${side(g.home)}</div>
    <div id="hero-badges">${heroBadges(g, h, null)}</div>
    <h1 class="hero-line">${h.upset ? '<span class="flag">UPSET</span>' : ""}${h.html}</h1>
    <div id="hero-extra"></div>
  </section>`;
}

// Adds the line score, players of the game, OT badge and (for Spotlight) a stadium photo if one exists.
async function heroEnrich(g) {
  const el = document.getElementById("hero"); if (!el) return;
  if (g.has_box_score) {
    const full = await loadGame(g).catch(() => null);
    const b = full?.box_score;
    if (b && document.getElementById("hero")) {
      document.getElementById("hero-extra").innerHTML = heroExtra(g, b);
      document.getElementById("hero-badges").innerHTML = heroBadges(g, headline(g), b);
    }
  }
  if (el.classList.contains("v-spot")) {
    const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const src = `img/stadiums/${slug(g.home.team)}.jpg`;
    const img = new Image();
    img.onload = () => { const bg = el.querySelector(".bg"); if (bg) { bg.style.backgroundImage = `url("${src}")`; el.classList.add("has-photo"); } };
    img.src = src;
  }
}
