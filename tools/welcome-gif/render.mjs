// Renders welcome.html to site/public/welcome.gif (needs ffmpeg + Chrome).
//   node tools/welcome-gif/render.mjs        (run from the repo root, after `npm ci --prefix .github/workflows/scripts/graphics`)
import { mkdtemp, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(join(process.cwd(), ".github/workflows/scripts/graphics/package.json"));
const { chromium } = require("playwright-core");
const FPS = 15, SECONDS = 4, W = 800, H = 450;

const dir = await mkdtemp(join(tmpdir(), "welcome-"));
await copyFile("tools/welcome-gif/welcome.html", join(dir, "welcome.html"));
await copyFile("site/public/logo.png", join(dir, "logo.png"));
for (const w of [700, 800]) await copyFile(require.resolve(`@fontsource/roboto-condensed/files/roboto-condensed-latin-${w}-normal.woff2`), join(dir, `rc${w}.woff2`));

const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto("file://" + join(dir, "welcome.html"));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const n = FPS * SECONDS;
  for (let i = 0; i < n; i++) {
    const t = (i / FPS) * 1000;
    await page.evaluate((t) => document.getAnimations().forEach((a) => { a.currentTime = t; }), t);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(3, "0")}.png`) });
  }
} finally { await browser.close(); }

const out = "site/public/welcome.gif";
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%03d.png"),
  "-vf", "split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", out]);
await rm(dir, { recursive: true, force: true });
console.log(`wrote ${out} (${((await readFile(out)).length / 1024).toFixed(0)} KB)`);
