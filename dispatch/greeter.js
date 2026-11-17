// TD greeter: welcomes new Discord members, gives them the Coach role, and logs joins/leaves
// to a staff-only channel. Runs from the odl-dispatch cron (every 2 minutes).
//
// Needs: DISCORD_BOT_TOKEN secret, the bot's "Server Members Intent" switched on in the Discord
// Developer Portal (Bot tab), and Manage Roles + Manage Channels, with the bot's role ABOVE Coach.
// Optional KV binding GREETER (keeps the member list, so leaves can be logged). Without it, joins are
// still welcomed from each member's join time, and leaves aren't logged.

const DC = "https://discord.com/api/v10";
const CFG = {
  guild: "1569397791313232013",
  coachRole: "Coach",
  staffRole: "Badmin",
  welcomeChannels: ["welcome", "welcomes", "general"], // first one that exists gets the public welcome
  logChannel: "join-log",                               // created (Badmin-only) if it doesn't exist
  gif: "https://thedynastycfb.com/welcome.gif",
  site: "https://thedynastycfb.com",
  color: 0xcc0000,
};

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

async function allMembers(env) {
  const out = [];
  let after = "0";
  for (;;) {
    const page = await dc(env, "GET", `/guilds/${CFG.guild}/members?limit=1000&after=${after}`);
    out.push(...page);
    if (page.length < 1000) return out;
    after = page[page.length - 1].user.id;
  }
}

const display = (m) => m.nick || m.user.global_name || m.user.username;
const avatar = (u) => (u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256` : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`);
const created = (id) => Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000);

async function setup(env) {
  const [roles, channels] = await Promise.all([dc(env, "GET", `/guilds/${CFG.guild}/roles`), dc(env, "GET", `/guilds/${CFG.guild}/channels`)]);
  const role = (n) => roles.find((r) => r.name.toLowerCase() === n.toLowerCase());
  const text = (n) => channels.find((c) => c.type === 0 && c.name === n);
  const coach = role(CFG.coachRole), staff = role(CFG.staffRole);
  const welcome = CFG.welcomeChannels.map(text).find(Boolean);
  let log = text(CFG.logChannel);
  if (!log && staff) {
    const me = await dc(env, "GET", "/users/@me");
    // @everyone can't see it; Badmin and the bot can. VIEW_CHANNEL = 1024, SEND_MESSAGES = 2048, READ_HISTORY = 65536.
    log = await dc(env, "POST", `/guilds/${CFG.guild}/channels`, {
      name: CFG.logChannel, type: 0, topic: "Joins and leaves (staff only)",
      permission_overwrites: [
        { id: CFG.guild, type: 0, deny: "1024" },
        { id: staff.id, type: 0, allow: String(1024 + 65536) },
        { id: me.id, type: 1, allow: String(1024 + 2048 + 65536) },
      ],
    });
  }
  return { coach, welcome, log };
}

async function greet(env, m, s) {
  const name = display(m);
  if (s.coach && !m.roles.includes(s.coach.id)) await dc(env, "PUT", `/guilds/${CFG.guild}/members/${m.user.id}/roles/${s.coach.id}`).catch((e) => console.error("role", e.message));
  if (s.welcome) await dc(env, "POST", `/channels/${s.welcome.id}/messages`, {
    content: `<@${m.user.id}>`,
    allowed_mentions: { users: [m.user.id] },
    embeds: [{
      color: CFG.color, title: `Welcome to TheDynasty, ${name}!`, url: CFG.site, thumbnail: { url: avatar(m.user) },
      description: [
        "Glad to have you in the league.",
        "",
        "🏈 The commish will get you set up with your team",
        "📜 Read the league rules before your first game",
        "🎥 Every league game is streamed: put **TheDynasty** in your stream title",
        `🌐 Standings, stats and recruiting: [thedynastycfb.com](${CFG.site})`,
      ].join("\n"),
      image: { url: CFG.gif },
    }],
  });
  if (s.log) await dc(env, "POST", `/channels/${s.log.id}/messages`, { allowed_mentions: { parse: [] }, embeds: [{ color: 0x3ccf6e,
    description: `📥 <@${m.user.id}> **${name}** joined · account created <t:${created(m.user.id)}:R>${s.coach ? ` · given **${s.coach.name}**` : ""}` }] });
}

async function farewell(env, id, name, s) {
  if (s.log) await dc(env, "POST", `/channels/${s.log.id}/messages`, { allowed_mentions: { parse: [] }, embeds: [{ color: 0xff5a5a,
    description: `📤 <@${id}> **${name}** left the server` }] });
}

export async function runGreeter(env, scheduledTime = Date.now(), windowMs = 120000) {
  if (!env.DISCORD_BOT_TOKEN) return { ok: false, why: "DISCORD_BOT_TOKEN not set" };
  // Skip bots, and members still on the rules screen (they count as joined once they accept).
  const members = (await allMembers(env)).filter((m) => !m.user.bot && !m.pending);
  const now = new Map(members.map((m) => [m.user.id, m]));
  let joined, left = [];
  if (env.GREETER) {
    const prev = await env.GREETER.get("members", "json");
    await env.GREETER.put("members", JSON.stringify(Object.fromEntries(members.map((m) => [m.user.id, display(m)]))));
    if (!prev) return { ok: true, first_run: true, members: members.length }; // first run: remember everyone, greet no one
    joined = members.filter((m) => !(m.user.id in prev));
    left = Object.entries(prev).filter(([id]) => !now.has(id));
  } else {
    // No KV: greet whoever joined in this cron window.
    joined = members.filter((m) => { const t = Date.parse(m.joined_at); return t > scheduledTime - windowMs && t <= scheduledTime; });
  }
  if (!joined.length && !left.length) return { ok: true, joined: 0, left: 0 };
  const s = await setup(env);
  for (const m of joined) await greet(env, m, s).catch((e) => console.error("greet", e.message));
  for (const [id, name] of left) await farewell(env, id, name, s).catch((e) => console.error("farewell", e.message));
  return { ok: true, joined: joined.map(display), left: left.map(([, n]) => n) };
}

// Read-only check for GET /greeter on the worker: what the greeter would use, without posting or creating anything.
export async function inspectGreeter(env) {
  if (!env.DISCORD_BOT_TOKEN) return { ok: false, why: "DISCORD_BOT_TOKEN not set" };
  const [roles, channels] = await Promise.all([dc(env, "GET", `/guilds/${CFG.guild}/roles`), dc(env, "GET", `/guilds/${CFG.guild}/channels`)]);
  const me = await dc(env, "GET", "/users/@me");
  const meMember = await dc(env, "GET", `/guilds/${CFG.guild}/members/${me.id}`);
  const role = (n) => roles.find((r) => r.name.toLowerCase() === n.toLowerCase());
  const top = Math.max(0, ...meMember.roles.map((id) => roles.find((r) => r.id === id)?.position || 0));
  let membersIntent = true, count = null;
  try { count = (await allMembers(env)).length; } catch (e) { membersIntent = false; }
  return {
    ok: true, kv: !!env.GREETER, members_intent_on: membersIntent, members: count,
    welcome_channel: CFG.welcomeChannels.find((n) => channels.some((c) => c.type === 0 && c.name === n)) || null,
    log_channel_exists: channels.some((c) => c.type === 0 && c.name === CFG.logChannel),
    coach_role: role(CFG.coachRole)?.name || null, staff_role: role(CFG.staffRole)?.name || null,
    bot_above_coach: role(CFG.coachRole) ? top > role(CFG.coachRole).position : null,
  };
}
