// Clipboard history: watches the clipboard, keeps every item encrypted on disk, searches it in memory.
import { clipboard, ClipboardItem, nativeImage } from 'electron';
import { createHmac, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Item, Kind, PubItem, Settings } from '../src/app/models.ts';
import { b64ToF32, blob, f32ToB64, Log } from './crypto.ts';
import { clipSeq, isExcluded, owner, readFiles, writeFiles, writeText } from './native.ts';
import { detect, mask } from './sensitive.ts';
import { find, type Embedder, type Entry } from './search.ts';

const MAX_TEXT = 200_000;
const LIST_CAP = 3000; // ponytail: the list is capped here; search reaches everything. Page it if people keep >3k items on screen.

export interface HistoryDeps {
  dir: string;
  key: Buffer;
  settings: () => Settings;
  embedder: () => Embedder | undefined;
  changed: () => void;
}

export class History {
  log: Log<Item>;
  paused = false;
  private vecs = new Map<string, Float32Array>();
  private entries = new Map<string, Entry>();
  private byHash = new Map<string, string>();
  private thumbs = new Map<string, string>();
  private queue: string[] = [];
  private embedTimer?: NodeJS.Timeout;
  private lastSeq = 0;
  private ignoreSeq = 0;
  private busy = false;
  private timers: NodeJS.Timeout[] = [];

  private d: HistoryDeps;
  constructor(d: HistoryDeps) {
    this.d = d;
    this.log = new Log<Item>(join(d.dir, 'history.log'), d.key);
  }

  start(poll = true) {
    this.log.load();
    for (const [id, it] of this.log.rows) {
      this.byHash.set(it.hash, id);
      if (it.vec) this.vecs.set(id, b64ToF32(it.vec));
      this.entries.set(id, this.entry(it));
      if (!it.vec && this.embeddable(it)) this.queue.push(id);
    }
    this.sweep();
    this.scheduleEmbed();
    this.lastSeq = clipSeq(); // whatever is on the clipboard at launch was copied before we started
    if (poll) this.timers.push(setInterval(() => void this.tick(), 400));
    this.timers.push(setInterval(() => this.sweep(), 60_000));
  }
  stop() {
    this.timers.forEach(clearInterval);
    clearTimeout(this.embedTimer);
    this.d.key.fill(0);
  }

  // ---- capture ----------------------------------------------------------------------------------------------
  private async tick() {
    const seq = clipSeq();
    if (seq === this.lastSeq || this.busy) return;
    this.lastSeq = seq;
    if (seq <= this.ignoreSeq || this.paused || isExcluded()) return;
    this.busy = true;
    try {
      const app = owner();
      if (app && this.d.settings().ignoredApps.some((a) => a.toLowerCase() === app.toLowerCase())) return;
      await this.capture(app);
    } catch {
      /* the clipboard changed while we read it, or was busy: the next change is picked up normally */
    } finally {
      this.busy = false;
    }
  }

  private async capture(app?: string) {
    const files = await readFiles();
    if (files.length) return this.add('files', { files }, app);
    const text = await clipboard.readText();
    if (text.trim()) return this.add('text', { text: text.slice(0, MAX_TEXT) }, app);
    for (const it of await clipboard.read()) {
      const type = it.types.find((t) => t.startsWith('image/'));
      if (type) return this.add('image', { png: Buffer.from(await (await it.getType(type) as Blob).arrayBuffer()) }, app);
    }
  }

  /** Public so the demo seeder and checks can add items without a real clipboard. */
  add(kind: Kind, c: { text?: string; files?: string[]; png?: Buffer }, app?: string, at = Date.now()) {
    const body = kind === 'text' ? c.text! : kind === 'files' ? c.files!.join('\n') : c.png!;
    const hash = createHmac('sha256', this.d.key).update(kind).update(body).digest('hex').slice(0, 32);
    const seen = this.byHash.get(hash);
    if (seen) {
      const it = this.log.rows.get(seen)!;
      this.put({ ...it, at, hits: it.hits + 1 });
      return this.d.changed();
    }
    const it: Item = { id: randomUUID(), kind, at, first: at, hits: 1, hash, app, pinned: false };
    if (kind === 'text') {
      it.text = c.text;
      it.sensitive = detect(c.text!);
      if (it.sensitive) {
        const min = it.sensitive === 'otp' ? Math.min(10, this.d.settings().sensitiveMinutes) : this.d.settings().sensitiveMinutes;
        if (min > 0) it.expires = at + min * 60_000;
      }
    } else if (kind === 'files') {
      it.files = c.files;
    } else {
      const size = nativeImage.createFromBuffer(c.png!).getSize();
      it.blob = it.id;
      it.w = size.width;
      it.h = size.height;
      it.bytes = c.png!.length;
      blob.put(this.d.dir + '/blobs', it.id, this.d.key, c.png!);
    }
    this.byHash.set(hash, it.id);
    this.put(it);
    if (this.embeddable(it)) {
      this.queue.push(it.id);
      this.scheduleEmbed();
    }
    this.d.changed();
  }

  private put(it: Item) {
    const vec = this.vecs.get(it.id);
    if (vec) it.vec = f32ToB64(vec);
    this.log.put(it.id, it);
    this.entries.set(it.id, { ...this.entry(it), vec, set: this.entries.get(it.id)?.set });
  }
  private entry(it: Item): Entry {
    const text = it.kind === 'text' ? it.text! : it.kind === 'files' ? it.files!.map((f) => basename(f) + ' ' + f).join('\n') : `screenshot image ${it.w}x${it.h}`;
    return { id: it.id, text, vec: this.vecs.get(it.id) };
  }

  // ---- smart search index -----------------------------------------------------------------------------------
  private embeddable = (it: Item) => !!this.d.settings().semantic && !it.sensitive && ((it.kind === 'text' && it.text!.trim().length >= 3) || it.kind === 'files');
  private scheduleEmbed() {
    if (this.embedTimer || !this.queue.length) return;
    this.embedTimer = setTimeout(async () => {
      this.embedTimer = undefined;
      const emb = this.d.embedder();
      if (!emb || emb.state !== 'ready') return emb?.state === 'loading' ? this.scheduleEmbed() : undefined;
      const ids = this.queue.splice(0, 16).filter((id) => this.log.rows.has(id));
      try {
        const vecs = await emb.embed(ids.map((id) => this.entries.get(id)!.text));
        ids.forEach((id, i) => {
          this.vecs.set(id, vecs[i]);
          this.put(this.log.rows.get(id)!);
        });
      } catch {
        return; // smart search went away: keep the plain keyword search working
      }
      this.scheduleEmbed();
    }, 300);
  }
  /** Called when the embedder finishes loading, to start indexing what was waiting. */
  embedderReady = () => this.scheduleEmbed();

  // ---- reading ----------------------------------------------------------------------------------------------
  pub(it: Item, via?: PubItem['via']): PubItem {
    const preview =
      it.kind === 'text'
        ? it.sensitive
          ? mask(it.text!.trim().slice(0, 60))
          : it.text!.replace(/\s+/g, ' ').trim().slice(0, 300)
        : it.kind === 'files'
          ? it.files!.map((f) => basename(f)).join(', ')
          : `Screenshot ${it.w}×${it.h}`;
    return {
      id: it.id, kind: it.kind, at: it.at, pinned: !!it.pinned, preview, sensitive: it.sensitive, expires: it.expires, app: it.app, via,
      length: it.kind === 'text' ? it.text!.length : undefined, w: it.w, h: it.h, bytes: it.bytes, files: it.files,
    };
  }

  list(kind?: Kind | 'pinned'): PubItem[] {
    let rows = [...this.log.rows.values()].sort((a, b) => b.at - a.at);
    if (kind === 'pinned') rows = rows.filter((r) => r.pinned);
    else if (kind) rows = rows.filter((r) => r.kind === kind);
    return rows.slice(0, LIST_CAP).map((r) => this.pub(r));
  }

  async search(q: string, kind?: Kind | 'pinned'): Promise<PubItem[]> {
    if (!q.trim()) return this.list(kind);
    const keep = (it: Item) => (kind === 'pinned' ? it.pinned : kind ? it.kind === kind : true);
    const sorted = [...this.entries.values()].filter((e) => keep(this.log.rows.get(e.id)!)).sort((a, b) => this.log.rows.get(b.id)!.at - this.log.rows.get(a.id)!.at);
    let vec: Float32Array | undefined;
    const emb = this.d.embedder();
    if (emb?.state === 'ready' && this.d.settings().semantic && q.trim().length >= 3) vec = (await emb.embed([q]).catch(() => [undefined]))[0];
    return find(sorted, { text: q, vec }).map((h) => this.pub(this.log.rows.get(h.id)!, h.via === 'meaning' ? 'meaning' : 'text'));
  }

  full(id: string) {
    const it = this.log.rows.get(id);
    return it?.kind === 'text' && !it.sensitive ? it.text : undefined;
  }
  reveal(id: string) {
    return this.log.rows.get(id)?.text;
  }
  png(id: string) {
    const it = this.log.rows.get(id);
    return it?.blob ? blob.get(this.d.dir + '/blobs', it.blob, this.d.key) : undefined;
  }
  thumb(id: string, width = 360) {
    const key = id + width;
    let url = this.thumbs.get(key);
    if (!url) {
      const png = this.png(id);
      if (!png) return undefined;
      const img = nativeImage.createFromBuffer(png);
      url = (img.getSize().width > width ? img.resize({ width, quality: 'good' }) : img).toDataURL();
      if (this.thumbs.size > 300) this.thumbs.delete(this.thumbs.keys().next().value!);
      this.thumbs.set(key, url);
    }
    return url;
  }
  saveImage(id: string, to: string) {
    const png = this.png(id);
    if (png) writeFileSync(to, png);
  }

  // ---- actions ----------------------------------------------------------------------------------------------
  /** Write text to the clipboard without our own watcher re-capturing it. Secrets skip Windows history and clear themselves. */
  async copyText(text: string, secret: boolean) {
    await writeText(text, secret);
    this.ignoreSeq = this.lastSeq = clipSeq();
    if (secret) {
      const after = this.lastSeq, sec = this.d.settings().clearSecretSec;
      if (sec > 0) setTimeout(() => clipSeq() === after && clipboard.clear(), sec * 1000).unref();
    }
  }
  async copy(id: string) {
    const it = this.log.rows.get(id);
    if (!it) return;
    if (it.kind === 'text') await this.copyText(it.text!, !!it.sensitive);
    else if (it.kind === 'files') await this.copyFiles(it.files!);
    else {
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(this.png(id)!)], { type: 'image/png' }) })]);
      this.ignoreSeq = this.lastSeq = clipSeq();
    }
  }
  async copyFiles(paths: string[]) {
    await writeFiles(paths);
    this.ignoreSeq = this.lastSeq = clipSeq();
  }
  pin(id: string, pinned: boolean) {
    const it = this.log.rows.get(id);
    if (it) this.put({ ...it, pinned, expires: pinned ? undefined : it.expires });
    this.d.changed();
  }
  remove(ids: string[]) {
    for (const id of ids) {
      const it = this.log.rows.get(id);
      if (!it) continue;
      this.log.del(id);
      if (it.blob) blob.del(this.d.dir + '/blobs', it.blob);
      this.byHash.delete(it.hash);
      this.vecs.delete(id);
      this.entries.delete(id);
    }
    this.d.changed();
  }
  clear(keepPinned = true) {
    this.remove([...this.log.rows.values()].filter((i) => !(keepPinned && i.pinned)).map((i) => i.id));
  }
  get count() {
    return this.log.rows.size;
  }

  /** Expired secrets and, if the user chose a retention period, old items. Pinned items stay. */
  sweep(now = Date.now()) {
    const days = this.d.settings().keepDays;
    const gone = [...this.log.rows.values()].filter((i) => !i.pinned && ((i.expires && i.expires < now) || (days > 0 && i.at < now - days * 86_400_000)));
    if (gone.length) this.remove(gone.map((i) => i.id));
  }
}
