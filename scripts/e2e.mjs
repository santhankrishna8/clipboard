// End-to-end check of the real clipboard path: launches the app on a throwaway data folder (NOT demo mode), copies
// things the way other programs do, and reads back what Clipvault kept.   node scripts/e2e.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const data = mkdtempSync(join(tmpdir(), 'cv-e2e-'));
const env = { ...process.env, CLIPVAULT_DATA: data }; delete env.ELECTRON_RUN_AS_NODE; delete env.CLIPVAULT_DEMO;
const app = spawn(join('node_modules', 'electron', 'dist', 'electron.exe'), ['.', '--remote-debugging-port=9335'], { env, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (script) => execFileSync('powershell', ['-STA', '-NoProfile', '-Command', 'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ' + script], { stdio: 'pipe' });
let browser;
for (let i = 0; i < 40 && !browser; i++) { try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9335', defaultViewport: null }); } catch { await sleep(500); } }
const page = (await browser.pages()).find((p) => !p.url().includes('#/quick'));
await sleep(2500);
const list = (q = '') => page.evaluate((q) => window.clip.call('history:list', { q }), q);
const copy = async (script) => { ps(script); await sleep(1100); };

try {
  const base = (await list()).length;
  await copy("[Windows.Forms.Clipboard]::SetText('Meeting moved to Thursday 4 pm in conference room B')");
  await copy("[Windows.Forms.Clipboard]::SetText('Meeting moved to Thursday 4 pm in conference room B')"); // same text again: dedupe, not a second row
  await copy("[Windows.Forms.Clipboard]::SetText('482910')");
  await copy("$d = New-Object Windows.Forms.DataObject; $d.SetText('hunter2-from-a-password-manager'); $d.SetData('ExcludeClipboardContentFromMonitorProcessing', [byte[]](1,0,0,0)); [Windows.Forms.Clipboard]::SetDataObject($d, $true)");
  await copy("$b = New-Object System.Drawing.Bitmap 64,48; [Windows.Forms.Clipboard]::SetImage($b)");
  writeFileSync(join(data, 'note.txt'), 'x');
  await copy(`Set-Clipboard -Path '${join(data, 'note.txt')}'`);

  const items = await list();
  const text = items.map((i) => `${i.kind}:${i.preview}`);
  console.log(text.join('\n'));
  assert.equal(items.length - base, 5 - 1, 'meeting once (deduped), code, image, file; the password-manager copy is skipped');
  assert.ok(items.some((i) => i.kind === 'text' && i.preview.startsWith('Meeting moved')));
  assert.equal(items.filter((i) => i.preview.startsWith('Meeting moved')).length, 1, 'duplicate copy must not add a row');
  assert.ok(!text.some((t) => t.includes('hunter2')), 'text flagged ExcludeClipboardContentFromMonitorProcessing must never be saved');
  const code = items.find((i) => i.sensitive === 'otp');
  assert.ok(code && !code.preview.includes('48'), 'a one-time code is masked in the list');
  assert.ok(items.some((i) => i.kind === 'image' && i.w === 64), 'an image is kept');
  assert.ok(items.some((i) => i.kind === 'files' && i.preview === 'note.txt'), 'a copied file keeps its path');

  assert.equal((await list('conference')).at(0)?.kind, 'text', 'exact-word search finds it');
  assert.ok((await list('thursday meeting room')).length >= 1, 'keyword search finds it');
  console.log('semantic:', JSON.stringify((await list('when is the get-together with the vendor')).slice(0, 2).map((i) => [i.preview.slice(0, 40), i.via])));

  // our own Copy must not be captured again
  const first = items.find((i) => i.preview.startsWith('Meeting moved'));
  await page.evaluate((id) => window.clip.call('history:copy', id), first.id);
  await sleep(1300);
  assert.equal((await list()).length, items.length, 'copying from Clipvault does not create a new item');
  // data on disk is sealed
  assert.ok(!readFileSync(join(data, 'history.log')).includes('Meeting moved'), 'plaintext must not appear in history.log');
  console.log('E2E OK');
} catch (e) {
  console.log('E2E FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await browser.disconnect();
  app.kill();
}
