// Clipvault main process: owns the data, the clipboard watcher, the windows and the hotkey. The Angular
// windows are display only; they ask for everything through the IPC calls registered at the bottom.
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, net, powerMonitor, protocol, screen, session, shell, Tray } from 'electron';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, type AppState, type Card, type Kind, type QuickRow, type Settings } from '../src/app/models.ts';
import { seedDemo } from './demo.ts';
import { History } from './history.ts';
import { Keys } from './keys.ts';
import { foregroundWindow, pasteInto, writeFiles } from './native.ts';
import { Embedder } from './search.ts';
import { Vault } from './vault.ts';

const ROOT = join(import.meta.dirname, '..');
const DEV_URL = process.env['CLIPVAULT_DEV_URL'];
const DEMO = !!process.env['CLIPVAULT_DEMO'];
const HIDDEN = process.argv.includes('--hidden');
const MODELS = app.isPackaged ? join(process.resourcesPath, 'models') : join(ROOT, 'models');
const WEB = join(ROOT, 'dist', 'clipvault', 'browser');

// Titlebar colours follow the stylesheet's --paper and --ink tokens.
const THEME = { light: { bg: '#f6f8f3', fg: '#16241c' }, dark: { bg: '#0f1712', fg: '#e3ebe4' } };

app.setName('Clipvault');
if (DEMO) app.setPath('userData', join(app.getPath('temp'), 'clipvault-demo'));
if (process.env['CLIPVAULT_DATA']) app.setPath('userData', process.env['CLIPVAULT_DATA']);
const DIR = app.getPath('userData');
if (DEMO && DIR.startsWith(app.getPath('temp'))) rmSync(DIR, { recursive: true, force: true }); // demo data is throwaway: every run starts empty
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let settings: Settings = { ...DEFAULTS };
const settingsFile = join(DIR, 'settings.json');
try {
  settings = { ...DEFAULTS, ...JSON.parse(readFileSync(settingsFile, 'utf8')) };
} catch {
  /* first run */
}
const saveSettings = () => (mkdirSync(DIR, { recursive: true }), writeFileSync(settingsFile, JSON.stringify(settings, null, 1)));

let keys: Keys, history: History | undefined, vault: Vault, embedder: Embedder | undefined;
let historyState: AppState['history'] = 'ok';
let main: BrowserWindow | undefined, quick: BrowserWindow, tray: Tray, quitting = false, hotkeyOk = true, prevWindow: unknown;
const icon = nativeImage.createFromPath(join(ROOT, 'build', 'icon.png'));

// ---- tell the windows something changed ----------------------------------------------------------------------
let ping: NodeJS.Timeout | undefined;
const changed = () => {
  clearTimeout(ping);
  ping = setTimeout(() => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('evt', 'changed')), 60);
};
const state = (): AppState => ({
  settings, privateMode: !!history?.paused, history: historyState, vault: vault.state, smart: embedder?.state ?? 'off',
  version: app.getVersion(), demo: DEMO, hotkeyOk,
});

// ---- windows --------------------------------------------------------------------------------------------------
const url = (route: string) => (DEV_URL ? `${DEV_URL}/#${route}` : `app://clipvault/index.html#${route}`);
const prefs = { preload: join(ROOT, 'electron', 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false } as const;
const dark = () => nativeTheme.shouldUseDarkColors;

function showMain(route = '/history') {
  if (main && !main.isDestroyed()) {
    main.webContents.send('evt', 'goto', route);
    main.show();
    main.focus();
    return;
  }
  const t = THEME[dark() ? 'dark' : 'light'];
  main = new BrowserWindow({
    width: 1180, height: 760, minWidth: 780, minHeight: 520, show: false, title: 'Clipvault', icon, backgroundColor: t.bg,
    titleBarStyle: 'hidden', titleBarOverlay: { color: t.bg, symbolColor: t.fg, height: 44 }, webPreferences: prefs,
  });
  void main.loadURL(url(route));
  main.once('ready-to-show', () => main!.show());
  main.on('close', (e) => {
    if (!quitting && settings.background) {
      e.preventDefault();
      main!.hide();
    }
  });
  lock(main);
}

function makeQuick() {
  const t = THEME[dark() ? 'dark' : 'light'];
  quick = new BrowserWindow({
    width: 680, height: 480, show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, fullscreenable: false,
    backgroundColor: t.bg, webPreferences: prefs,
  });
  void quick.loadURL(url('/quick'));
  quick.on('blur', () => !process.env['CLIPVAULT_KEEP_QUICK'] && quick.hide());
  lock(quick);
}
function toggleQuick() {
  if (quick.isVisible()) return quick.hide();
  prevWindow = foregroundWindow();
  const at = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  quick.setPosition(Math.round(at.x + (at.width - 680) / 2), Math.round(at.y + at.height * 0.16));
  quick.show();
  quick.focus();
  quick.webContents.send('evt', 'quick-open');
}

/** Windows cannot open other pages, plug-ins or devtools shortcuts in production. */
function lock(w: BrowserWindow) {
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e) => e.preventDefault());
  if (!DEV_URL && app.isPackaged) w.webContents.on('before-input-event', (e, i) => i.key === 'F12' && e.preventDefault());
}

function hardenSession() {
  const s = session.defaultSession;
  const local = (u: string) => u.startsWith('app://') || u.startsWith('devtools://') || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('file://') || (!!DEV_URL && u.startsWith(DEV_URL)) || (!!DEV_URL && u.startsWith('ws://localhost'));
  s.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !local(d.url) })); // nothing in this app talks to the internet
  s.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  s.webRequest.onHeadersReceived((d, cb) =>
    cb({
      responseHeaders: {
        ...d.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" + (DEV_URL ? '; script-src-elem * \'unsafe-inline\'; connect-src * ws:' : '')],
      },
    }),
  );
  protocol.handle('app', (req) => {
    const path = normalize(decodeURIComponent(new URL(req.url).pathname)).replace(/^[\\/]+/, '') || 'index.html';
    const file = join(WEB, path);
    return net.fetch(pathToFileURL(existsSync(file) && file.startsWith(WEB) ? file : join(WEB, 'index.html')).toString());
  });
}

// ---- settings side effects ------------------------------------------------------------------------------------
function applySettings(prev?: Settings) {
  nativeTheme.themeSource = settings.theme;
  if (!prev || prev.hotkey !== settings.hotkey) {
    globalShortcut.unregisterAll();
    try {
      hotkeyOk = globalShortcut.register(settings.hotkey, toggleQuick);
    } catch {
      hotkeyOk = false;
    }
  }
  if (!prev || prev.startup !== settings.startup) app.setLoginItemSettings({ openAtLogin: settings.startup, args: ['--hidden'] });
  if (!prev || prev.semantic !== settings.semantic) {
    if (settings.semantic && !embedder) startEmbedder();
    if (!settings.semantic) {
      embedder?.stop();
      embedder = undefined;
    }
  }
  vault?.touch();
}
function startEmbedder() {
  try {
    embedder = new Embedder(MODELS, () => {
      history?.embedderReady();
      changed();
    });
  } catch {
    embedder = undefined;
  }
}

// ---- quick paste ------------------------------------------------------------------------------------------------
const GROUPS = ['aadhaar', 'pan', 'licence', 'license', 'driving', 'passport', 'voter', 'bank', 'account', 'ifsc', 'upi'];
async function quickRows(q: string): Promise<QuickRow[]> {
  const rows: QuickRow[] = [];
  const needle = q.trim().toLowerCase();
  if (needle && vault.state === 'unlocked') {
    for (const { card, field } of vault.allFields()) {
      if (!field.secret && field.key !== 'upi') continue;
      const hay = `${card.title} ${field.label} ${card.kind}`.toLowerCase();
      if (needle.split(/\s+/).every((w) => hay.includes(w)) || (field.secret && field.value.toLowerCase().includes(needle)))
        rows.push({ id: `f:${card.id}:${field.key}`, group: 'Identity', title: field.key === 'number' ? card.title : `${card.title} · ${field.label}`, sub: 'Pastes the full number', tail: field.value.replace(/\s/g, '').slice(-4), icon: card.kind, secret: true });
    }
  } else if (needle && vault.state !== 'unlocked' && GROUPS.some((g) => g.startsWith(needle) || needle.startsWith(g))) {
    rows.push({ id: 'unlock', group: 'Identity', title: 'Unlock your IDs', sub: 'Enter your vault password to paste Aadhaar, PAN and more', icon: 'lock' });
  }
  if (history) {
    const items = needle ? (await history.search(q)).slice(0, 8) : history.list();
    const pinned = needle ? [] : items.filter((i) => i.pinned).slice(0, 4);
    const recent = items.filter((i) => needle || !i.pinned).slice(0, needle ? 8 : 9);
    for (const i of pinned) rows.push({ id: 'h:' + i.id, group: 'Pinned', title: i.preview, sub: i.sensitive ? 'Hidden · pastes the full value' : (i.app ?? ''), icon: i.kind, secret: !!i.sensitive });
    for (const i of recent) rows.push({ id: 'h:' + i.id, group: needle ? 'Matches' : 'Recent', title: i.preview, sub: i.sensitive ? 'Hidden · pastes the full value' : i.via === 'meaning' ? 'Similar meaning' : (i.app ?? ''), icon: i.kind, secret: !!i.sensitive });
  }
  return rows;
}
async function quickPick(id: string, paste = true) {
  if (id === 'unlock') {
    quick.hide();
    return showMain('/ids');
  }
  if (id.startsWith('h:')) await history!.copy(id.slice(2));
  else {
    const [, cardId, key] = id.split(':');
    await history!.copyText(vault.fieldValue(cardId, key), true);
  }
  quick.hide();
  if (paste) await pasteInto(prevWindow);
}

// ---- IPC ------------------------------------------------------------------------------------------------------
const h = () => {
  if (!history) throw new Error('Your clipboard history is sealed to another Windows account');
  return history;
};
const needsHistory = <A extends unknown[], R>(fn: (hist: History, ...a: A) => R) => (...a: A) => fn(h(), ...a);

const api: Record<string, (...a: any[]) => unknown> = {
  state,
  'settings:set': (patch: Partial<Settings>) => {
    const prev = settings;
    settings = { ...settings, ...patch };
    saveSettings();
    applySettings(prev);
    BrowserWindow.getAllWindows().forEach((w) => {
      const t = THEME[dark() ? 'dark' : 'light'];
      if (w === main) main.setTitleBarOverlay({ color: t.bg, symbolColor: t.fg });
      w.setBackgroundColor(t.bg);
    });
    changed();
    return settings;
  },
  'private:set': (on: boolean) => {
    h().paused = on;
    tray?.setToolTip(on ? 'Clipvault · capture paused' : 'Clipvault');
    changed();
  },

  'history:list': needsHistory((x, a: { q?: string; kind?: Kind | 'pinned' }) => x.search(a.q ?? '', a.kind)),
  'history:full': needsHistory((x, id: string) => x.full(id)),
  'history:reveal': needsHistory((x, id: string) => x.reveal(id)),
  'history:thumb': needsHistory((x, id: string) => x.thumb(id)),
  'history:image': needsHistory((x, id: string) => x.thumb(id, 1400)),
  'history:copy': needsHistory((x, id: string) => x.copy(id)),
  'history:pin': needsHistory((x, id: string, on: boolean) => x.pin(id, on)),
  'history:remove': needsHistory((x, ids: string[]) => x.remove(ids)),
  'history:clear': needsHistory((x) => x.clear()),
  'history:show': needsHistory((x, id: string) => {
    const f = x.log.rows.get(id)?.files?.[0];
    if (f) shell.showItemInFolder(f);
  }),
  'history:saveImage': needsHistory(async (x, id: string) => {
    const r = await dialog.showSaveDialog({ title: 'Save screenshot', defaultPath: `Screenshot ${new Date().toISOString().slice(0, 10)}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }] });
    if (r.filePath) x.saveImage(id, r.filePath);
    return !!r.filePath;
  }),

  'vault:setup': (pw: string) => vault.setup(pw),
  'vault:unlock': (pw: string) => vault.unlock(pw),
  'vault:lock': () => vault.lock(),
  'vault:change': (a: string, b: string) => vault.change(a, b),
  'vault:export': async (pass: string) => {
    const r = await dialog.showSaveDialog({ title: 'Save encrypted backup', defaultPath: `Clipvault backup ${new Date().toISOString().slice(0, 10)}.clipvault`, filters: [{ name: 'Clipvault backup', extensions: ['clipvault'] }] });
    if (!r.filePath) return false;
    await vault.exportBackup(pass, r.filePath);
    return true;
  },
  'vault:import': async (pass: string) => {
    const r = await dialog.showOpenDialog({ title: 'Choose a backup', filters: [{ name: 'Clipvault backup', extensions: ['clipvault'] }], properties: ['openFile'] });
    return r.filePaths[0] ? vault.importBackup(pass, r.filePaths[0]) : -1;
  },

  'cards:list': () => (vault.state === 'unlocked' ? vault.cards() : []),
  'cards:get': (id: string) => vault.card(id),
  'cards:save': (c: Card) => vault.saveCard(c),
  'cards:remove': (id: string) => vault.removeCard(id),
  'cards:copy': needsHistory((x, id: string, key: string) => x.copyText(vault.fieldValue(id, key), true)),
  'cards:reveal': (id: string, key: string) => (vault.touch(), vault.card(id)?.fields.find((f) => f.key === key)?.value),

  'docs:list': () => (vault.state === 'unlocked' ? vault.docs() : []),
  'docs:search': (q: string) => (vault.state === 'unlocked' ? vault.searchDocs(q) : []),
  'docs:add': (d: { name: string; mime: string; bytes: ArrayBuffer; pages: { page: number; text: string }[] }) => vault.addDoc({ ...d, bytes: new Uint8Array(d.bytes) }),
  'docs:bytes': (id: string) => vault.docBytes(id),
  'docs:remove': (id: string) => vault.removeDoc(id),
  'docs:save': async (id: string) => {
    const d = vault.doc(id)!;
    const r = await dialog.showSaveDialog({ title: 'Save a copy', defaultPath: d.name });
    if (r.filePath) writeFileSync(r.filePath, vault.docBytes(id));
    return !!r.filePath;
  },
  'docs:open': (id: string) => shell.openPath(vault.tempFile(id)),
  'docs:copy': needsHistory(async (x, id: string) => x.copyFiles([vault.tempFile(id)])),

  'quick:query': (q: string) => quickRows(q),
  'quick:pick': (id: string, paste: boolean) => quickPick(id, paste),
  'quick:hide': () => quick.hide(),
  'quick:open': (route: string) => (quick.hide(), showMain(route)),

  'app:folder': () => shell.openPath(DIR),
  'app:startFresh': () => {
    const old = join(DIR, 'old-' + Date.now());
    mkdirSync(old, { recursive: true });
    for (const f of readdirSync(DIR)) if (!f.startsWith('old-') && f !== 'settings.json') renameSync(join(DIR, f), join(old, f));
    app.relaunch();
    app.exit(0);
  },
};

for (const [channel, fn] of Object.entries(api)) {
  ipcMain.handle(channel, (_e, ...args) => fn(...args));
}
ipcMain.on('docs:drag', (e, id: string) => {
  try {
    e.sender.startDrag({ file: vault.tempFile(id), icon: icon.isEmpty() ? nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=') : icon.resize({ width: 48 }) });
  } catch {
    /* vault locked: nothing to drag */
  }
});

// ---- start ----------------------------------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showMain());
app.on('before-quit', () => (quitting = true));
app.on('window-all-closed', () => {
  if (!settings.background) app.quit();
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  vault?.lock();
  history?.stop();
  embedder?.stop();
});

// Not a top-level await: an ES-module entry that awaits 'ready' deadlocks Electron's startup.
async function start() {
  await app.whenReady();
  Menu.setApplicationMenu(null);
  hardenSession();
  keys = new Keys(DIR);
  if (settings.semantic) startEmbedder();
  let historyKey: Buffer | undefined;
  try {
    historyKey = await keys.historyKey();
  } catch {
    historyState = 'foreign'; // sealed by another Windows user or PC
  }
  if (historyKey) {
    history = new History({ dir: DIR, key: historyKey, settings: () => settings, embedder: () => embedder, changed });
    history.start(!DEMO); // the demo never listens to the real clipboard
  }
  vault = new Vault({ dir: DIR, keys, settings: () => settings, embedder: () => embedder, changed });
  if (DEMO && history) await seedDemo(history, vault, () => embedder);

  makeQuick();
  applySettings();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16 }));
  tray.setToolTip('Clipvault');
  tray.on('click', () => showMain());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Clipvault', click: () => showMain() },
      { label: 'Quick paste', click: toggleQuick },
      { label: 'Pause capture', type: 'checkbox', click: (m) => api['private:set'](m.checked) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  powerMonitor.on('lock-screen', () => vault.lock());
  powerMonitor.on('suspend', () => vault.lock());
  nativeTheme.on('updated', () => api['settings:set']({}));
  if (!HIDDEN) showMain();
  if (process.env['CLIPVAULT_KEEP_QUICK']) setTimeout(toggleQuick, 2500); // screenshots only
}
start().catch((e) => {
  console.error(e);
  app.exit(1);
});
