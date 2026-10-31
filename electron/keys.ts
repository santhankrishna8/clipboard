// meta.json: the only unencrypted file. It holds sealed keys, never a plain one.
//   hist   history key, sealed by Windows DPAPI (this Windows user on this PC only)
//   device secret mixed into the vault password key, also sealed by DPAPI
//   salt/wrapped   the vault key, wrapped by the password-derived key
import { safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Meta {
  hist?: string;
  device?: string;
  salt?: string;
  wrapped?: string;
}

export class Keys {
  meta: Meta = {};
  private file: string;
  private dir: string;
  constructor(dir: string) {
    this.dir = dir;
    this.file = join(dir, 'meta.json');
    if (existsSync(this.file)) this.meta = JSON.parse(readFileSync(this.file, 'utf8'));
  }
  save() {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file + '.tmp', JSON.stringify(this.meta, null, 1));
    renameSync(this.file + '.tmp', this.file);
  }

  private async dpapi(field: 'hist' | 'device', create: boolean): Promise<Buffer | undefined> {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('Windows data protection is not available for this user');
    const sealed = this.meta[field];
    if (sealed) return Buffer.from((await safeStorage.decryptStringAsync(Buffer.from(sealed, 'base64'))).result, 'base64');
    if (!create) return undefined;
    const key = randomBytes(32);
    this.meta[field] = (await safeStorage.encryptStringAsync(key.toString('base64'))).toString('base64');
    this.save();
    return key;
  }
  /** Throws if this data was sealed by another Windows user or another PC. */
  historyKey = () => this.dpapi('hist', true) as Promise<Buffer>;
  device = (create = false) => this.dpapi('device', create);

  get hasVault() {
    return !!this.meta.wrapped;
  }
}
