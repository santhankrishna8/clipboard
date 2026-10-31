// Encryption primitives and the encrypted append-only log every tier of data is stored in.
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const cat = Buffer.concat;

/** AES-256-GCM: iv (12) + auth tag (16) + ciphertext. Any wrong key or tampered byte fails `unseal`. */
export function seal(key: Buffer, data: Uint8Array): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const ct = cat([c.update(data), c.final()]);
  return cat([iv, c.getAuthTag(), ct]);
}
export function unseal(key: Buffer, blob: Uint8Array): Buffer {
  const b = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
  const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return cat([d.update(b.subarray(28)), d.final()]);
}

/**
 * Password -> 256-bit key. The device secret (sealed to this Windows user by DPAPI) is mixed in, so a stolen
 * vault file is useless on another PC even with the right password. Backups pass an empty device secret.
 */
export function derive(password: string, salt: Buffer, device: Buffer): Promise<Buffer> {
  return new Promise((ok, fail) =>
    scrypt(cat([Buffer.from(password.normalize('NFKC'), 'utf8'), device]), salt, 32, { N: 1 << 16, r: 8, p: 1, maxmem: 256 << 20 }, (e, k) =>
      e ? fail(e) : ok(k),
    ),
  );
}

export const f32ToB64 = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
export function b64ToF32(s: string): Float32Array {
  const b = Buffer.from(s, 'base64');
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

function writeAtomic(file: string, data: Uint8Array) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

/**
 * Key-value rows in one file. Each change is a sealed record appended to the end (length-prefixed), so a
 * copy never rewrites the whole history, and a crash can only tear the last record, which `load` drops.
 */
export class Log<V extends object> {
  rows = new Map<string, V>();
  private dead = 0;
  readonly file: string;
  private key: Buffer;
  constructor(file: string, key: Buffer) {
    this.file = file;
    this.key = key;
  }

  load() {
    if (!existsSync(this.file)) return this;
    const buf = readFileSync(this.file);
    let o = 0;
    while (o + 4 <= buf.length) {
      const n = buf.readUInt32LE(o);
      if (o + 4 + n > buf.length) break;
      const r = JSON.parse(unseal(this.key, buf.subarray(o + 4, o + 4 + n)).toString('utf8'));
      if (r.d) this.rows.delete(r.k);
      else this.rows.set(r.k, r.v);
      this.dead++;
      o += 4 + n;
    }
    if (o < buf.length) truncateSync(this.file, o); // torn tail from a crash: appending after it would corrupt the framing
    this.dead -= this.rows.size;
    if (this.dead > this.rows.size + 200) this.compact();
    return this;
  }
  put(k: string, v: V) {
    if (this.rows.has(k)) this.dead++;
    this.rows.set(k, v);
    this.append({ k, v });
  }
  del(k: string) {
    if (this.rows.delete(k)) {
      this.dead += 2;
      this.append({ k, d: 1 });
    }
  }
  compact() {
    const parts: Buffer[] = [];
    for (const [k, v] of this.rows) parts.push(this.frame({ k, v }));
    writeAtomic(this.file, cat(parts));
    this.dead = 0;
  }
  private frame(r: object) {
    const s = seal(this.key, Buffer.from(JSON.stringify(r)));
    const h = Buffer.alloc(4);
    h.writeUInt32LE(s.length);
    return cat([h, s]);
  }
  private append(r: object) {
    mkdirSync(dirname(this.file), { recursive: true });
    appendFileSync(this.file, this.frame(r));
  }
}

/** Whole files (images, documents) sealed one by one under `<dir>/<id>`. */
export const blob = {
  put: (dir: string, id: string, key: Buffer, data: Uint8Array) => writeAtomic(join(dir, id), seal(key, data)),
  get: (dir: string, id: string, key: Buffer) => unseal(key, readFileSync(join(dir, id))),
  del: (dir: string, id: string) => rmSync(join(dir, id), { force: true }),
};
