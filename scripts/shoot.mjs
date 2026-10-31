// Launches the app in demo mode (synthetic data), drives it over the DevTools protocol and saves screenshots.
//   npm run build && node scripts/shoot.mjs [outDir]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? '.impeccable/review';
mkdirSync(out, { recursive: true });
const env = { ...process.env, CLIPVAULT_DEMO: '1', CLIPVAULT_KEEP_QUICK: '1' };
delete env.ELECTRON_RUN_AS_NODE;
const app = spawn(join('node_modules', 'electron', 'dist', 'electron.exe'), ['.', '--remote-debugging-port=9333'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
const log = [];
for (const s of [app.stdout, app.stderr]) s.on('data', (d) => log.push(String(d)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser;
for (let i = 0; i < 40 && !browser; i++) {
  try {
    browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null, protocolTimeout: 20000 });
  } catch {
    await sleep(500);
  }
}
if (!browser) {
  console.log(log.join('').slice(0, 3000));
  app.kill();
  process.exit(1);
}

const find = async (hint) => {
  for (let i = 0; i < 40; i++) {
    const p = (await browser.pages()).find((x) => x.url().includes(hint));
    if (p) return p;
    await sleep(250);
  }
  throw new Error('no page ' + hint);
};
const quickPage = await find('#/quick');
const main = (await browser.pages()).find((p) => !p.url().includes('#/quick')) ?? (await find('#/history'));
const errors = [];
main.on('pageerror', (e) => errors.push(String(e)));
main.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await sleep(3500); // let the model load and the demo finish

const go = async (route, ms = 700) => {
  await main.evaluate((r) => (location.hash = r), route);
  await sleep(ms);
};
const shot = async (name, page = main) => {
  try {
    for (let i = 0; i < 3; i++) {
      try {
        await page.bringToFront();
        await page.screenshot({ path: join(out, name + '.png') });
        return console.log('saved', name);
      } catch (e) {
        if (i === 2) console.log('FAILED', name, String(e).slice(0, 100));
        await sleep(800);
      }
    }
  } catch {}
};

for (const scheme of ['light', 'dark']) {
  await main.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await go('/history');
  await shot(`history-${scheme}`);
  await go('/ids');
  await shot(`ids-${scheme}`);
  await go('/docs', 2200);
  await shot(`docs-${scheme}`);
}
await main.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await go('/history');
await main.evaluate(() => [...document.querySelectorAll('.row')].find((r) => r.textContent.includes('•'))?.click());
await sleep(300);
await shot('history-secret-hidden-light');
await main.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Show'))?.click());
await sleep(300);
await shot('history-secret-light');
await go('/ids');
await main.evaluate(() => [...document.querySelectorAll('.row')].find((r) => r.textContent.includes('Aadhaar'))?.click());
await sleep(300);
await main.evaluate(() => document.querySelector('button[aria-label^="Copy Aadhaar"]')?.click());
await main.waitForSelector('.digits.written', { timeout: 4000 }).catch(() => console.log('NO .written CLASS'));
await sleep(260);
await shot('ids-copy-animation');
await sleep(1500);
if (quickPage) {
  await quickPage.evaluate(() => { const i = document.querySelector('input'); i.value = 'pan'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(700);
  await shot('quick-dark', quickPage);
  await quickPage.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await sleep(300);
  await shot('quick-light', quickPage);
}
await go('/settings');
await shot('settings-light');
await main.evaluate(() => window.clip.call('vault:lock'));
await go('/ids', 900);
await shot('lock-light');
await main.evaluate(() => { const i = document.querySelector('.pwbox input'); i.focus(); i.value = 'orchid-lantern'; i.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(300);
await shot('lock-typing-light');

await main.setViewport({ width: 860, height: 620 });
await go('/history');
await shot('history-narrow-light');
await main.setViewport(null);
console.log('PAGE ERRORS:', errors.length ? errors.slice(0, 8).join('\n') : 'none');
console.log('MAIN LOG:', log.join('').split('\n').filter((l) => l && !/dbus|gpu|cache/i.test(l)).slice(0, 12).join('\n'));
await browser.disconnect();
app.kill();
