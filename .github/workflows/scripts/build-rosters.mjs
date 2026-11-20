// Builds data/rosters-all.json: every player on every FBS roster (League Pro /rosters?scope=all)
// with the columns from the in-game Roster tab, in a compact column layout for the site's
// Stats → All players table. Skips when the period and data version haven't changed.
//
// Env: DYNASTY_API_KEY (required), DYNASTY_API_BASE (optional), FORCE (optional)

import { readFile, writeFile } from "node:fs/promises";

const BASE = (process.env.DYNASTY_API_BASE || "https://dynasty.prestonchoate.dev/v1").replace(/\/$/, "");
const KEY = process.env.DYNASTY_API_KEY;
const OUT = "data/rosters-all.json";
if (!KEY) { console.error("DYNASTY_API_KEY is not set"); process.exit(1); }

async function api(path, tries = 5) {
  for (let i = 1; ; i++) {
    let r;
    try { r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${KEY}` } }); }
    catch (err) { if (i >= tries) throw err; await new Promise((res) => setTimeout(res, 5000 * i)); continue; }
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) { await new Promise((res) => setTimeout(res, (Number(r.headers.get("retry-after")) || 5 * i) * 1000)); continue; }
    throw new Error(`${path} → ${r.status} ${await r.text()}`);
  }
}

// API rating key → in-game abbreviation, in the game's usual column order
const RATINGS = [
  ["speed", "SPD"], ["acceleration", "ACC"], ["agility", "AGI"], ["changeOfDirection", "COD"], ["strength", "STR"], ["awareness", "AWR"],
  ["carrying", "CAR"], ["ballCarrierVision", "BCV"], ["breakTackle", "BTK"], ["trucking", "TRK"], ["stiffArm", "SFA"], ["spinMove", "SPM"], ["jukeMove", "JKM"],
  ["catching", "CTH"], ["catchInTraffic", "CIT"], ["spectacularCatch", "SPC"], ["routeRunningShort", "SRR"], ["routeRunningMed", "MRR"], ["routeRunningDeep", "DRR"], ["release", "RLS"], ["jumping", "JMP"],
  ["throwPower", "THP"], ["throwAccuracyShort", "SAC"], ["throwAccuracyMid", "MAC"], ["throwAccuracyDeep", "DAC"], ["throwOnTheRun", "RUN"], ["throwUnderPressure", "TUP"], ["breakSack", "BSK"], ["playAction", "PAC"],
  ["passBlock", "PBK"], ["passBlockPower", "PBP"], ["passBlockFinesse", "PBF"], ["runBlock", "RBK"], ["runBlockPower", "RBP"], ["runBlockFinesse", "RBF"], ["leadBlock", "LBK"], ["impactBlocking", "IBL"],
  ["tackle", "TAK"], ["hitPower", "POW"], ["powerMoves", "PMV"], ["finesseMoves", "FMV"], ["blockShedding", "BSH"], ["pursuit", "PUR"], ["playRecognition", "PRC"],
  ["manCoverage", "MCV"], ["zoneCoverage", "ZCV"], ["press", "PRS"], ["kickReturn", "RET"], ["kickPower", "KPW"], ["kickAccuracy", "KAC"],
  ["stamina", "STA"], ["toughness", "TGH"], ["injury", "INJ"],
];

const league = (await api("/league")).data;
const cur = league.current_period;
let prev = null; try { prev = JSON.parse(await readFile(OUT, "utf8")); } catch {}

const res = await api("/rosters?scope=all");
if (prev && prev.period === cur.id && prev.data_version === res.data_version && !process.env.FORCE) { console.log("Rosters up to date."); process.exit(0); }

const extra = [...new Set(res.data.flatMap((p) => Object.keys(p.ratings || {})))].filter((k) => !RATINGS.some(([a]) => a === k));
const cols = [...RATINGS, ...extra.map((k) => [k, k.slice(0, 3).toUpperCase()])];
const rows = res.data.map((p) => [
  p.player_key, p.team_key, p.first_name || "", p.last_name || p.name || "", p.jersey ?? null, p.position || "", p.archetype || "", p.overall ?? null,
  p.class_year || "", p.redshirted ? 1 : 0, p.dev_trait || "", p.height ?? null, p.weight ?? null, p.hometown || "", p.nil_compensation ?? null,
  p.injured ? 1 : 0, (p.abilities || []).map((a) => `${a.name}${a.tier ? ":" + a.tier : ""}`).join("|"),
  cols.map(([k]) => p.ratings?.[k] ?? null),
]);
const out = {
  season: cur.season, period: cur.id, season_text: cur.season_text, data_version: res.data_version, generated_at: new Date().toISOString(),
  fields: ["key", "team", "first", "last", "jersey", "pos", "arch", "ovr", "class", "rs", "dev", "ht", "wt", "home", "nil", "inj", "abil", "r"],
  ratings: cols.map(([k, ab]) => [ab, k]), players: rows,
};
await writeFile(OUT, JSON.stringify(out));
console.log(`Rosters: ${rows.length} players, ${cols.length} ratings → ${OUT}`);
