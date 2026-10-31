// Launches the PACKAGED app (release/win-unpacked) in demo mode and checks it renders and its search engine loads.
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
const env = { ...process.env, CLIPVAULT_DEMO: '1' }; delete env.ELECTRON_RUN_AS_NODE;
const app = spawn('release/win-unpacked/Clipvault.exe', ['--remote-debugging-port=9336'], { env, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let b; for (let i = 0; i < 40 && !b; i++) { try { b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9336', defaultViewport: null }); } catch { await sleep(500); } }
if (!b) { console.log('SMOKE FAILED: app did not start'); app.kill(); process.exit(1); }
await sleep(6000);
const page = (await b.pages()).find((p) => !p.url().includes('#/quick'));
const state = await page.evaluate(() => window.clip.call('state'));
const items = await page.evaluate(() => window.clip.call('history:list', { q: 'when is the get-together with the vendor' }));
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const styled = ['rgb(246, 248, 243)', 'rgb(15, 23, 18)'].includes(bg);
console.log('styled:', styled, bg);
console.log('state:', JSON.stringify({ smart: state.smart, vault: state.vault, history: state.history, hotkeyOk: state.hotkeyOk }));
console.log('semantic hit:', items[0]?.preview?.slice(0, 50), items[0]?.via);
await b.disconnect(); app.kill();
if (!styled || state.smart !== 'ready' || state.history !== 'ok' || !items.length) { console.log('SMOKE FAILED'); process.exit(1); }
console.log('SMOKE OK');
