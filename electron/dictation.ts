// Dictation, the way Wispr Flow does it: hold the shortcut and talk, let go and the words are typed into the
// program you were in. A quick tap instead starts hands-free mode; tap again to finish. Esc cancels.
// The microphone is opened only while the pill shows, and the audio never leaves the laptop: Whisper runs in
// a worker thread (speech.ts) on a model bundled with the app.
import { BrowserWindow, globalShortcut, screen } from 'electron';
import type { DictatePhase, DictateStatus, Settings } from '../src/app/models.ts';
import type { History } from './history.ts';
import { foregroundWindow, keyDown, pasteInto } from './native.ts';
import { RATE, type Speech } from './speech.ts';
import { tidy } from './text.ts';

const W = 320, H = 72;
const HOLD_MS = 350; // held longer than this = push-to-talk; shorter = a tap that starts hands-free mode
const MAX_MS = 6 * 60_000;

/** Windows virtual-key code of the last key in an Electron accelerator, so we can tell when it is let go. */
export function virtualKey(accel: string): number | undefined {
  const k = accel.split('+').pop()!.trim();
  if (/^[a-z0-9]$/i.test(k)) return k.toUpperCase().charCodeAt(0);
  const f = /^F(\d{1,2})$/i.exec(k);
  if (f && +f[1] >= 1 && +f[1] <= 24) return 0x6f + +f[1];
  return ({ Space: 0x20, Enter: 0x0d, Return: 0x0d, Tab: 0x09, Backspace: 0x08, Insert: 0x2d, Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22 } as Record<string, number>)[k];
}

export interface DictationDeps {
  url: (route: string) => string;
  prefs: Electron.WebPreferences;
  settings: () => Settings;
  history: () => History | undefined;
  speech: Speech;
}

export class Dictation {
  phase: DictatePhase = 'idle';
  pill!: BrowserWindow;
  private d: DictationDeps;
  private target: unknown;
  private t0 = 0;
  private ended = 0;
  private poll?: NodeJS.Timeout;
  private cap?: NodeJS.Timeout;
  private hide?: NodeJS.Timeout;

  constructor(d: DictationDeps) {
    this.d = d;
  }

  make() {
    this.pill = new BrowserWindow({
      width: W, height: H, show: false, frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: false, movable: false,
      minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, alwaysOnTop: true, focusable: false,
      webPreferences: { ...this.d.prefs, backgroundThrottling: false },
    });
    this.pill.setAlwaysOnTop(true, 'screen-saver');
    this.pill.setIgnoreMouseEvents(true);
    void this.pill.loadURL(this.d.url('/dictate'));
  }

  /** The shortcut was pressed (Windows also repeats this while it is held). */
  press = () => {
    const vk = virtualKey(this.d.settings().dictationKey);
    const held = vk !== undefined && keyDown(vk);
    if (this.phase === 'listening') return held ? undefined : this.finish(); // auto-repeat while held
    if (this.phase === 'hands-free') return this.finish();
    if (this.phase === 'writing') return;
    if (held && Date.now() - this.ended < 800) return; // still holding the key from the last one
    this.begin(vk);
  };

  private begin(vk?: number) {
    clearTimeout(this.hide);
    this.target = foregroundWindow();
    this.t0 = Date.now();
    const at = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    this.pill.setBounds({ x: Math.round(at.x + (at.width - W) / 2), y: Math.round(at.y + at.height - H - 28), width: W, height: H });
    this.pill.showInactive(); // never take focus: the words go to the program you are in
    this.status(vk === undefined ? 'hands-free' : 'listening');
    this.pill.webContents.send('evt', 'dictate-start');
    this.d.speech.warm().catch(() => {}); // the model loads while you talk
    try {
      globalShortcut.register('Escape', this.cancel);
    } catch {
      /* someone else has Esc; the shortcut still stops it */
    }
    this.cap = setTimeout(() => this.finish(), MAX_MS);
    if (vk !== undefined)
      this.poll = setInterval(() => {
        if (keyDown(vk)) return;
        clearInterval(this.poll);
        if (Date.now() - this.t0 > HOLD_MS) this.finish();
        else this.status('hands-free'); // it was a tap: keep listening until the next tap
      }, 25);
  }

  private release() {
    clearInterval(this.poll);
    clearTimeout(this.cap);
    globalShortcut.unregister('Escape');
  }

  finish = () => {
    if (this.phase !== 'listening' && this.phase !== 'hands-free') return;
    this.release();
    this.status('writing');
    this.pill.webContents.send('evt', 'dictate-stop'); // the pill answers with dictate:audio
  };

  cancel = () => {
    this.release();
    this.pill.webContents.send('evt', 'dictate-cancel');
    this.end();
  };

  /** 16 kHz mono samples from the pill, and whether anything louder than room noise was heard. */
  async audio(samples: Float32Array, heard: boolean) {
    if (this.phase !== 'writing') return; // cancelled meanwhile
    if (!heard || samples.length < RATE * 0.3) return this.fail("Didn't catch that. Hold the shortcut while you talk.");
    try {
      const s = this.d.settings();
      const text = tidy(await this.d.speech.transcribe(samples), s.dictationFillers);
      if (!text) return this.fail("Didn't catch that");
      const h = this.d.history();
      if (!h) throw new Error('History is not available');
      h.add('text', { text }, 'Dictation');
      await h.copyText(text, false);
      await pasteInto(this.target);
      this.status('done', text);
      this.end(1100);
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e));
    }
  }

  fail(msg: string) {
    this.release();
    this.status('error', msg);
    this.end(2600);
  }

  private end(after = 0) {
    this.ended = Date.now();
    this.phase = 'idle';
    clearTimeout(this.hide);
    this.hide = setTimeout(() => this.phase === 'idle' && this.pill.hide(), after);
  }

  private status(phase: DictatePhase, text?: string) {
    this.phase = phase === 'done' || phase === 'error' ? 'idle' : phase;
    const s: DictateStatus = { phase, text };
    this.pill.webContents.send('evt', 'dictate-status', s);
  }
}
