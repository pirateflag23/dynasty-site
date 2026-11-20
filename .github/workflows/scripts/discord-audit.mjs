// Read-only: what can a member with only @everyone + the Coach role do in each channel?
import { readFile } from "node:fs/promises";
const cfg = JSON.parse(await readFile("discord.config.json", "utf8"));
const T = process.env.DISCORD_BOT_TOKEN, G = cfg.guild_id;
const dc = async (p) => { const r = await fetch(`https://discord.com/api/v10${p}`, { headers: { Authorization: `Bot ${T}` } }); if (!r.ok) throw new Error(`${p} ${r.status}`); return r.json(); };
const [roles, chans] = await Promise.all([dc(`/guilds/${G}/roles`), dc(`/guilds/${G}/channels`)]);
const ev = roles.find((r) => r.id === G), coach = roles.find((r) => r.name.toLowerCase() === "coach");
console.log(`Coach role: ${coach ? coach.id : "NOT FOUND"}`);
const B = (n) => 1n << BigInt(n);
const P = { ADMIN: B(3), VIEW: B(10), SEND: B(11), HIST: B(16), REACT: B(6), THREAD_PUB: B(35), THREAD_PRIV: B(36), SEND_THREAD: B(38) };
let base = BigInt(ev.permissions) | (coach ? BigInt(coach.permissions) : 0n);
console.log(`Server-level: admin=${!!(base & P.ADMIN)} view=${!!(base & P.VIEW)} send=${!!(base & P.SEND)} react=${!!(base & P.REACT)}`);
const ow = (c) => {
  let p = base; const o = c.permission_overwrites || [];
  const e = o.find((x) => x.id === G); if (e) p = (p & ~BigInt(e.deny)) | BigInt(e.allow);
  const k = coach && o.find((x) => x.id === coach.id); if (k) p = (p & ~BigInt(k.deny)) | BigInt(k.allow);
  return p;
};
const cats = new Map(chans.filter((c) => c.type === 4).map((c) => [c.id, c]));
const rows = chans.filter((c) => c.type !== 4).sort((a, b) => ((cats.get(a.parent_id)?.position ?? -1) - (cats.get(b.parent_id)?.position ?? -1)) || a.position - b.position);
let cur = null;
for (const c of rows) {
  const cat = cats.get(c.parent_id)?.name || "(no category)";
  if (cat !== cur) { console.log(`\n== ${cat}`); cur = cat; }
  const p = ow(c), adm = !!(base & P.ADMIN), has = (f) => adm || !!(p & f);
  const view = has(P.VIEW);
  const f = view ? [has(P.SEND) ? "SEND" : "no-send", has(P.REACT) ? "react" : "no-react", has(P.HIST) ? "history" : "no-history", (has(P.THREAD_PUB) || has(P.SEND_THREAD)) ? "threads" : ""].filter(Boolean).join(" ") : "hidden";
  console.log(`#${c.name} [${c.type}]: ${f}`);
}
