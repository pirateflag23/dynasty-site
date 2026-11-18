// Dev tool: captures the live site and recent Discord posts for the promo video. Output goes to ./out
// (pushed to the video-assets branch by video-capture.yml). Not part of the site.
import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const SITE = process.env.SITE || "https://thedynastycfb.com/";
const OUT = "out";
await mkdir(`${OUT}/site`, { recursive: true });
const pages = JSON.parse(process.env.PAGES || "[]");
const browser = await chromium.launch();
async function shoot(ctxOpts, list, tag) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("dyn-tour2-off", "1"); } catch {} });
  for (const [name, hash, opts = {}] of list) {
    try {
      await page.goto(SITE + hash, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(opts.wait || 3500);
      if (opts.click) { await page.click(opts.click).catch(() => {}); await page.waitForTimeout(2000); }
      await page.screenshot({ path: `${OUT}/site/${tag}-${name}.jpg`, type: "jpeg", quality: 92, fullPage: true });
      console.log("shot", tag, name);
    } catch (e) { console.log("FAIL", tag, name, e.message); }
  }
  await ctx.close();
}
const desk = pages.filter((p) => !p[3]), phone = pages.filter((p) => p[3]);
await shoot({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 }, desk.map(([a, b, c]) => [a, b, c]), "d");
await shoot({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, phone.map(([a, b, c]) => [a, b, c]), "m");
await browser.close();

// Discord: last messages (text, embeds, images) from the league's text channels
const TOKEN = process.env.DISCORD_BOT_TOKEN, cfg = JSON.parse(await readFile("discord.config.json", "utf8"));
if (TOKEN && cfg.guild_id) {
  const dc = async (p) => { for (let i = 0; i < 5; i++) { const r = await fetch(`https://discord.com/api/v10${p}`, { headers: { Authorization: `Bot ${TOKEN}` } }); if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500)); continue; } return r.ok ? r.json() : null; } return null; };
  const chans = (await dc(`/guilds/${cfg.guild_id}/channels`)) || [];
  const guild = await dc(`/guilds/${cfg.guild_id}`);
  const roles = (await dc(`/guilds/${cfg.guild_id}/roles`)) || [];
  await mkdir(`${OUT}/discord/img`, { recursive: true });
  const dump = { guild: { name: guild?.name, icon: guild?.icon && `https://cdn.discordapp.com/icons/${cfg.guild_id}/${guild.icon}.png?size=128` }, roles: roles.map((r) => ({ id: r.id, name: r.name, color: r.color })), channels: chans.map((c) => ({ id: c.id, name: c.name, type: c.type, parent: c.parent_id, pos: c.position })), messages: {} };
  let n = 0; const dl = async (url) => { try { const r = await fetch(url); if (!r.ok) return null; const ext = (url.split("?")[0].match(/\.(png|jpe?g|gif|webp)$/i) || [, "png"])[1]; const f = `img/${++n}.${ext}`; await writeFile(`${OUT}/discord/${f}`, Buffer.from(await r.arrayBuffer())); return f; } catch { return null; } };
  for (const c of chans.filter((c) => c.type === 0)) {
    const msgs = (await dc(`/channels/${c.id}/messages?limit=15`)) || [];
    const out = [];
    for (const m of msgs) {
      const att = []; for (const a of m.attachments || []) if (/image/.test(a.content_type || "") || /\.(png|jpe?g|gif|webp)/i.test(a.filename)) att.push(await dl(a.url));
      const embeds = []; for (const e of m.embeds || []) embeds.push({ ...e, _img: e.image?.url ? await dl(e.image.url) : null, _thumb: e.thumbnail?.url ? await dl(e.thumbnail.url) : null });
      const av = m.author?.avatar ? (m.webhook_id ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=80` : `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=80`) : null;
      out.push({ id: m.id, at: m.timestamp, author: m.author?.global_name || m.author?.username, bot: !!(m.author?.bot), avatar: av ? await dl(av) : null, content: m.content, attachments: att.filter(Boolean), embeds, webhook: !!m.webhook_id });
    }
    dump.messages[c.name] = out; console.log("discord", c.name, out.length);
  }
  await writeFile(`${OUT}/discord/discord.json`, JSON.stringify(dump, null, 1));
}
