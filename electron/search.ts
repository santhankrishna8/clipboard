// Hybrid search, ported from the match_chunks SQL in Ask Your Docs (RAG_DOC/supabase/schema.sql):
// the top 20 by meaning (cosine) and the top 20 by rarity-weighted keywords, merged with reciprocal rank fusion.
// Everything runs in memory on this machine; the embedder is a worker thread with the model bundled in the app.
import { Worker } from 'node:worker_threads';

const STOP = new Set('a an the and or of to in on for with is are was be it this that at as by from i my me you your'.split(' '));
const stem = (w: string) => (w.length <= 4 ? w : w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.replace(/(ing|ed|es|s)$/, ''));
// Postgres did the tokenising and stemming in Ask Your Docs; this is the small stand-in.
export const tokens = (s: string): string[] => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => !STOP.has(w)).map(stem);

export interface Entry {
  id: string;
  text: string;
  vec?: Float32Array;
  set?: Set<string>; // cached token set
}
export interface Hit {
  id: string;
  score: number;
  via: 'text' | 'meaning' | 'both';
}

const RRF = 60;
const TOP = 20;
export const FLOOR = 0.25; // weaker meaning-only matches are noise; picked from a sweep on scripts/eval.ts (0.22 to 0.32), in-sample

export function hybrid(entries: Entry[], q: { text: string; vec?: Float32Array }, k = 40, floor = FLOOR): Hit[] {
  const semantic = new Map<string, number>();
  if (q.vec) {
    const sims: [string, number][] = [];
    for (const e of entries) {
      if (!e.vec) continue;
      let dot = 0;
      for (let i = 0; i < e.vec.length; i++) dot += e.vec[i] * q.vec[i];
      if (dot >= floor) sims.push([e.id, dot]);
    }
    sims.sort((a, b) => b[1] - a[1]).slice(0, TOP).forEach(([id], r) => semantic.set(id, r + 1));
  }

  const terms = [...new Set(tokens(q.text))];
  const lexical = new Map<string, number>();
  if (terms.length && entries.length) {
    const n = entries.length;
    const df = new Map(terms.map((t) => [t, 0]));
    for (const e of entries) {
      e.set ??= new Set(tokens(e.text));
      for (const t of terms) if (e.set.has(t)) df.set(t, df.get(t)! + 1);
    }
    const w = new Map(terms.map((t) => [t, Math.log(1 + n / Math.max(df.get(t)!, 1))])); // absent word = maximum rarity
    const total = [...w.values()].reduce((a, b) => a + b, 0);
    const scored: [string, number][] = [];
    for (const e of entries) {
      let s = 0;
      for (const t of terms) if (e.set!.has(t)) s += w.get(t)!;
      if (s >= 0.5 * total) scored.push([e.id, s]); // one incidental shared word can't outvote the vector ranking
    }
    scored.sort((a, b) => b[1] - a[1]).slice(0, TOP).forEach(([id], r) => lexical.set(id, r + 1));
  }

  const ids = new Set([...semantic.keys(), ...lexical.keys()]);
  return [...ids]
    .map((id) => {
      const s = semantic.get(id), l = lexical.get(id);
      return { id, score: (s ? 1 / (RRF + s) : 0) + (l ? 1 / (RRF + l) : 0), via: (s && l ? 'both' : s ? 'meaning' : 'text') as Hit['via'] };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Typed text is found exactly first (newest first), then meaning fills in. Entries must be newest-first. */
export function find(entries: Entry[], q: { text: string; vec?: Float32Array }, k = 60): Hit[] {
  const needle = q.text.trim().toLowerCase();
  const exact = needle ? entries.filter((e) => e.text.toLowerCase().includes(needle)) : [];
  const seen = new Set(exact.map((e) => e.id));
  const hits: Hit[] = exact.map((e) => ({ id: e.id, score: 1, via: 'text' }));
  for (const h of hybrid(entries, q, k)) if (!seen.has(h.id)) hits.push(h);
  return hits.slice(0, k);
}

export class Embedder {
  state: 'loading' | 'ready' | 'off' = 'loading';
  private w: Worker;
  private n = 0;
  private waiting = new Map<number, [(v: Float32Array[]) => void, (e: Error) => void]>();
  constructor(modelsDir: string, onState: (s: Embedder['state']) => void) {
    this.w = new Worker(new URL('./embed-worker.ts', import.meta.url), { workerData: { modelsDir } });
    this.w.on('message', (m) => {
      if (m.ready) return onState((this.state = 'ready'));
      const p = this.waiting.get(m.id);
      this.waiting.delete(m.id);
      if (m.error) p?.[1](new Error(m.error));
      else p?.[0](m.vecs.map((v: number[]) => Float32Array.from(v)));
    });
    this.w.on('error', () => this.fail(onState));
    this.w.on('exit', () => this.fail(onState));
  }
  private fail(onState: (s: Embedder['state']) => void) {
    onState((this.state = 'off'));
    for (const [, [, no]] of this.waiting) no(new Error('Smart search is not available'));
    this.waiting.clear();
  }
  embed(texts: string[]): Promise<Float32Array[]> {
    if (this.state === 'off') return Promise.reject(new Error('Smart search is not available'));
    return new Promise((ok, no) => {
      const id = ++this.n;
      this.waiting.set(id, [ok, no]);
      this.w.postMessage({ id, texts: texts.map((t) => t.slice(0, 1200)) });
    });
  }
  stop() {
    void this.w.terminate();
  }
}
