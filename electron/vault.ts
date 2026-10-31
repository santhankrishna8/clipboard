// The password-protected side: ID cards and documents. Locked = the key is gone from memory and so is every row.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TEMPLATES, type Card, type DocHit, type DocMeta, type PubCard, type PubField, type Settings } from '../src/app/models.ts';
import { chunk } from './chunk.ts';
import { b64ToF32, blob, derive, f32ToB64, Log, seal, unseal } from './crypto.ts';
import type { Keys } from './keys.ts';
import { digitsOf, fieldWarning, mask } from '../src/app/validate.ts';
import { find, type Embedder, type Entry } from './search.ts';

type Row = ({ t: 'card' } & Card) | ({ t: 'doc' } & DocMeta) | { t: 'chunk'; doc: string; page: number | null; text: string; vec?: string };

const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');

export interface VaultDeps {
  dir: string;
  keys: Keys;
  settings: () => Settings;
  embedder: () => Embedder | undefined;
  changed: () => void;
}

export class Vault {
  private key?: Buffer;
  private log?: Log<Row>;
  private vecs = new Map<string, Float32Array>();
  private entries = new Map<string, Entry>();
  private idle?: NodeJS.Timeout;
  private fails = 0;
  private lockedUntil = 0;
  private temps = new Set<string>();

  private d: VaultDeps;
  constructor(d: VaultDeps) {
    this.d = d;
  }

  get state() {
    return this.key ? 'unlocked' : this.d.keys.hasVault ? 'locked' : 'none';
  }
  private need(): { key: Buffer; log: Log<Row> } {
    if (!this.key || !this.log) throw new Error('The vault is locked');
    this.touch();
    return { key: this.key, log: this.log };
  }
  /** Any vault activity postpones auto-lock. */
  touch() {
    clearTimeout(this.idle);
    const min = this.d.settings().autoLockMin;
    if (this.key && min > 0) this.idle = setTimeout(() => this.lock(), min * 60_000);
  }

  // ---- password ---------------------------------------------------------------------------------------------
  async setup(password: string) {
    if (password.length < 8) throw new Error('Use at least 8 characters');
    if (this.d.keys.hasVault) throw new Error('A vault already exists');
    const device = (await this.d.keys.device(true))!, salt = randomBytes(16), key = randomBytes(32);
    this.d.keys.meta.salt = salt.toString('base64');
    this.d.keys.meta.wrapped = seal(await derive(password, salt, device), key).toString('base64');
    this.d.keys.save();
    this.open(key);
  }
  async unlock(password: string) {
    if (Date.now() < this.lockedUntil) throw new Error(`Too many attempts. Try again in ${Math.ceil((this.lockedUntil - Date.now()) / 1000)} seconds`);
    const { salt, wrapped } = this.d.keys.meta;
    if (!salt || !wrapped) throw new Error('There is no vault yet');
    try {
      const kek = await derive(password, Buffer.from(salt, 'base64'), (await this.d.keys.device())!);
      this.open(unseal(kek, Buffer.from(wrapped, 'base64')));
      this.fails = 0;
    } catch (e) {
      if (this.key) throw e;
      if (++this.fails >= 5) {
        this.fails = 0;
        this.lockedUntil = Date.now() + 30_000;
      }
      throw new Error('That password is not right');
    }
  }
  async change(oldPw: string, newPw: string) {
    if (newPw.length < 8) throw new Error('Use at least 8 characters');
    const { key } = this.need();
    const { salt, wrapped } = this.d.keys.meta, device = (await this.d.keys.device())!;
    try {
      unseal(await derive(oldPw, Buffer.from(salt!, 'base64'), device), Buffer.from(wrapped!, 'base64'));
    } catch {
      throw new Error('The current password is not right');
    }
    const fresh = randomBytes(16);
    this.d.keys.meta.salt = fresh.toString('base64');
    this.d.keys.meta.wrapped = seal(await derive(newPw, fresh, device), key).toString('base64');
    this.d.keys.save();
  }

  private open(key: Buffer) {
    this.key = key;
    this.log = new Log<Row>(join(this.d.dir, 'vault.log'), key).load();
    for (const [id, r] of this.log.rows) if (r.t === 'chunk') this.index(id, r);
    this.touch();
    this.d.changed();
  }
  private index(id: string, r: Extract<Row, { t: 'chunk' }>) {
    if (r.vec) this.vecs.set(id, b64ToF32(r.vec));
    this.entries.set(id, { id, text: r.text, vec: this.vecs.get(id) });
  }
  lock() {
    clearTimeout(this.idle);
    this.key?.fill(0);
    this.key = this.log = undefined;
    this.vecs.clear();
    this.entries.clear();
    this.wipeTemp();
    this.d.changed();
  }

  // ---- ID cards ---------------------------------------------------------------------------------------------
  private rows<T extends Row['t']>(t: T): Extract<Row, { t: T }>[] {
    return [...this.need().log.rows.values()].filter((r): r is Extract<Row, { t: T }> => r.t === t);
  }
  private pubCard(c: Card): PubCard {
    const fields: PubField[] = c.fields.map((f) => ({ key: f.key, label: f.label, secret: !!f.secret, shown: f.secret ? mask(f.value) : f.value, warn: fieldWarning(c.kind, f.key, f.value) }));
    const expiry = Date.parse(c.fields.find((f) => f.key === 'expiry')?.value ?? '');
    return { id: c.id, kind: c.kind, title: c.title, fields, updated: c.updated, expiry: Number.isNaN(expiry) ? undefined : expiry };
  }
  cards(): PubCard[] {
    const order = Object.keys(TEMPLATES);
    return this.rows('card').sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.title.localeCompare(b.title)).map((c) => this.pubCard(c));
  }
  card(id: string): Card | undefined {
    const r = this.need().log.rows.get(id);
    return r?.t === 'card' ? r : undefined;
  }
  saveCard(input: Omit<Card, 'added' | 'updated'> & Partial<Pick<Card, 'added'>>) {
    const { log } = this.need();
    const old = this.card(input.id);
    const fields = input.fields
      .map((f) => ({ ...f, value: f.value.trim() }))
      .map((f) => (input.kind === 'pan' && f.key === 'number' ? { ...f, value: f.value.toUpperCase() } : f))
      .filter((f) => f.value || f.label);
    if (!input.title.trim()) throw new Error('Give the card a name');
    const now = Date.now();
    log.put(input.id, { t: 'card', ...input, title: input.title.trim(), fields, added: old?.added ?? now, updated: now });
    this.d.changed();
  }
  removeCard(id: string) {
    this.need().log.del(id);
    this.d.changed();
  }
  /** The text a Copy button puts on the clipboard (Aadhaar without spaces, so any form accepts it). */
  fieldValue(cardId: string, key: string): string {
    const c = this.card(cardId), f = c?.fields.find((x) => x.key === key);
    if (!c || !f) throw new Error('That field no longer exists');
    return c.kind === 'aadhaar' && key === 'number' ? digitsOf(f.value) : f.value;
  }
  /** Every field as a quick-paste row: used by the hotkey popup. */
  allFields() {
    return this.rows('card').flatMap((c) => c.fields.filter((f) => f.value).map((f) => ({ card: c, field: f })));
  }

  // ---- documents --------------------------------------------------------------------------------------------
  docs(): DocMeta[] {
    return this.rows('doc').sort((a, b) => b.added - a.added).map(({ t, ...d }) => d);
  }
  doc(id: string): DocMeta | undefined {
    const r = this.need().log.rows.get(id);
    if (r?.t !== 'doc') return undefined;
    const { t, ...d } = r;
    return d;
  }
  async addDoc(input: { name: string; mime: string; bytes: Uint8Array; pages: { page: number; text: string }[] }): Promise<DocMeta> {
    const { key, log } = this.need();
    const id = randomUUID();
    const passages = input.pages.flatMap((p) => chunk(p.text).map((text) => ({ page: p.page, text })));
    const emb = this.d.embedder();
    let vecs: Float32Array[] = [];
    if (emb?.state === 'ready' && this.d.settings().semantic) {
      try {
        for (let i = 0; i < passages.length; i += 16) vecs.push(...(await emb.embed(passages.slice(i, i + 16).map((p) => p.text))));
      } catch {
        vecs = []; // saved without smart search; keyword search still works
      }
    }
    blob.put(join(this.d.dir, 'blobs'), id, key, input.bytes);
    passages.forEach((p, i) => {
      const row: Extract<Row, { t: 'chunk' }> = { t: 'chunk', doc: id, page: p.page, text: p.text, vec: vecs[i] && f32ToB64(vecs[i]) };
      log.put(`${id}:${i}`, row);
      this.index(`${id}:${i}`, row);
    });
    const meta: DocMeta = { id, name: input.name, mime: input.mime, size: input.bytes.length, pages: input.pages.length, added: Date.now(), blob: id, chunks: passages.length };
    log.put(id, { t: 'doc', ...meta });
    this.d.changed();
    return meta;
  }
  docBytes(id: string): Buffer {
    const { key } = this.need();
    return blob.get(join(this.d.dir, 'blobs'), this.doc(id)!.blob, key);
  }
  removeDoc(id: string) {
    const { log } = this.need();
    const meta = this.doc(id);
    if (!meta) return;
    for (const [k, r] of log.rows) if (r.t === 'chunk' && r.doc === id) {
      log.del(k);
      this.vecs.delete(k);
      this.entries.delete(k);
    }
    log.del(id);
    blob.del(join(this.d.dir, 'blobs'), meta.blob);
    this.d.changed();
  }

  async searchDocs(q: string): Promise<DocHit[]> {
    const { log } = this.need();
    const needle = q.trim().toLowerCase();
    const docs = this.docs();
    if (!needle) return docs.map((doc) => ({ doc, page: null, snippet: '', passage: '', via: 'name' }));
    const hits: DocHit[] = docs.filter((d) => d.name.toLowerCase().includes(needle)).map((doc) => ({ doc, page: null, snippet: '', passage: '', via: 'name' }));
    const seen = new Set(hits.map((h) => h.doc.id));
    let vec: Float32Array | undefined;
    const emb = this.d.embedder();
    if (emb?.state === 'ready' && this.d.settings().semantic && needle.length >= 3) vec = (await emb.embed([q]).catch(() => [undefined]))[0];
    const byRecency = [...this.entries.values()].sort((a, b) => (log.rows.get(b.id) as { doc: string }).doc.localeCompare((log.rows.get(a.id) as { doc: string }).doc));
    for (const h of find(byRecency, { text: q, vec }, 40)) {
      const r = log.rows.get(h.id) as Extract<Row, { t: 'chunk' }>;
      const doc = this.doc(r.doc);
      if (!doc || seen.has(doc.id)) continue; // best passage per document
      seen.add(doc.id);
      const at = r.text.toLowerCase().indexOf(needle);
      const from = at > 60 ? at - 60 : 0;
      hits.push({ doc, page: r.page, snippet: (from ? '…' : '') + r.text.slice(from, from + 200), passage: r.text, via: h.via === 'meaning' ? 'meaning' : 'text' });
    }
    return hits;
  }

  // ---- decrypted copies for opening, dragging and attaching ----------------------------------------------------
  /** A decrypted copy in the temp folder, deleted after two minutes and whenever the vault locks. */
  tempFile(id: string): string {
    const meta = this.doc(id);
    if (!meta) throw new Error('That document no longer exists');
    const dir = join(tmpdir(), 'clipvault-' + randomBytes(6).toString('hex'));
    mkdirSync(dir, { recursive: true });
    const file = join(dir, clean(meta.name));
    writeFileSync(file, this.docBytes(id));
    this.temps.add(dir);
    setTimeout(() => this.drop(dir), 120_000).unref();
    return file;
  }
  private drop(dir: string) {
    rmSync(dir, { recursive: true, force: true });
    this.temps.delete(dir);
  }
  wipeTemp() {
    [...this.temps].forEach((d) => this.drop(d));
  }

  // ---- backup -------------------------------------------------------------------------------------------------
  /** One file, sealed with its own passphrase and no device secret, so it can restore the vault on a new PC. */
  async exportBackup(passphrase: string, file: string) {
    const { log, key } = this.need();
    if (passphrase.length < 8) throw new Error('Use at least 8 characters for the backup passphrase');
    const blobs: Record<string, string> = {};
    for (const r of log.rows.values()) if (r.t === 'doc') blobs[r.blob] = blob.get(join(this.d.dir, 'blobs'), r.blob, key).toString('base64');
    const salt = randomBytes(16);
    const data = seal(await derive(passphrase, salt, Buffer.alloc(0)), Buffer.from(JSON.stringify({ rows: [...log.rows], blobs })));
    writeFileSync(file, JSON.stringify({ app: 'clipvault-backup', v: 1, salt: salt.toString('base64'), data: data.toString('base64') }));
  }
  async importBackup(passphrase: string, file: string) {
    const { log, key } = this.need();
    if (!existsSync(file)) throw new Error('That file does not exist');
    const f = JSON.parse(readFileSync(file, 'utf8'));
    if (f.app !== 'clipvault-backup') throw new Error('That is not a Clipvault backup');
    let payload: { rows: [string, Row][]; blobs: Record<string, string> };
    try {
      payload = JSON.parse(unseal(await derive(passphrase, Buffer.from(f.salt, 'base64'), Buffer.alloc(0)), Buffer.from(f.data, 'base64')).toString('utf8'));
    } catch {
      throw new Error('The passphrase is not right, or the file is damaged');
    }
    for (const [id, data] of Object.entries(payload.blobs)) blob.put(join(this.d.dir, 'blobs'), id, key, Buffer.from(data, 'base64'));
    for (const [k, r] of payload.rows) {
      log.put(k, r);
      if (r.t === 'chunk') this.index(k, r);
    }
    this.d.changed();
    return payload.rows.length;
  }
}
