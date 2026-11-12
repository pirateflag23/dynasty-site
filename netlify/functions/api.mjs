// netlify/functions/api.js
export default async (req) => {
  const u = new URL(req.url);
  const path = u.searchParams.get("path");          // e.g. "schedule"
  u.searchParams.delete("path");
  const res = await fetch(`${process.env.DYNASTY_BASE}/v1/${path}?${u.searchParams}`, {
    headers: { Authorization: `Bearer ${process.env.DYNASTY_API_KEY}` }
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" }
  });
};
