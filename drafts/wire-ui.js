/* =========================================================
   TD WIRE: storylines written by the GitHub Action (build-stories.mjs)
   data/stories/<league_id>/latest.json → Around the League + recruiting news
   ========================================================= */
const WIRE_BASE = "https://pirateflag23.github.io/dynasty-site/data/stories";
const WIRE_CSS = `
.wire-q{margin:8px 0 0;padding:6px 0 6px 12px;border-left:3px solid var(--red);font-style:italic;color:var(--ink);font-size:13px;line-height:1.45}
.wire-q cite{display:block;font-style:normal;font-size:11px;color:var(--dim);margin-top:3px}
.story-card h3 a,.news .t a,.story h1 a,.wire-b h3 a{color:inherit;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px;text-decoration-color:color-mix(in srgb,currentColor 35%,transparent)}
.wire-b{padding:10px 14px;border-top:1px solid var(--line-2)}.wire-b:first-of-type{border-top:0}
.wire-b h3{margin:0 0 4px;font:800 15px/1.25 var(--head)}.wire-b p{margin:0;font-size:13px;color:var(--dim);line-height:1.45}
.wire-b .kick{font:800 11px/1 var(--head);color:var(--red);font-style:italic;margin-bottom:4px}
.wire-tag{font:700 10px var(--head);color:var(--dim);letter-spacing:.4px;text-transform:uppercase;padding:8px 14px 0}
`;
let WIRE = null, wireP = null;
const wireLoad = () => (wireP ??= (() => { const lid = D.league?.league_id ?? D.league?.data?.league_id; return lid ? fetch(`${WIRE_BASE}/${lid}/latest.json`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).then((w) => (WIRE = w)).catch(() => null) : Promise.resolve(null); })());
// Turns [[t:key|Name]] style tokens into site links; everything else is escaped.
function wireHtml(s) {
  if (!s) return "";
  const href = { t: (k) => `#team/${k}`, r: (k) => `#recruit/${k}`, p: (k) => `#player/${k}`, c: (k) => `#coach/${encodeURIComponent(k)}`, g: (k) => `#game/${k}` };
  let out = "", last = 0;
  for (const m of s.matchAll(/\[\[(\w):([^|\]]*)\|([^\]]*)\]\]/g)) {
    out += esc(s.slice(last, m.index));
    out += href[m[1]] ? `<a class="tl" href="${href[m[1]](m[2])}">${esc(m[3])}</a>` : esc(m[3]);
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}
const wireQuote = (q) => (q?.text ? `<blockquote class="wire-q">“${esc(q.text)}”<cite>${esc(q.by || "")}</cite></blockquote>` : "");
const wireTeamName = (k) => teamByKey(k)?.name || games().map((g) => [g.home, g.away]).flat().find((s) => s.team_key === k)?.team || "";
function wireGameCards(list) {
  const pairKinds = /^(upset|comeback|ot|rivalry|shutout|blowout)$/;
  return list.map((st) => {
    const g = games().find((x) => x.key === st.game);
    const other = g ? (g.home.team_key === st.team ? g.away : g.home).team : "";
    const art = storyArt({ id: st.id, type: st.kind.split(":")[0], team: wireTeamName(st.team), team2: pairKinds.test(st.kind) ? other : "" });
    return `<article class="story-card"><div class="art">${art}</div><div class="txt"><div class="kick">${esc(st.kick)}</div><h3>${wireHtml(st.h)}</h3>${st.d ? `<p>${wireHtml(st.d)}</p>` : ""}${wireQuote(st.quote)}</div></article>`;
  }).join("");
}
const wireRecruit = (e) => WIRE?.recruiting?.find((s) => s.id === `${e.prospect_key}${e.kind}`);
function wireBattlesCard() {
  const b = (WIRE?.recruiting || []).filter((s) => s.kind === "battle").slice(0, 6);
  return b.length ? `<section class="card"><h2 class="card-h">Recruiting battles <small>TD Wire</small></h2>${b.map((s) => `<div class="wire-b"><div class="kick">${esc(s.kick)}</div><h3>${wireHtml(s.h)}</h3><p>${wireHtml(s.d)}</p></div>`).join("")}</section>` : "";
}
// Recruiting news: use the Wire's headline/story when one exists for the event.
const _newsHeadline = newsHeadline, _newsDeck = newsDeck;
newsHeadline = (e) => { const h = _newsHeadline(e), w = wireRecruit(e); return w ? { ...h, html: wireHtml(w.h) } : h; };
newsDeck = (e, r) => { const w = wireRecruit(e); return w ? wireHtml(w.d) + wireQuote(w.quote) : _newsDeck(e, r); };
