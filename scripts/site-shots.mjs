// Screenshots of the site in light and dark at desktop and phone width (system Chrome).   node scripts/site-shots.mjs
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
mkdirSync('.taste-skill/mine', { recursive: true });
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
for (const [scheme, w, h] of [['light', 1440, 900], ['light', 390, 844], ['dark', 390, 844]]) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await p.goto(pathToFileURL('site/index.html').href, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 1200));
  // reveal everything that enters on scroll, then settle
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
  await new Promise((r) => setTimeout(r, 1500));
  await p.evaluate(() => document.querySelectorAll('.rise,.bars').forEach((e) => e.classList.add('in')));
  await new Promise((r) => setTimeout(r, 1500));
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  const step = w > 800 ? 2600 : 3400;
  for (let y = 0, i = 1; y < H; y += step, i++) await p.screenshot({ path: `.taste-skill/mine/${scheme}-${w}-${i}.png`, clip: { x: 0, y, width: w, height: Math.min(step, H - y) }, captureBeyondViewport: true });
  console.log('saved', scheme, w, await p.evaluate(() => document.documentElement.scrollWidth + ' wide, ' + document.documentElement.scrollHeight + ' tall'));
  await p.close();
}
await b.close();
