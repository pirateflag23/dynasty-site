// National Signing Day: posts the cards queued by discord-feed.mjs (data/nsd/queue.json) when each one's time comes.
// Runs on the 2-minute cron. Posted ids live in KV so nothing goes out twice.
const RAW = "https://raw.githubusercontent.com/pirateflag23/dynasty-site/main/data/nsd/queue.json";
const GOLD = 0xf2b134;

export async function runNSD(env, now = Date.now()) {
  if (!env.DISCORD_BOT_TOKEN || !env.GREETER) return { ok: false, why: "needs DISCORD_BOT_TOKEN and KV" };
  const r = await fetch(`${RAW}?t=${Math.floor(now / 60e3)}`);
  if (!r.ok) return { ok: true, queue: false };
  const q = await r.json();
  if (q.test || !q.channel_id || !q.items?.length) return { ok: true, idle: true };
  const end = Date.parse(q.end);
  if (now > end + 6 * 3600e3) return { ok: true, done: true };
  const key = `nsd:${q.league_id}:${q.season}`;
  const posted = new Set((await env.GREETER.get(key, "json")) || []);
  const due = q.items.filter((it) => !posted.has(it.id) && Date.parse(it.at) <= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(0, 4);
  const out = [];
  for (const it of due) {
    const body = { embeds: [{ title: it.title, color: GOLD, ...(it.image ? { image: { url: it.image } } : {}) }], allowed_mentions: { parse: [] } };
    const res = await fetch(`https://discord.com/api/v10/channels/${q.channel_id}/messages`, { method: "POST", headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok && res.status !== 400) { out.push(`${it.id}: ${res.status}`); break; } // retry next tick
    posted.add(it.id); out.push(it.id);
  }
  if (due.length) await env.GREETER.put(key, JSON.stringify([...posted]), { expirationTtl: 30 * 86400 });
  return { ok: true, posted: out, left: q.items.length - posted.size };
}
