// News archive: every TD Wire story that has ever appeared, kept after it rotates off the home page.
// Runs after the AI desk each sync. Reads data/stories/<league>/latest.json (and, the first time, every
// p<period>.json snapshot) and merges into data/stories/<league>/news-<season>.json:
//   { season, updated, stories: [{ id, cat, kind, kick, h, d, quote, by, rumor, team, teams, user, game, link,
//                                  period, season_text, first_seen, last_seen }] }
// A story keeps its id while its headline stays the same; if the same storyline comes back in a later
// period with a new headline (portal watch, recruiting battles), it is saved as a separate article.
import { readFile, writeFile, readdir } from "node:fs/promises";

const ROOT = "data/stories";
const readJson = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
const teamsIn = (...txt) => [...new Set(txt.filter(Boolean).flatMap((t) => [...String(t).matchAll(/\[\[t:(\d+)\|/g)].map((m) => +m[1])))];

// carousel:<gamertag>:<pending|move|…>:<team>[:period] → "<gamertag>:<team>"
const carouselKey = (s) => { if (s.kind !== "carousel") return null; const p = String(s.id || "").split(":"); return p[0] === "carousel" && p[1] && p[3] ? `${p[1]}:${p[3]}` : null; };

// Flatten one latest.json / p<period>.json into article rows.
function articles(snap) {
  const per = snap.period || {}, out = [];
  const push = (s, extra = {}) => {
    if (!s?.h) return;
    const teams = [...new Set([s.team, s.team2, ...teamsIn(s.h, s.d), ...(extra.teams || [])].filter((k) => Number.isFinite(+k) && +k > 0).map(Number))];
    out.push({ id: s.id, cat: s.cat || extra.cat || "news", kind: s.kind || extra.kind || "", kick: s.kick || extra.kick || "", h: s.h, d: s.d || "",
      quote: s.quote || undefined, by: s.by || undefined, rumor: s.rumor || undefined, team: s.team ?? teams[0] ?? null, teams, user: !!s.user,
      game: s.game || undefined, recruit: s.recruit || undefined, player: s.player || undefined, link: extra.link,
      period: per.id, season_text: per.season_text || "", week: snap.week, at: snap.generated_at });
  };
  for (const s of snap.games || []) push(s, { cat: "game" });
  for (const s of snap.recruiting || []) push(s, { cat: "recruiting" });
  for (const s of snap.portal || []) push(s, { cat: "portal" });
  // offseason features (NIL raises, breakout watch …): one article per feature per period
  const off = snap.offseason;
  if (off && typeof off === "object") for (const [k, f] of Object.entries(off)) {
    if (!f?.h) continue;
    push({ ...f, id: `feature:${k}:${per.id}`, kick: f.kick || "Feature", user: (f.list || []).some((x) => x.user) },
      { cat: "feature", kind: k, link: `#feature/${k}`, teams: (f.list || []).map((x) => x.team) });
  }
  return out;
}

async function archiveLeague(lid) {
  const dir = `${ROOT}/${lid}`;
  const latest = await readJson(`${dir}/latest.json`);
  if (!latest?.period) return;
  const files = await readdir(dir).catch(() => []);
  const bySeason = new Map();
  const load = async (season) => {
    if (!bySeason.has(season)) bySeason.set(season, await readJson(`${dir}/news-${season}.json`, { season, stories: [] }));
    return bySeason.get(season);
  };
  // first run (no archive yet): backfill from every saved period snapshot, oldest first
  const snaps = [];
  if (!files.some((f) => /^news-\d{4}\.json$/.test(f))) {
    const ps = files.map((f) => /^p(\d+)\.json$/.exec(f)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);
    for (const id of ps) { const s = await readJson(`${dir}/p${id}.json`); if (s?.period) snaps.push(s); }
  }
  snaps.push(latest);

  let added = 0;
  for (const snap of snaps) {
    const season = snap.period.season;
    if (!season) continue;
    const arc = await load(season);
    const idx = new Map(arc.stories.map((s, i) => [s.uid, i]));
    for (const a of articles(snap)) {
      // same storyline + same headline = same article (refresh it); new headline in a new period = new article
      // Coaching moves are one event: one article per coach + destination (pending → official, and later
      // rewrites of the headline, update that article instead of adding another).
      const ck = carouselKey(a);
      if (ck) {
        const prev = arc.stories.find((s) => carouselKey(s) === ck);
        if (prev) { Object.assign(prev, { ...a, uid: prev.uid, first_seen: prev.first_seen, first_period: prev.first_period, last_seen: a.at }); continue; }
      }
      const sameId = arc.stories.filter((s) => s.id === a.id);
      const hit = sameId.find((s) => s.h === a.h) || sameId.find((s) => s.period === a.period);
      if (hit) {
        Object.assign(hit, { ...a, uid: hit.uid, first_seen: hit.first_seen, first_period: hit.first_period, last_seen: a.at });
      } else {
        const uid = sameId.length ? `${a.id}@${a.period}` : a.id;
        if (idx.has(uid)) continue;
        arc.stories.push({ ...a, uid, first_seen: a.at, first_period: a.period, last_seen: a.at });
        idx.set(uid, arc.stories.length - 1); added++;
      }
    }
  }
  // beat writer columns (beat-writers.mjs): one row each, linking to the full article page
  const beatSeasons = files.map((f) => /^beat-(\d{4})\.json$/.exec(f)?.[1]).filter(Boolean).map(Number);
  for (const season of beatSeasons) {
    const beat = await readJson(`${dir}/beat-${season}.json`, { articles: [] });
    const arc = await load(season);
    for (const b of beat.articles || []) {
      const uid = `beat:${b.id}`;
      const row = { id: uid, uid, cat: "beat", kind: b.kind, kick: b.kick || "Beat", h: b.h, d: b.dek || "", by: `${b.by} · ${b.outlet}`, team: b.team, teams: [b.team], user: true,
        game: b.game || undefined, link: `#beat/${b.id}`, period: b.period, season_text: b.season_text, week: b.week, at: b.at, first_seen: b.at, first_period: b.period, last_seen: b.at };
      const hit = arc.stories.find((s) => s.uid === uid);
      if (hit) Object.assign(hit, row); else { arc.stories.push(row); added++; }
    }
  }
  for (const [season, arc] of bySeason) {
    arc.stories.sort((a, b) => String(b.first_seen).localeCompare(String(a.first_seen)));
    arc.updated = new Date().toISOString();
    await writeFile(`${dir}/news-${season}.json`, JSON.stringify(arc));
  }
  // small index so the site knows which seasons have an archive
  const seasons = (await readdir(dir)).map((f) => /^news-(\d{4})\.json$/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a, b) => b - a);
  await writeFile(`${dir}/news-index.json`, JSON.stringify({ seasons, updated: new Date().toISOString() }));
  console.log(`News archive (${lid}): +${added} new, seasons ${seasons.join(", ")}`);
}

const leagues = (await readdir(ROOT).catch(() => [])).filter((d) => /^\d+$/.test(d));
for (const lid of leagues) await archiveLeague(lid).catch((e) => console.error(`News archive ${lid} failed: ${e.message}`));
