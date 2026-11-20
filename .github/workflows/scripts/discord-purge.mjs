// One-off cleanup: deletes every message in the listed channels (by name). Run from the "Discord purge" workflow.
import { readFile } from "node:fs/promises";
const cfg = JSON.parse(await readFile("discord.config.json", "utf8"));
const TOKEN = process.env.DISCORD_BOT_TOKEN, NAMES = (process.env.CHANNELS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function dc(method, path, body) {
  for (;;) {
    const r = await fetch(`https://discord.com/api/v10${path}`, { method, headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await sleep((j.retry_after || 1) * 1000 + 250); continue; }
    if (r.status === 204) return null;
    const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  }
}
const chans = (await dc("GET", `/guilds/${cfg.guild_id}/channels`)).filter((c) => c.type === 0 || c.type === 5);
for (const name of NAMES) {
  const ch = chans.find((c) => c.name.toLowerCase() === name);
  if (!ch) { console.log(`#${name}: not found, skipped`); continue; }
  let n = 0;
  for (;;) {
    const msgs = await dc("GET", `/channels/${ch.id}/messages?limit=100`);
    if (!msgs.length) break;
    const cutoff = Date.now() - 13.5 * 864e5;
    const fresh = msgs.filter((m) => Date.parse(m.timestamp) > cutoff).map((m) => m.id), old = msgs.filter((m) => !fresh.includes(m.id)).map((m) => m.id);
    if (fresh.length >= 2) await dc("POST", `/channels/${ch.id}/messages/bulk-delete`, { messages: fresh });
    else for (const id of fresh) await dc("DELETE", `/channels/${ch.id}/messages/${id}`);
    for (const id of old) await dc("DELETE", `/channels/${ch.id}/messages/${id}`);
    n += msgs.length;
  }
  console.log(`#${name}: deleted ${n}`);
}
