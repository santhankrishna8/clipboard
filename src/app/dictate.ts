import { ChangeDetectionStrategy, Component, ElementRef, NgZone, inject, signal, viewChildren } from '@angular/core';
import type { DictateStatus } from './models';

const RATE = 16_000; // what Whisper listens at
const BARS = 21;
const HEARD = 0.02; // peak level above room noise: below this the recording was silence

/** Mono samples at `from` Hz to 16 kHz, averaging each output sample's window (a cheap low-pass). */
function resample(input: Float32Array, from: number): Float32Array {
  if (from === RATE) return input;
  const ratio = from / RATE, out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b; j++) sum += input[j];
    out[i] = sum / Math.max(1, b - a);
  }
  return out;
}

/** The floating dictation pill: shows that the microphone is on and how loud you are, records, hands the audio to main. */
@Component({
  selector: 'cv-dictate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pill" [class]="'pill ' + st().phase" role="status" aria-live="polite">
      @switch (st().phase) {
        @case ('writing') { <span class="spin" aria-hidden="true"></span><span class="say">Writing…</span> }
        @case ('done') { <span class="ok" aria-hidden="true">✓</span><span class="say ellip">{{ st().text }}</span> }
        @case ('error') { <span class="bad" aria-hidden="true">!</span><span class="say ellip">{{ st().text }}</span> }
        @default {
          <span class="rec" aria-hidden="true"></span>
          <span class="wave" aria-hidden="true">@for (b of bars; track $index) { <i #bar></i> }</span>
          <span class="say">{{ st().phase === 'hands-free' ? 'Tap again to finish' : 'Listening' }}</span>
        }
      }
    </div>
  `,
})
export class Dictate {
  st = signal<DictateStatus>({ phase: 'idle' });
  bars = Array.from({ length: BARS });
  private barEls = viewChildren<ElementRef<HTMLElement>>('bar');
  private zone = inject(NgZone);
  private stream?: MediaStream;
  private ctx?: AudioContext;
  private chunks: Float32Array[] = [];
  private peak = 0;
  private starting?: Promise<void>;
  private raf = 0;

  constructor() {
    document.documentElement.classList.add('dictate-root');
    window.clip.on((name, payload) => {
      if (name === 'dictate-status') this.st.set(payload as DictateStatus);
      else if (name === 'dictate-start') this.starting = this.start();
      else if (name === 'dictate-stop') void this.stop(true);
      else if (name === 'dictate-cancel') void this.stop(false);
    });
  }

  private async start() {
    await this.close();
    this.chunks = [];
    this.peak = 0;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'NotFoundError' ? 'No microphone found' : 'Clipvault could not use the microphone. Check Windows Settings › Privacy › Microphone.';
      window.clip.call('dictate:fail', msg).catch(() => {});
      return;
    }
    const ctx = (this.ctx = new AudioContext());
    const src = ctx.createMediaStreamSource(this.stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    // ScriptProcessor is deprecated but needs no separate module file, which the app's script policy would block.
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(ch));
      for (let i = 0; i < ch.length; i += 8) this.peak = Math.max(this.peak, Math.abs(ch[i]));
    };
    src.connect(analyser);
    src.connect(proc);
    proc.connect(ctx.destination); // it only runs when connected; it writes silence
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      analyser.getByteFrequencyData(bins);
      const els = this.barEls();
      for (let i = 0; i < els.length; i++) {
        const mid = Math.abs(i - (els.length - 1) / 2) / (els.length / 2); // taller in the middle
        const v = bins[2 + Math.round(i * 1.4)] / 255;
        els[i].nativeElement.style.transform = `scaleY(${Math.max(0.12, Math.min(1, v * (1.25 - mid * 0.6)))})`;
      }
      this.raf = requestAnimationFrame(draw);
    };
    this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame(draw)));
  }

  private async stop(send: boolean) {
    await this.starting;
    const rate = this.ctx?.sampleRate ?? RATE;
    const chunks = this.chunks, heard = this.peak > HEARD;
    this.chunks = [];
    await this.close();
    if (!send) return;
    const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) {
      all.set(c, at);
      at += c.length;
    }
    const pcm = resample(all, rate);
    await window.clip.call('dictate:audio', pcm.buffer, heard).catch(() => {});
  }

  private async close() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop()); // the microphone light goes off here
    this.stream = undefined;
    await this.ctx?.close().catch(() => {});
    this.ctx = undefined;
  }
}
