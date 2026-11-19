// Registers the ODL slash commands in your server (instant; re-run any time commands change).
// Env: DISCORD_BOT_TOKEN, DISCORD_APP_ID. Server ID comes from discord.config.json.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const cfg = JSON.parse(await readFile("discord.config.json", "utf8"));
const TOKEN = process.env.DISCORD_BOT_TOKEN, APP = process.env.DISCORD_APP_ID || cfg.app_id;
if (!TOKEN || !APP) { console.log("DISCORD_BOT_TOKEN or app_id not set — skipping command registration."); process.exit(0); }

const S = 3, team = (desc = "Team name, e.g. Penn State") => ({ type: S, name: "team", description: desc, required: true });
const choices = (a) => a.map((v) => ({ name: v, value: v }));
const commands = [
  { name: "player", description: "Player card: season stats, ratings, dev trait", options: [
    { type: S, name: "name", description: "Player name, e.g. Gio Lopez or Lopez", required: true },
    { type: S, name: "team", description: "Team, if the name matches several players", required: false }] },
  { name: "team", description: "Team snapshot: record, rank, team stats, leaders", options: [{ ...team(), name: "name" }] },
  { name: "box", description: "Latest box score for a team", options: [team()] },
  { name: "schedule", description: "A team's season schedule and results", options: [team()] },
  { name: "standings", description: "Conference standings", options: [
    { type: S, name: "conference", description: "Leave empty for all four", required: false, choices: choices(["ACC", "Big 12", "Big Ten", "SEC"]) }] },
  { name: "top25", description: "Current Top 25" },
  { name: "leaders", description: "Stat leaders", options: [
    { type: S, name: "category", description: "Stat", required: true, choices: choices(["passing", "rushing", "receiving", "tackles", "sacks", "interceptions"]) },
    { type: S, name: "scope", description: "All FBS (default) or league teams only", required: false, choices: [{ name: "All FBS", value: "all" }, { name: "League teams", value: "league" }] }] },
  { name: "rta", description: "Who's ready to advance and which games are unplayed" },
  { name: "carousel", description: "Commish: log a coaching move the game made (posts the breaking news)", default_member_permissions: "32", options: [
    { type: S, name: "coach", description: "Coach's gamertag or Discord name", required: true },
    { type: S, name: "school", description: "The school he's taking over", required: true },
    { type: S, name: "action", description: "hired (default) or clear a mistaken entry", required: false, choices: [{ name: "Hired", value: "hired" }, { name: "Clear entry", value: "clear" }] }] },
];

// Only call Discord when the command list changed since the last registration.
const hash = createHash("sha256").update(JSON.stringify([APP, cfg.guild_id, commands])).digest("hex");
const prev = await readFile("data/commands-hash.txt", "utf8").catch(() => "");
if (prev.trim() === hash && !process.env.FORCE) { console.log("Slash commands unchanged."); process.exit(0); }
const r = await fetch(`https://discord.com/api/v10/applications/${APP}/guilds/${cfg.guild_id}/commands`, {
  method: "PUT", headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(commands),
});
if (!r.ok) { console.error(r.status, await r.text()); process.exit(1); }
console.log(`Registered ${(await r.json()).length} commands in server ${cfg.guild_id}.`);
await mkdir("data", { recursive: true });
await writeFile("data/commands-hash.txt", hash);
