// Self-check for the logic that must not break: encryption, the encrypted log, ID detection, hybrid search.
//   npm run check
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { blob, derive, Log, seal, unseal } from './crypto.ts';
import { aadhaarOk, detect, luhn, mask, verhoeff } from './sensitive.ts';
import { find, hybrid, tokens, type Entry } from './search.ts';

// --- seal / unseal
const key = randomBytes(32);
assert.equal(unseal(key, seal(key, Buffer.from('aadhaar'))).toString(), 'aadhaar');
assert.throws(() => unseal(randomBytes(32), seal(key, Buffer.from('x'))), 'wrong key must fail');
const sealed = seal(key, Buffer.from('tamper me'));
sealed[sealed.length - 1] ^= 1;
assert.throws(() => unseal(key, sealed), 'a flipped bit must fail');

// --- the password key depends on password, salt AND the device secret
const salt = randomBytes(16), dev = randomBytes(32);
const k1 = await derive('correct horse', salt, dev);
assert.deepEqual(await derive('correct horse', salt, dev), k1);
assert.notDeepEqual(await derive('correct horsf', salt, dev), k1);
assert.notDeepEqual(await derive('correct horse', salt, randomBytes(32)), k1, 'a copied vault must not open on another PC');

// --- the encrypted log: persistence, deletes, a torn last write, compaction
const dir = mkdtempSync(join(tmpdir(), 'cv-check-'));
const f = join(dir, 'x.log');
let log = new Log<{ n: number }>(f, key).load();
log.put('a', { n: 1 });
log.put('b', { n: 2 });
log.put('a', { n: 3 });
log.del('b');
log = new Log<{ n: number }>(f, key).load();
assert.deepEqual([...log.rows], [['a', { n: 3 }]]);
assert.ok(!readFileSync(f).includes('"n"'), 'nothing readable on disk');
appendFileSync(f, Buffer.from([9, 9, 9, 9, 1, 2, 3])); // half-written record
const before = statSync(f).size;
log = new Log<{ n: number }>(f, key).load();
log.put('c', { n: 4 });
assert.equal(new Log<{ n: number }>(f, key).load().rows.size, 2, 'append after a torn tail must stay readable');
assert.ok(statSync(f).size < before + 200);
for (let i = 0; i < 300; i++) log.put('a', { n: i });
const grown = statSync(f).size;
assert.ok(new Log<{ n: number }>(f, key).load() && statSync(f).size < grown, 'compaction shrinks the file');
assert.throws(() => new Log(f, randomBytes(32)).load(), 'wrong key must not read the log');
blob.put(dir, 'img', key, Buffer.from('png-bytes'));
assert.equal(blob.get(dir, 'img', key).toString(), 'png-bytes');

// --- sensitive detection
const aad = (base: string) => base + [...'0123456789'].find((d) => verhoeff(base + d))!;
assert.ok(verhoeff('2363') && !verhoeff('2364'));
const good = aad('23456789012');
assert.ok(aadhaarOk(good) && !aadhaarOk(good.slice(0, 11) + ((+good[11] + 1) % 10)));
assert.equal(detect(good), 'aadhaar');
assert.equal(detect(good.replace(/(\d{4})(?=\d)/g, '$1 ')), 'aadhaar');
assert.equal(detect('ABCDE1234F'), 'pan');
assert.ok(luhn('4111111111111111') && !luhn('4111111111111112'));
assert.equal(detect('4111 1111 1111 1111'), 'card');
assert.equal(detect('482910'), 'otp');
assert.equal(detect('sk-abcdefghijklmnopqrstuvwx'), 'secret');
assert.equal(detect('eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4'), 'secret');
for (const plain of ['hello world', 'meeting at 5', '12345678901', 'https://example.com/a?b=1', 'ABCDE12345']) assert.equal(detect(plain), undefined, plain);
assert.equal(mask('2345 6789 0123'), '•••• •••• 0123');
assert.equal(mask('ABCDE1234F'), '••••••234F');

// --- search: exact text first, rare words beat common ones, meaning fills in, junk stays out
assert.deepEqual(tokens('The parking permits'), ['park', 'permit']);
const e = (id: string, text: string, vec?: number[]): Entry => ({ id, text, vec: vec && Float32Array.from(vec) });
const items = [
  e('car', 'Guests may park for 48 hours with a permit from form ORL-4471', [1, 0, 0, 0]),
  e('bike', 'The bike cage holds 60 bicycles, tag ORL-1182', [0, 1, 0, 0]),
  e('laundry', 'Laundry room is open 7 am until 10 pm', [0, 0, 1, 0]),
  e('noise', 'Quiet hours run 10 pm to 6 am', [0, 0.6, 0.8, 0]),
];
const top = (q: string, vec?: number[]) => hybrid(items, { text: q, vec: vec && Float32Array.from(vec) }).map((h) => h.id);
assert.equal(top('ORL-4471')[0], 'car', 'an exact code is found by keywords');
assert.deepEqual(top('', [0.1, 0.99, 0, 0]).slice(0, 1), ['bike'], 'a paraphrase is found by meaning');
assert.deepEqual(top('zzz unrelated', [0, 0, 0, 1]).filter((id) => id === 'car'), [], 'below the cosine floor nothing is returned');
assert.equal(find(items, { text: 'bicycl' })[0].id, 'bike', 'typed text matches as a substring');
assert.equal(find(items, { text: 'bicycl' })[0].via, 'text');
assert.equal(hybrid(items, { text: 'ORL-4471', vec: Float32Array.from([1, 0, 0, 0]) })[0].via, 'both');

console.log('electron/check.ts: all checks passed');
