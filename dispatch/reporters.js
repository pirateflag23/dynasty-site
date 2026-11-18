// TD Wire reporters in Discord: Cole Rutledge and Pete Garrison.
// Runs from the odl-dispatch cron (every 2 minutes). They:
//   • answer when someone replies to them or says their name (anywhere people talk)
//   • now and then jump into an active conversation on their own
//   • after each advance, go find league coaches in their matchup chats / #general about the week's stories
// Coaches' answers are saved (GET /quotes) and the TD Wire AI desk can quote them in next week's stories.
// Activity ramps up as the season goes on. Needs DISCORD_BOT_TOKEN, ANTHROPIC_API_KEY, KV binding GREETER,
// Message Content Intent, and Manage Webhooks for the bot (each reporter posts through a channel webhook).

const DC = "https://discord.com/api/v10";
const RAW = "https://raw.githubusercontent.com/pirateflag23/dynasty-site/main";
const SITE = "https://thedynastycfb.com";
const MODEL = "claude-sonnet-5-5";
const GUILD = "1569397791313232013";
const HOOK_NAME = "TD Wire reporters";

// Defaults; the live names, avatars and voices come from "reporters" in discord.config.json.
let REPORTERS = [
  { id: "cole", name: "Cole Rutledge", avatar: `${SITE}/reporters/cole.png`, call: /\b(cole|rutledge)\b/i,
    voice: "Sarcastic, judgmental hot-take guy with podcast energy. Loose and casual in Discord: short messages, lowercase is fine, dry jokes, rarely an emoji. Rides coaches for losses, bad play-calls, recruiting whiffs and excuses. Has opinions on everything and loves to be right. Mean-funny about football, never about anyone's real life." },
  { id: "pete", name: "Pete Garrison", avatar: `${SITE}/reporters/pete.png`, call: /\b(pete|garrison)\b/i,
    voice: "Warm, plugged-in national insider. Friendly and encouraging, gives people their flowers, but still asks the pointed question. Loves teasing what he's 'hearing' about recruits, coaching jobs and the portal. Casual in Discord, a little old-school, the occasional 🤝." },
];
// Feed channels the bot posts into; reporters stay out of these.
const SKIP = new Set(["welcome", "announcements", "announcement", "annoucement", "top-25", "scores", "final", "headlines", "heisman", "recruiting", "transfer-portal",
  "big-performances", "national-potw", "acc", "big-12", "big-ten", "sec", "schedule", "on-deck", "logos", "join-log", "game-streams", "rules", "potential-members"]);

const kvJ = async (env, k, d = null) => { try { return (await env.GREETER.get(k, "json")) ?? d; } catch { return d; } };
const kvPut = (env, k, v, ttl) => env.GREETER.put(k, JSON.stringify(v), ttl ? { expirationTtl: ttl } : undefined);

async function dc(env, method, path, body) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(DC + path, { method, body: body ? JSON.stringify(body) : undefined,
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json", "User-Agent": "DiscordBot (https://thedynastycfb.com, 1.0) TD" } });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise((s) => setTimeout(s, (j.retry_after || 1) * 1000 + 100)); continue; }
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.status === 204 ? null : r.json();
  }
  throw new Error("rate limited");
}

async function claude(env, system, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: [{ role: "user", content: user }] }) });
  if (!r.ok) throw new Error(`Claude ${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = (await r.json()).content.filter((c) => c.type === "text").map((c) => c.text).join("");
  const m = t.match(/\{[\s\S]*\}/); if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// League context the reporters know about: this week's TD Wire stories, running storylines, who coaches what.
async function leagueContext(env) {
  const cached = await kvJ(env, "rep:ctx");
  if (cached && Date.now() - cached.at < 20 * 60e3) return cached;
  const get = async (u) => { try { const r = await fetch(`${u}?t=${Date.now()}`); return r.ok ? r.json() : null; } catch { return null; } };
  const cfg = (await get(`${RAW}/discord.config.json`)) || {};
  const lg = await get("https://dynasty-proxy.jw1388954.workers.dev/v1/league");
  const lid = lg?.league_id ?? lg?.data?.league_id ?? cfg.league_id ?? 4943020;
  const latest = await get(`${RAW}/data/stories/${lid}/latest.json`);
  const lines = await get(`${RAW}/data/stories/${lid}/storylines.json`);
  const plain = (s) => String(s || "").replace(/\[\[\w:[^|\]]*\|([^\]]*)\]\]/g, "$1");
  const stories = latest ? ["games", "recruiting", "portal"].flatMap((c) => (latest[c] || []).slice(0, 6).map((s) => ({ id: s.id, user: !!s.user, team: s.team, h: plain(s.h), d: plain(s.d) }))) : [];
  const reporters = Array.isArray(cfg.reporters) && cfg.reporters.length ? cfg.reporters.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, voice: r.discord })) : null;
  const ctx = { reporters, at: Date.now(), period: latest?.period?.id || null, week: latest?.period?.season_text || "", stories, storylines: lines?.weeks?.slice(-1)[0]?.lines || [],
    coaches: cfg.coaches || {} };
  await kvPut(env, "rep:ctx", ctx);
  return ctx;
}
const level = (ctx) => { const n = Number(/Wk (\d+)/.exec(ctx.week || "")?.[1] || 1); return Math.max(0.25, Math.min(1, (n - 1) / 12)); };

function system(rep, ctx, mode) {
  return `You are ${rep.name}, a college football reporter character for TD Wire, the news desk of "The Dynasty", an online College Football 27 dynasty league of 32 coaches (real league members, known by their Discord names) on this Discord server. You're an AI character the league added for fun; if someone sincerely asks whether you're a bot, it's fine to say you're the league's AI reporter, then stay in character.

Your personality in Discord: ${rep.voice}
Your colleague: ${REPORTERS.filter((r) => r !== rep).map((r) => `${r.name} (${r.voice.split(".")[0]})`).join("; ")}. You two can needle each other.

What's going on in the league right now (${ctx.week}):
${ctx.stories.slice(0, 14).map((s) => `- ${s.h}: ${s.d}`).join("\n") || "- quiet week"}
Running storylines: ${ctx.storylines.join(" | ") || "none yet"}
League coaches (team: Discord name): ${Object.entries(ctx.coaches).map(([t, c]) => `${t}: ${/^\d+$/.test(c) ? "?" : c}`).join(", ")}

Rules: write like a real person in a Discord chat: 1-3 short sentences, under 280 characters, no hashtags, no signatures. Stick to football and the league; rumors and opinions are fine and don't have to be true, but game results and records in the list above are real, so don't contradict them. Keep it inside the world of the league: no real-life personal matters (health, family, crimes, sexual stuff) and no slurs. To tag a coach write @ followed by their Discord name exactly as listed.
${mode}
Reply with ONLY JSON: {"post": true|false, "text": "..."}`;
}

// Convert "@Name" to a real mention for people in the server.
function mentions(text, members) {
  const ids = [];
  const out = text.replace(/@([\w.]{2,32})/g, (m, n) => {
    const hit = members.find((x) => [x.user.username, x.user.global_name, x.nick].filter(Boolean).some((v) => v.toLowerCase() === n.toLowerCase()));
    if (!hit) return m; ids.push(hit.user.id); return `<@${hit.user.id}>`;
  });
  return { text: out.replace(/@(everyone|here)/g, "$1"), ids: [...new Set(ids)] };
}

async function hookFor(env, channelId) {
  const hooks = await kvJ(env, "rep:hooks", {});
  if (hooks[channelId]) return hooks[channelId];
  let h = (await dc(env, "GET", `/channels/${channelId}/webhooks`)).find((w) => w.name === HOOK_NAME && w.token);
  if (!h) h = await dc(env, "POST", `/channels/${channelId}/webhooks`, { name: HOOK_NAME });
  hooks[channelId] = { id: h.id, token: h.token };
  await kvPut(env, "rep:hooks", hooks);
  return hooks[channelId];
}

async function say(env, rep, channelId, text, members) {
  const { text: body, ids } = mentions(text, members);
  const h = await hookFor(env, channelId);
  const msg = { username: rep.name, avatar_url: rep.avatar, content: body.slice(0, 1900), allowed_mentions: { users: ids } };
  await fetch(`${DC}/webhooks/${h.id}/${h.token}?wait=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(msg) })
    .then(async (r) => { if (!r.ok) throw new Error(`webhook ${r.status} ${(await r.text()).slice(0, 150)}`); });
}

const fmt = (m) => `${m.webhook_id ? m.author.username : m.member?.nick || m.author.global_name || m.author.username}: ${m.content}`.slice(0, 400);

export async function runReporters(env, now = Date.now()) {
  if (!env.DISCORD_BOT_TOKEN || !env.ANTHROPIC_API_KEY || !env.GREETER) return { ok: false, why: "needs DISCORD_BOT_TOKEN, ANTHROPIC_API_KEY and KV" };
  if ((await kvJ(env, "rep:off")) === true) return { ok: true, off: true };
  const ctx = await leagueContext(env);
  if (ctx.reporters) REPORTERS = ctx.reporters.map((r) => ({ ...r, call: new RegExp(`\\b(${r.name.split(/\s+/).map((w) => w.replace(/[^\w]/g, "")).filter(Boolean).join("|")})\\b`, "i") }));
  const lv = level(ctx);
  const day = new Date(now).toISOString().slice(0, 10);
  const counts = await kvJ(env, `rep:day:${day}`, { spont: 0, replies: 0 });
  const hooks = await kvJ(env, "rep:hooks", {});
  const ourHooks = new Set(Object.values(hooks).map((h) => h.id));
  const chans = (await dc(env, "GET", `/guilds/${GUILD}/channels`)).filter((c) => c.type === 0 && !SKIP.has(c.name));
  const last = await kvJ(env, "rep:last", {});
  const fresh = [], convo = {};
  for (const c of chans.slice(0, 20)) {
    if (!c.last_message_id || c.last_message_id === last[c.id]) continue;
    const after = last[c.id];
    last[c.id] = c.last_message_id;
    if (!after) continue; // first time we see this channel: start from now
    const msgs = (await dc(env, "GET", `/channels/${c.id}/messages?limit=25`).catch(() => [])).reverse();
    convo[c.id] = msgs.slice(-15);
    for (const m of msgs) if (BigInt(m.id) > BigInt(after) && !m.author.bot && !m.webhook_id && m.content && now - Date.parse(m.timestamp) < 20 * 60e3) fresh.push({ ...m, _ch: c });
  }
  await kvPut(env, "rep:last", last);
  const members = await dc(env, "GET", `/guilds/${GUILD}/members?limit=1000`).catch(() => []);
  const did = [], errors = [];
  const post = async (rep, chId, text) => { try { await say(env, rep, chId, text, members); return true; } catch (e) { errors.push(String(e.message).slice(0, 200)); return false; } };

  // 1) Replies: someone replied to a reporter or called one by name.
  for (const m of fresh) {
    if (counts.replies >= 40 || did.length >= 3) break;
    let rep = REPORTERS.find((r) => r.call.test(m.content));
    const ref = m.referenced_message;
    if (!rep && ref?.webhook_id && ourHooks.has(ref.webhook_id)) rep = REPORTERS.find((r) => r.name === ref.author.username);
    if (!rep) continue;
    const who = m.member?.nick || m.author.global_name || m.author.username;
    const isCoach = Object.values(ctx.coaches).some((c) => String(c).toLowerCase() === m.author.username.toLowerCase());
    // A coach answering a reporter = an on-the-record quote for next week's stories.
    if (isCoach && m.content.length > 12) {
      const q = await kvJ(env, "rep:quotes", []);
      q.push({ coach: who, handle: m.author.username, text: m.content.slice(0, 240), to: rep.name, at: new Date(now).toISOString() });
      await kvPut(env, "rep:quotes", q.slice(-60));
    }
    const out = await claude(env, system(rep, ctx, `Someone just talked to you (or replied to you). Answer them directly, in character; tag them with @${m.author.username}. Usually post; only skip if there's genuinely nothing to say.`),
      `Channel #${m._ch.name}, recent messages (oldest first):\n${(convo[m._ch.id] || []).map(fmt).join("\n")}\n\nMessage you're answering, from ${who} (@${m.author.username})${ref ? ` replying to "${String(ref.content).slice(0, 200)}"` : ""}:\n${m.content}`).catch(() => null);
    if (out?.post && out.text && await post(rep, m._ch.id, out.text)) { counts.replies++; did.push(`${rep.id} replied in #${m._ch.name}`); }
  }

  // 2) After an advance: go get comments from coaches about this week's stories.
  if (ctx.period && (await kvJ(env, "rep:period")) !== ctx.period) {
    await kvPut(env, "rep:period", ctx.period);
    const want = 1 + Math.round(2 * lv);
    const userStories = ctx.stories.filter((s) => s.user).slice(0, want);
    for (const [i, s] of userStories.entries()) {
      const rep = REPORTERS[i % REPORTERS.length];
      const team = Object.keys(ctx.coaches).find((t) => s.h.includes(t) || s.d.includes(t));
      const slug = team ? team.toLowerCase().replace(/[^a-z0-9]+/g, "-") : null;
      const ch = chans.find((c) => slug && c.name.includes(slug) && /-at-/.test(c.name)) || chans.find((c) => c.name === "general");
      if (!ch) continue;
      const out = await claude(env, system(rep, ctx, `You're going to a league coach for comment on a story you're working on. Ask ONE pointed question (or rib them, if that's your style) and tag the coach${team ? ` of ${team} (@${ctx.coaches[team]})` : ""}. Always post.`),
        `The story: ${s.h}. ${s.d}`).catch(() => null);
      if (out?.text && await post(rep, ch.id, out.text)) did.push(`${rep.id} asked in #${ch.name}`);
    }
  }

  // 3) Now and then, chime in on a live conversation.
  const cap = Math.round(2 + 6 * lv);
  if (!did.length && counts.spont < cap) {
    const lastSpont = await kvJ(env, "rep:lastspont", 0);
    const live = Object.entries(convo).map(([id, ms]) => ({ id, ms, humans: ms.filter((m) => !m.author.bot && !m.webhook_id && now - Date.parse(m.timestamp) < 15 * 60e3) }))
      .filter((x) => x.humans.length >= 2).sort((a, b) => b.humans.length - a.humans.length)[0];
    if (live && now - lastSpont > 45 * 60e3 && Math.random() < 0.35 * lv + 0.1) {
      const rep = REPORTERS[Math.floor(Math.random() * REPORTERS.length)];
      const ch = chans.find((c) => c.id === live.id);
      const out = await claude(env, system(rep, ctx, "You're lurking in this channel. Only post if you have something funny, sharp or newsy to add to what people are talking about; otherwise set post to false. Don't repeat what someone already said."),
        `Channel #${ch.name}, recent messages (oldest first):\n${live.ms.map(fmt).join("\n")}`).catch(() => null);
      if (out?.post && out.text && await post(rep, ch.id, out.text)) { counts.spont++; await kvPut(env, "rep:lastspont", now); did.push(`${rep.id} chimed in #${ch.name}`); }
    }
  }
  await kvPut(env, `rep:day:${day}`, counts, 3 * 86400);
  const res = { ok: !errors.length, level: lv, fresh: fresh.length, did, errors };
  if (did.length || errors.length) await kvPut(env, "rep:lastrun", { at: new Date(now).toISOString(), ...res });
  return res;
}

// Coaches' on-the-record answers, for the TD Wire AI desk (GET /quotes).
export async function quotes(env) { return env.GREETER ? (await kvJ(env, "rep:quotes", [])) : []; }

export async function reporterStatus(env) {
  return { anthropic_key: !!env.ANTHROPIC_API_KEY, kv: !!env.GREETER, off: (await kvJ(env, "rep:off")) === true, last_event: await kvJ(env, "rep:lastrun"),
    today: await kvJ(env, `rep:day:${new Date().toISOString().slice(0, 10)}`), quotes: (await kvJ(env, "rep:quotes", [])).length, channels_with_hooks: Object.keys(await kvJ(env, "rep:hooks", {})).length };
}
