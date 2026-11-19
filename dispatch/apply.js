// League applications: the site's Apply tab POSTs here (odl-dispatch /apply) and TD posts the
// application to #commish-chat so the commish team can review it together.
// Needs the DISCORD_BOT_TOKEN secret (already set for the greeter). Uses the GREETER KV, when bound,
// for a light per-IP rate limit.

const DC = "https://discord.com/api/v10";
const GUILD = "1569397791313232013";
const CHANNEL = "commish-chat";
const ORIGINS = ["https://thedynastycfb.com", "https://www.thedynastycfb.com", "https://pf-07.jw1388954.workers.dev"];
const LIMITS = { discord: 40, why: 1500, tz: 40, teams: 200 };

const cors = (req) => {
  const o = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
};
const reply = (req, status, body) => Response.json(body, { status, headers: cors(req) });

async function dc(env, method, path, body) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(DC + path, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json", "User-Agent": "DiscordBot (https://thedynastycfb.com, 1.0) TD" },
    });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise((s) => setTimeout(s, (j.retry_after || 1) * 1000 + 100)); continue; }
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
  throw new Error(`${method} ${path} rate limited`);
}

const clean = (v, max) => String(v ?? "").replace(/@(everyone|here)/gi, "@​$1").replace(/<@[!&]?\d+>/g, "").trim().slice(0, max);
const yn = (v) => (v === "yes" ? "✅ Yes" : v === "no" ? "❌ No" : null);

export async function postApplication(env, a, { test = false } = {}) {
  const channels = await dc(env, "GET", `/guilds/${GUILD}/channels`);
  const norm = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const text = channels.filter((c) => c.type === 0);
  const ch = text.find((c) => c.name === CHANNEL) || text.find((c) => norm(c.name).includes(norm(CHANNEL)));
  if (!ch) throw new Error(`#${CHANNEL} not found. Text channels TD sees: ${text.map((c) => c.name).join(", ")}`);
  const flags = a.rules === "no" || a.stream === "no";
  await dc(env, "POST", `/channels/${ch.id}/messages`, {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: `${test ? "🧪 TEST — " : ""}New league application: ${a.discord}`,
      color: test ? 0x6c6d6f : flags ? 0xf2b134 : 0xcc0000,
      fields: [
        { name: "Discord name", value: a.discord, inline: true },
        { name: "Time zone", value: a.tz, inline: true },
        { name: "Favorite team(s)", value: a.teams, inline: true },
        { name: "What makes them a good add?", value: a.why.slice(0, 1024) },
        { name: "Read the rules & can follow them", value: yn(a.rules), inline: true },
        { name: "Can stream every game", value: yn(a.stream), inline: true },
      ],
      footer: { text: test ? "Test post — not a real applicant" : flags ? "⚠️ Answered No to a requirement · via thedynastycfb.com/#apply" : "via thedynastycfb.com/#apply" },
      timestamp: new Date().toISOString(),
    }],
  });
  return { ok: true, channel: ch.id };
}

export async function handleApply(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === "GET") return reply(req, 200, { ready: !!env.DISCORD_BOT_TOKEN, channel: CHANNEL, v: 3 });
  if (req.method !== "POST") return reply(req, 405, { error: "POST only" });
  let b;
  try { b = await req.json(); } catch { return reply(req, 400, { error: "Bad request" }); }
  if (b.website) return reply(req, 200, { ok: true }); // honeypot: bots fill the hidden field
  const a = {
    discord: clean(b.discord, LIMITS.discord), why: clean(b.why, LIMITS.why),
    tz: clean(b.tz, LIMITS.tz), teams: clean(b.teams, LIMITS.teams),
    rules: b.rules, stream: b.stream,
  };
  if (!a.discord || !a.why || !a.tz || !a.teams || !yn(a.rules) || !yn(a.stream))
    return reply(req, 400, { error: "Please fill in every field." });
  const test = b.test === true; // only changes the label/colour; still rate-limited
  const ip = req.headers.get("cf-connecting-ip") || "?";
  if (env.GREETER) {
    const k = `apply:${ip}`;
    if (await env.GREETER.get(k)) return reply(req, 429, { error: "Application already received. Give the commish a bit to review it." });
    await env.GREETER.put(k, "1", { expirationTtl: 600 });
  }
  try { await postApplication(env, a, { test }); return reply(req, 200, { ok: true }); }
  catch (e) { console.error("apply", String(e)); return reply(req, 502, { error: "Couldn't send your application. Try again in a minute.", ...(test ? { detail: String(e).slice(0, 1500) } : {}) }); }
}
