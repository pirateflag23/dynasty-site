// TD Wire, AI desk: rewrites the week's fact-based stories (from build-stories.mjs) in beat-writer voice.
// The facts (scores, stats, rankings, who committed where) stay true; the color around them (sources,
// visits, reactions, rumors, quotes) is invented, the way a beat writer would frame it.
//
// Runs after build-stories.mjs. Needs ANTHROPIC_API_KEY; without it (or on any error) the template
// stories are left as they are. Only new or changed stories are sent; the rest come from ai-cache.json.
import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.WRITER_MODEL || "claude-sonnet-5-5";
const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
const log = (...a) => console.log("[ai-writer]", ...a);
const readJson = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return d; } };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

const cfg = await readJson("discord.config.json", {});
const REPORTERS = cfg.reporters || [
  { id: "cole", name: "Cole Rutledge", site: "Sharp, opinionated columnist. Direct and professional on the page, but he has takes and isn't afraid to call out a coach." },
  { id: "pete", name: "Pete Garrison", site: "Plugged-in national insider. Measured, warm, well-sourced. Breaks recruiting and coaching-carousel news." },
];

async function claude(system, user, maxTokens = 12000) {
  for (let i = 1; ; i++) {
    const r = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (r.ok) { const j = await r.json(); return j.content.filter((c) => c.type === "text").map((c) => c.text).join(""); }
    if ((r.status === 429 || r.status >= 500) && i < 4) { await new Promise((s) => setTimeout(s, 4000 * i)); continue; }
    throw new Error(`Claude API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
}
const parseJson = (t) => { const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error("no JSON in reply"); return JSON.parse(m[0]); };

// Link tokens like [[t:123|Ohio State]] must survive exactly; drop any the model invented.
const tokensIn = (s) => new Set([...String(s || "").matchAll(/\[\[\w:[^|\]]*\|[^\]]*\]\]/g)].map((m) => m[0]));
function cleanTokens(s, allowed) {
  return String(s || "").replace(/\[\[(\w):([^|\]]*)\|([^\]]*)\]\]/g, (m, t, k, n) => (allowed.has(m) ? m : n)).trim();
}

const SYSTEM = `You are the writing staff of TD Wire, the news desk for "The Dynasty", a 32-coach online College Football 27 dynasty league run on Discord. Each coach is a real league member (known by gamertag) running one school; every other team is CPU-controlled. Players and recruits are game-generated.

Your job: rewrite each story from the fact sheet the way real college football beat writers and insiders write: headlines with bite, ledes that tell you why it matters, and the color around the facts: "sources say", "per a source close to the program", visits that went well or badly, a recruit's family loving a campus, a player not caring for a coach's postgame comments, a breakout star getting phone calls from bigger programs, a hot coach at a small school drawing job rumors that make a recruit nervous, a coach benching a guy over attitude, locker-room tension after a blowout, a fan base getting restless.

How it should read:
- Lead with the human angle, not the box score. Numbers only when the number IS the story (five picks, a 59-point game). Never cite recruiting influence points or point gaps; turn them into who's leading, closing, slipping or out of it ("Texas reportedly had him on campus this week and it went very well", "Georgia's staff is starting to sweat").
- Nearly every story should carry at least one piece of invented reporting: a visit, a phone call, a source, a sideline moment, a postgame comment that rubbed someone the wrong way, a booster getting antsy, rival staffs circling a player. Most stories should be "rumor": true.
- Give most stories a quote. Mix who says it: players, recruits, a recruit's parent or high school coach, rival staffers, "a source close to the program", league coaches (by the name given).
- Connect stories when you can: a coach's hot streak drawing job rumors that spook a recruit, a blowout loss turning into portal chatter, a feud carrying over from last week.
- Write like ESPN/The Athletic/247Sports beat coverage, with a little attitude. Not every story needs drama, but the feed as a whole should feel alive.

Rules:
- FACTS STAY TRUE. Scores, stats, records, rankings, influence numbers, commitments, transfers and who-beat-who come only from the fact sheet. Never change them, and never add a new number (scores by quarter, stats, rankings, dollar figures) that isn't in the fact sheet. You can drop numbers that don't help the story.
- COLOR IS INVENTED. Reasons, reactions, rumors, sources, visits and quotes can be made up, and they don't have to be accurate. Keep them plausible for college football and consistent with the facts. Mark a story "rumor": true when it leans on invented reporting (rumors, unnamed sources, speculated motives).
- Don't repeat the same angle or phrase across stories. Vary the structure: some straight news, some analysis, some gossip. Avoid stock filler like "neck and neck" and "it remains to be seen".
- League coaches (gamertags) are fair game for football drama: hot seat, job rumors, play-calling, recruiting misses, feuds with players or rivals, ribbing after losses. Keep it inside the world of the league: no real-life personal matters (health, family, crimes, sexual content) and no slurs.
- Link tokens like [[t:KEY|Name]], [[p:KEY|Name]], [[r:KEY|Name]], [[c:KEY|Name]], [[g:KEY|Text]] make names clickable on the site. Use them for names when you mention those people/teams, copying tokens EXACTLY from the fact sheet. Never invent a token; write plain text for anyone without one.
- Headline: max ~14 words. Dek ("d"): 1-3 sentences, max ~60 words. Quotes: short, natural, attributed (a player, recruit, "a source close to the program", or a coach's name as given).
- Each story gets a byline from the staff below. On the site the writing stays direct and professional (no slang or insults), even when the take is sharp.

Staff:
${REPORTERS.map((r) => `- ${r.name}: ${r.site}`).join("\n")}

Reply with ONLY a JSON object, no prose:
{"stories":[{"id":"<id from the sheet>","kick":"<2-3 word kicker>","h":"<headline>","d":"<dek>","quote":{"text":"...","by":"..."} or null,"by":"<staff name>","rumor":true|false}],
 "storylines":["<one line per running storyline worth following up next week, max 8>"]}`;

async function main() {
  // build-stories writes data/stories/<league_id>/latest.json
  const { readdir } = await import("node:fs/promises");
  const lids = (await readdir("data/stories", { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const lid of lids) {
    const DIR = `data/stories/${lid}`;
    const latest = await readJson(`${DIR}/latest.json`);
    if (!latest?.period) continue;
    const cache = await readJson(`${DIR}/ai-cache.json`, {});
    const memory = await readJson(`${DIR}/storylines.json`, { weeks: [] });
    // What league coaches told Cole and Pete in Discord (kept by the odl-dispatch Worker).
    let quotes = { quotes: [] };
    try { const r = await fetch("https://odl-dispatch.jw1388954.workers.dev/quotes"); if (r.ok) quotes = { quotes: (await r.json()).map((q) => ({ coach: q.coach, text: q.text })) }; } catch { /* none */ }
    const cats = ["games", "recruiting", "portal"];
    // if a story was already rewritten (build-stories skipped this sync), go back to its template facts
    const base = (s) => (s.facts ? { ...s, h: s.facts.h, d: s.facts.d, quote: s.facts.quote ?? null, kick: s.facts.kick ?? s.kick } : s);
    for (const c of cats) latest[c] = (latest[c] || []).map(base);
    const all = cats.flatMap((c) => latest[c].map((s) => ({ ...s, _cat: c })));
    const PROMPT_V = 2; // bump to rewrite every story with a new prompt
    const src = (s) => hash(JSON.stringify([PROMPT_V, s.h, s.d, s.quote?.text]));
    const todo = KEY ? all.filter((s) => cache[s.id]?.src !== src(s)).slice(0, 90) : [];
    log(`${all.length} stories, ${todo.length} need writing${KEY ? "" : " (no ANTHROPIC_API_KEY: templates stay)"}`);

    for (let at = 0; at < todo.length; at += 30) {
      const batch = todo.slice(at, at + 30);
      const coaches = Object.entries(cfg.coaches || {}).map(([team, who]) => `${team}: ${/^\d+$/.test(who) ? "league coach" : who}`).join("; ");
      const sheet = batch.map((s) => ({ id: s.id, section: s._cat, kicker: s.kick, facts_headline: s.h, facts: s.d, template_quote: s.quote?.text || null, league_team: !!s.user }));
      const user = `League: The Dynasty · ${latest.period.season_text} (season ${latest.period.season}).
League coaches by team: ${coaches || "see stories"}.
Running storylines from earlier weeks (follow up where the facts fit, don't force it):
${memory.weeks.slice(-3).flatMap((w) => w.lines.map((l) => `- [${w.label}] ${l}`)).join("\n") || "- none yet"}
${quotes.quotes.length ? `Things league coaches actually said to reporters recently (you may quote these verbatim, attributed):\n${quotes.quotes.slice(-12).map((q) => `- ${q.coach}: "${q.text}"`).join("\n")}` : ""}

Fact sheet (${sheet.length} stories):
${JSON.stringify(sheet, null, 1)}`;
      try {
        const out = parseJson(await claude(SYSTEM, user));
        const byId = new Map(batch.map((s) => [s.id, s]));
        let n = 0;
        for (const w of out.stories || []) {
          const s = byId.get(w.id); if (!s || !w.h) continue;
          const allowed = new Set([...tokensIn(s.h), ...tokensIn(s.d), ...all.flatMap((x) => [...tokensIn(x.h), ...tokensIn(x.d)])]);
          cache[s.id] = { src: src(s), kick: String(w.kick || s.kick).slice(0, 24), h: cleanTokens(w.h, allowed), d: cleanTokens(w.d, allowed),
            quote: w.quote?.text ? { text: String(w.quote.text).slice(0, 220), by: String(w.quote.by || "").slice(0, 60) } : null,
            by: REPORTERS.some((r) => r.name === w.by) ? w.by : REPORTERS[n % REPORTERS.length].name, rumor: !!w.rumor, at: latest.period.id };
          n++;
        }
        if (out.storylines?.length && at === 0) {
          const label = latest.period.season_text;
          memory.weeks = [...memory.weeks.filter((w) => w.label !== label), { label, lines: out.storylines.slice(0, 8).map(String) }].slice(-6);
          await writeFile(`${DIR}/storylines.json`, JSON.stringify(memory, null, 1));
        }
        log(`wrote ${n} stories with ${MODEL}`);
      } catch (e) { log("writing failed, keeping templates for new stories:", e.message); }
    }

    // apply the AI versions to every story we have one for (unchanged facts → cached copy)
    let applied = 0;
    for (const c of cats) latest[c] = (latest[c] || []).map((s) => {
      const a = cache[s.id];
      if (!a || a.src !== src(s)) return s;
      applied++;
      return { ...s, kick: a.kick, h: a.h, d: a.d, quote: a.quote || s.quote, by: a.by, rumor: a.rumor, facts: { h: s.h, d: s.d, quote: s.quote ?? null, kick: s.kick } };
    });
    // keep the cache from growing forever: last 3 periods
    const keepIds = new Set(Object.values(cache).map((v) => v.at).filter(Boolean).sort((a, b) => b - a).filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3));
    for (const [k, v] of Object.entries(cache)) if (v.at && !keepIds.has(v.at)) delete cache[k];
    await writeFile(`${DIR}/ai-cache.json`, JSON.stringify(cache));
    await writeFile(`${DIR}/latest.json`, JSON.stringify(latest));
    await writeFile(`${DIR}/p${latest.period.id}.json`, JSON.stringify(latest));
    log(`league ${lid}: ${applied} stories in TD Wire voice`);
  }
}
main().catch((e) => { console.error("[ai-writer] failed (site keeps template stories):", e.message); process.exit(0); });
