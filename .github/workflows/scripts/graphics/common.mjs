// Shared pieces for The Dynasty's Discord graphics: fonts, colors, helpers, and the Chrome screenshot.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const font = async (pkg, file) => (await readFile(require.resolve(`@fontsource/${pkg}/files/${file}`))).toString("base64");

let fontCss;
// @font-face rules with the fonts inlined, so pages render the same with no network.
// Families: RC = Roboto Condensed (500/700/800), R = Roboto (400/500/700).
export async function fonts() {
  if (fontCss) return fontCss;
  const list = [["RC", 500, "roboto-condensed", "roboto-condensed-latin-500-normal.woff2"], ["RC", 700, "roboto-condensed", "roboto-condensed-latin-700-normal.woff2"],
    ["RC", 800, "roboto-condensed", "roboto-condensed-latin-800-normal.woff2"], ["R", 400, "roboto", "roboto-latin-400-normal.woff2"],
    ["R", 500, "roboto", "roboto-latin-500-normal.woff2"], ["R", 700, "roboto", "roboto-latin-700-normal.woff2"]];
  const b64 = await Promise.all(list.map(([, , p, f]) => font(p, f)));
  fontCss = list.map(([fam, w], i) => `@font-face{font-family:"${fam}";font-weight:${w};src:url(data:font/woff2;base64,${b64[i]})}`).join("\n");
  return fontCss;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); };
export const SHORT = { "Florida International": "FIU", "Florida Atlantic": "FAU", "Southern Mississippi": "Southern Miss", "Miami University": "Miami (OH)" };
export const CONF = { "Big Ten": "B1G", "Big 12": "B12", "Independent": "IND" };
export const short = (n) => SHORT[n] || n;
export const initials = (n) => (SHORT[n] && SHORT[n].length <= 3) ? SHORT[n]
  : n.replace(/\(.*?\)/g, "").split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join("").slice(0, 3) || n.slice(0, 2).toUpperCase();
export const teamCols = (colors, name) => { const [c1 = "#555555", c2 = "#999999"] = colors[name] || []; return { c1, c2, ink: lum(c1) > 0.4 ? "#121213" : "#ffffff" }; };

// Logo <img> with a team-color initials badge behind it if the image is missing or fails to load.
// Needs the .lg/.tb CSS from BADGE_CSS. size in px.
export function badge(name, logo, colors, size = 46) {
  const { c1, c2, ink } = teamCols(colors, name);
  const fb = `<span class="tb" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.35)}px;background:${c1};color:${ink};box-shadow:inset 0 0 0 ${Math.max(2, Math.round(size / 15))}px ${c2}">${esc(initials(name))}</span>`;
  return logo ? `<span class="lg"><img class="tb img" style="width:${size}px;height:${size}px" src="${esc(logo)}" onerror="this.parentNode.classList.add('bad')">${fb}</span>` : fb;
}
export const BADGE_CSS = `.tb{border-radius:50%;display:grid;place-items:center;font-family:RC;font-weight:800;letter-spacing:.02em;flex:none}
.tb.img{object-fit:contain;border-radius:0;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}
.lg{display:contents}.lg .tb:not(.img){display:none}.lg.bad .tb.img{display:none}.lg.bad .tb:not(.img){display:grid}`;

// Render a full HTML page and screenshot `selector` at 2x → PNG Buffer.
export async function shoot(html, { width = 1200, selector = ".card", chromeChannel = "chrome" } = {}) {
  const browser = await chromium.launch({ channel: chromeChannel });
  try {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.locator(selector).screenshot({ type: "png" });
  } finally { await browser.close(); }
}

// Pull TEAM_COLORS out of the site's index.html so colors live in one place.
export async function siteTeamColors(indexPath) {
  const src = await readFile(indexPath, "utf8");
  const m = src.match(/const TEAM_COLORS = (\{[\s\S]*?\n\});/);
  return m ? Function(`return ${m[1]}`)() : {};
}
