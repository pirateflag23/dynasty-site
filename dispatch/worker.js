// ODL dispatcher — a Cloudflare Worker cron that starts the "ODL sync (stats + Discord)" GitHub Action
// shortly after the Dynasty API has new data. GitHub's own cron is throttled and can lag for hours.
//
// Stateless check: the Action stamps data/stories/<league>/latest.json with sig = "<period>:<data_version>:<played>".
// If the API's current period/data_version no longer matches that stamp, the Action has work to do, so we dispatch it.
// The Action's own concurrency group serializes overlapping runs.

const PROXY = "https://dynasty-proxy.jw1388954.workers.dev/v1";
const PAGES = "https://pirateflag23.github.io/dynasty-site/data/stories";
const REPO = "pirateflag23/dynasty-site";
const WORKFLOW = "player-stats.yml";

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
  let stamp = null;
  try { stamp = (await getJson(`${PAGES}/${id}/latest.json?t=${Date.now()}`)).sig; } catch (e) { /* no stories yet: dispatch */ }
  const [sp, sdv] = String(stamp || "").split(":");
  const stale = !stamp || String(sdv) !== String(dv) || String(sp) !== String(period);
  return { stale, id, dv, period, stamp };
}

async function dispatch(env) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "odl-dispatch", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (r.status !== 204) throw new Error(`dispatch -> ${r.status} ${await r.text()}`);
}

async function run(env, force = false) {
  if (!env.GH_TOKEN) return { ok: false, why: "GH_TOKEN secret not set" };
  const c = await check(env);
  if (!c.stale && !force) return { ok: true, dispatched: false, ...c };
  await dispatch(env);
  return { ok: true, dispatched: true, ...c };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env).then((x) => console.log(JSON.stringify(x))).catch((e) => console.error(String(e))));
  },
  // GET / shows what the next cron would do (never dispatches). Handy for checking from a browser.
  async fetch(req, env) {
    try { return Response.json({ hasToken: !!env.GH_TOKEN, ...(await check(env)) }); }
    catch (e) { return new Response(String(e), { status: 502 }); }
  },
};
