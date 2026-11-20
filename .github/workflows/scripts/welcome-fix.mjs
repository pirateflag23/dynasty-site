// One-off: give the bot posting rights in #welcome, then welcome anyone who joined in the last 48h and never got one.
import { readFile } from "node:fs/promises";
const cfg = JSON.parse(await readFile("discord.config.json", "utf8"));
const T = process.env.DISCORD_BOT_TOKEN, G = cfg.guild_id, API = "https://discord.com/api/v10";
const dc = async (m, p, b) => { for (;;) { const r = await fetch(API + p, { method: m, headers: { Authorization: `Bot ${T}`, "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500)); continue; } const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} ${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : null; } };
const me = await dc("GET", "/users/@me");
const chans = await dc("GET", `/guilds/${G}/channels`), roles = await dc("GET", `/guilds/${G}/roles`);
const w = chans.find((c) => c.type === 0 && c.name === "welcome"), coach = roles.find((r) => r.name.toLowerCase() === "coach");
console.log("welcome overwrites:", JSON.stringify(w.permission_overwrites.map((o) => ({ who: o.id === G ? "@everyone" : o.id === me.id ? "BOT" : roles.find((r) => r.id === o.id)?.name || o.id, allow: o.allow, deny: o.deny }))));
const ALLOW = (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 17n); // view, send, embed, attach, history, mention
try { await dc("PUT", `/channels/${w.id}/permissions/${me.id}`, { type: 1, allow: String(ALLOW), deny: "0" }); console.log("bot can now post in #welcome"); }
catch (e) { console.log("COULD NOT set #welcome permission:", e.message); }
const msgs = await dc("GET", `/channels/${w.id}/messages?limit=100`);
const welcomed = new Set(msgs.flatMap((m) => (m.mentions || []).map((u) => u.id)));
let members = [], after = "0"; for (;;) { const pg = await dc("GET", `/guilds/${G}/members?limit=1000&after=${after}`); members.push(...pg); if (pg.length < 1000) break; after = pg.at(-1).user.id; }
const recent = members.filter((m) => !m.user.bot && !m.pending && Date.now() - Date.parse(m.joined_at) < 48 * 3600e3 && !welcomed.has(m.user.id));
const name = (m) => m.nick || m.user.global_name || m.user.username;
const avatar = (u) => (u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256` : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`);
for (const m of recent) {
  try {
    if (coach && !m.roles.includes(coach.id)) await dc("PUT", `/guilds/${G}/members/${m.user.id}/roles/${coach.id}`);
    await dc("POST", `/channels/${w.id}/messages`, { content: `<@${m.user.id}>`, allowed_mentions: { users: [m.user.id] }, embeds: [{ color: 0xcc0000, title: `Welcome to TheDynasty, ${name(m)}!`, url: "https://thedynastycfb.com", thumbnail: { url: avatar(m.user) },
      description: "Glad to have you in the league.\n\n🌐 Standings, stats and recruiting: [thedynastycfb.com](https://thedynastycfb.com)", image: { url: "https://thedynastycfb.com/welcome.gif?v=2" } }] });
    console.log(`welcomed ${name(m)} (joined ${m.joined_at})`);
  } catch (e) { console.log(`FAILED ${name(m)}: ${e.message}`); }
}
console.log(`done: ${recent.length} late welcome(s)`);
