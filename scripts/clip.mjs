// Records a short real clip of the app (demo data, dark theme): reveal an Aadhaar number, copy it, watch it written in ink.
//   node scripts/clip.mjs   ->  site/assets/copy-moment.mp4 (+ poster)
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const tmp = join('.impeccable', 'clip-frames');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const env = { ...process.env, CLIPVAULT_DEMO: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const app = spawn(join('node_modules', 'electron', 'dist', 'electron.exe'), ['.', '--remote-debugging-port=9337'], { env, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let b;
for (let i = 0; i < 40 && !b; i++) { try { b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9337', defaultViewport: null }); } catch { await sleep(500); } }
await sleep(4500);
const page = (await b.pages()).find((p) => !p.url().includes('#/quick'));
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await page.evaluate(() => (location.hash = '/ids'));
await sleep(1200);
await page.evaluate(() => [...document.querySelectorAll('.row')].find((r) => r.textContent.includes('Aadhaar'))?.click());
await sleep(500);

const cdp = await page.createCDPSession();
const frames = [];
const t0 = Date.now();
const script = [[900, () => document.querySelector('button[aria-label^="Show Aadhaar"]')?.click()], [2400, () => document.querySelector('button[aria-label^="Copy Aadhaar"]')?.click()]];
const timers = script.map(([ms, fn]) => setTimeout(() => page.evaluate(fn).catch(() => {}), ms));
// the window is not being presented to a screen, so ask for each frame explicitly (the fastest the compositor will give them)
while (Date.now() - t0 < 5200) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 72, optimizeForSpeed: true, fromSurface: true });
  frames.push({ t: (Date.now() - t0) / 1000, data });
}
timers.forEach(clearTimeout);
await b.disconnect();
app.kill();

// variable frame rate -> an ffmpeg concat list with each frame's real duration
const lines = [];
frames.forEach((f, i) => {
  const name = `f${String(i).padStart(4, '0')}.jpg`;
  writeFileSync(join(tmp, name), Buffer.from(f.data, 'base64'));
  const dur = i + 1 < frames.length ? Math.max(0.016, frames[i + 1].t - f.t) : 0.8;
  lines.push(`file '${name}'`, `duration ${dur.toFixed(3)}`);
});
lines.push(`file 'f${String(frames.length - 1).padStart(4, '0')}.jpg'`);
writeFileSync(join(tmp, 'list.txt'), lines.join('\n'));
const out = join('site', 'assets');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-vf', 'fps=30,scale=1180:-2,format=yuv420p', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', '-an', join(out, 'copy-moment.mp4')]);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(out, 'copy-moment.mp4'), '-vf', 'select=eq(n\\,0)', '-frames:v', '1', '-quality', '82', join(out, 'copy-moment-poster.webp')]);
console.log('frames', frames.length, 'seconds', (frames.at(-1).t - frames[0].t).toFixed(1));
