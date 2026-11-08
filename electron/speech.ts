// Speech to text on this laptop: a Whisper model in a worker thread, started the first time you dictate.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export const SPEECH_MODEL = 'Xenova/whisper-base.en';
export const RATE = 16_000; // Whisper listens at 16 kHz, mono

export class Speech {
  state: 'off' | 'loading' | 'ready' | 'missing' = 'off';
  private w?: Worker;
  private n = 0;
  private waiting = new Map<number, [(t: string) => void, (e: Error) => void]>();
  private ready?: Promise<void>;
  private modelsDir: string;
  private onState: () => void;

  constructor(modelsDir: string, onState: () => void) {
    this.modelsDir = modelsDir;
    this.onState = onState;
    if (!this.installed()) this.state = 'missing';
  }
  installed = () => existsSync(join(this.modelsDir, ...SPEECH_MODEL.split('/'), 'onnx', 'encoder_model_quantized.onnx'));

  /** Load the model if it is not loaded yet. Called when recording starts, so loading overlaps with talking. */
  warm(): Promise<void> {
    if (this.state === 'missing') return Promise.reject(new Error('This build has no speech model. Run npm run models, then build again.'));
    if (this.ready) return this.ready;
    this.set('loading');
    this.ready = new Promise((ok, no) => {
      const w = (this.w = new Worker(new URL('./speech-worker.ts', import.meta.url), { workerData: { modelsDir: this.modelsDir, model: SPEECH_MODEL } }));
      w.on('message', (m) => {
        if (m.ready) {
          this.set('ready');
          return ok();
        }
        const p = this.waiting.get(m.id);
        this.waiting.delete(m.id);
        if (m.error) p?.[1](new Error(m.error));
        else p?.[0](m.text);
      });
      const fail = (e?: unknown) => {
        this.ready = undefined;
        this.w = undefined;
        this.set('off');
        const err = new Error('Speech to text stopped working' + (e ? `: ${String(e)}` : ''));
        for (const [, [, bad]] of this.waiting) bad(err);
        this.waiting.clear();
        no(err);
      };
      w.on('error', fail);
      w.on('exit', () => fail());
    });
    this.ready.catch(() => {});
    return this.ready;
  }

  async transcribe(audio: Float32Array): Promise<string> {
    await this.warm();
    return new Promise((ok, no) => {
      const id = ++this.n;
      this.waiting.set(id, [ok, no]);
      this.w!.postMessage({ id, audio }, [audio.buffer as ArrayBuffer]);
    });
  }

  stop() {
    const w = this.w;
    this.w = undefined;
    this.ready = undefined;
    if (w) {
      w.removeAllListeners('exit');
      void w.terminate();
    }
    for (const [, [, bad]] of this.waiting) bad(new Error('Dictation was turned off'));
    this.waiting.clear();
    if (this.state !== 'missing') this.set('off');
  }
  private set(s: Speech['state']) {
    this.state = s;
    this.onState();
  }
}
