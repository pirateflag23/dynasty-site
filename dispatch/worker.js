// ODL dispatcher — a Cloudflare Worker cron that starts the "ODL sync (stats + Discord)" GitHub Action
// shortly after the Dynasty API has new data. GitHub's own cron is throttled and can lag for hours.
//
// Stateless check: the Action stamps data/stories/<league>/latest.json with sig = "<period>:<data_version>:<played>".
// If the API's current period/data_version no longer matches that stamp, the Action has work to do, so we dispatch it.
// The Action's own concurrency group serializes overlapping runs.

import { runGreeter, inspectGreeter } from "./greeter.js";
import { runReporters, quotes, reporterStatus } from "./reporters.js";

const PROXY = "https://dynasty-proxy.jw1388954.workers.dev/v1";
const PAGES = "https://pirateflag23.github.io/dynasty-site/data/stories";
const REPO = "pirateflag23/dynasty-site";
const WORKFLOW = "player-stats.yml";
const ON_DECK_HOURS = 60; // keep in step with on_deck_delay_hours in discord.config.json
const PR_HOURS = 30; // matches power_rankings.after_hours in discord.config.json

async function getJson(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

async function check(env) {
  const lg = await getJson(`${PROXY}/league`);
  const id = lg.league_id ?? lg.data?.league_id;
  const dv = lg.data_version;
  const period = lg.data?.current_period?.id;
  const since = Date.parse(lg.data?.current_period?.first_seen_at || "") || null; // ≈ when the league advanced
  let stamp = null;
  try { stamp = (await getJson(`${PAGES}/${id}/latest.json?t=${Date.now()}`)).sig; } catch (e) { /* no stories yet: dispatch */ }
  const [sp, sdv] = String(stamp || "").split(":");
  const stale = !stamp || String(sdv) !== String(dv) || String(sp) !== String(period);
  return { stale, id, dv, period, stamp, since };
}

async function dispatch(env) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "odl-dispatch", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (r.status !== 204) throw new Error(`dispatch -> ${r.status} ${await r.text()}`);
}

// first 12:00 Eastern at least PR_HOURS after the advance (same rule as discord-feed.mjs)
function prTarget(since) {
  const t0 = since + PR_HOURS * 3600e3;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date(t0)).map((x) => [x.type, x.value]));
  const h = Number(p.hour) + Number(p.minute) / 60;
  return t0 + ((12 - h + 24) % 24) * 3600e3;
}

async function run(env, force = false) {
  if (!env.GH_TOKEN) return { ok: false, why: "GH_TOKEN secret not set" };
  const c = await check(env);
  // #on-deck goes out ON_DECK_HOURS after an advance: run the sync once when that time arrives (it posts on-deck then).
  let onDeckDue = false;
  if (c.since && Date.now() - c.since >= ON_DECK_HOURS * 3600e3 && env.GREETER) {
    onDeckDue = (await env.GREETER.get("ondeck_dispatched")) !== String(c.period);
    if (onDeckDue) await env.GREETER.put("ondeck_dispatched", String(c.period));
  }
  // Coach power rankings go out mid-window: the first noon (Eastern) at least PR_HOURS after the advance.
  let prDue = false;
  if (c.since && Date.now() >= prTarget(c.since) && env.GREETER) {
    prDue = (await env.GREETER.get("pr_dispatched")) !== String(c.period);
    if (prDue) await env.GREETER.put("pr_dispatched", String(c.period));
  }
  if (!c.stale && !onDeckDue && !prDue && !force) return { ok: true, dispatched: false, ...c };
  await dispatch(env);
  return { ok: true, dispatched: true, onDeckDue, prDue, ...c };
}

export default {
  // Cron runs every 2 minutes: the Discord greeter every time, the sync check every 10 minutes.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runGreeter(env, event.scheduledTime).then((x) => console.log("greeter", JSON.stringify(x))).catch((e) => console.error("greeter", String(e))));
    ctx.waitUntil(runReporters(env, event.scheduledTime).then((x) => console.log("reporters", JSON.stringify(x))).catch((e) => console.error("reporters", String(e))));
    if (new Date(event.scheduledTime).getUTCMinutes() % 10 === 0)
      ctx.waitUntil(run(env).then((x) => console.log(JSON.stringify(x))).catch((e) => console.error(String(e))));
  },
  // GET / shows what the next cron would do (never dispatches). Handy for checking from a browser.
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path === "/quotes") return Response.json(await quotes(env), { headers: { "access-control-allow-origin": "*" } });
    if (path === "/reporters") { try { return Response.json(await reporterStatus(env)); } catch (e) { return new Response(String(e), { status: 502 }); } }
    if (path === "/greeter") {
      try { return Response.json(await inspectGreeter(env)); } catch (e) { return new Response(String(e), { status: 502 }); }
    }
    try { return Response.json({ hasToken: !!env.GH_TOKEN, ...(await check(env)) }); }
    catch (e) { return new Response(String(e), { status: 502 }); }
  },
};
