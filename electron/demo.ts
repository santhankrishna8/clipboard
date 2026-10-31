// Demo mode (CLIPVAULT_DEMO=1): a throwaway data folder filled with SYNTHETIC history, ID cards and PDFs, so screenshots,
// the website and a recruiter's first launch never contain anyone's real details. Vault password: clipvault-demo
import { nativeImage } from 'electron';
import type { Field } from '../src/app/models.ts';
import type { History } from './history.ts';
import { verhoeff } from './sensitive.ts';
import type { Embedder } from './search.ts';
import type { Vault } from './vault.ts';

export const DEMO_PASSWORD = 'clipvault-demo';
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

/** A small valid PDF (Helvetica text pages), good enough to preview and search. */
export function makePdf(pages: string[][]): Uint8Array {
  const objs: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids: number[] = [];
  const wrap = (l: string) => l.match(/.{1,68}(\s|$)/g)?.map((x) => x.trim()) ?? [l]; // a real page wraps its lines
  for (const lines of pages) {
    const body = 'BT /F1 12 Tf 56 780 Td 20 TL ' + lines.flatMap(wrap).map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`).join(' ') + ' ET';
    const c = objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    kids.push(objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${c} 0 R >>`));
  }
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const at = objs.map((o, i) => {
    const p = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return p;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + at.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

/** A flat fake "screenshot": window chrome and blocks, enough to look like one in a thumbnail. */
function fakeShot(w: number, h: number, hue: [number, number, number]): Buffer {
  const px = Buffer.alloc(w * h * 4);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => {
    for (let y = y0; y < Math.min(y1, h); y++) for (let x = x0; x < Math.min(x1, w); x++) px.set([c[2], c[1], c[0], 255], (y * w + x) * 4);
  };
  rect(0, 0, w, h, [244, 244, 242]);
  rect(0, 0, w, 44, [255, 255, 255]);
  rect(0, 44, 220, h, [236, 236, 232]);
  rect(260, 90, w - 40, 150, hue);
  for (let i = 0; i < 4; i++) rect(260 + i * Math.floor((w - 320) / 4), 190, 260 + (i + 1) * Math.floor((w - 320) / 4) - 24, 330, [255, 255, 255]);
  for (let i = 0; i < 6; i++) rect(260, 370 + i * 44, 260 + Math.floor((w - 320) * (0.9 - i * 0.1)), 392 + i * 44, [226, 226, 222]);
  return nativeImage.createFromBitmap(px, { width: w, height: h }).toPNG();
}

const aadhaar = (() => {
  const base = '23456789012';
  return base + [...'0123456789'].find((d) => verhoeff(base + d))!;
})();
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function seedDemo(history: History, vault: Vault, _embedder: () => Embedder | undefined) {
  const now = Date.now();
  const add = (ago: number, text: string, app: string) => history.add('text', { text }, app, now - ago);
  add(2 * MIN, 'Flight 6E 2145 · Hyderabad → Bengaluru · 14 Nov, 06:40 · PNR K4X9QZ', 'WhatsApp');
  add(9 * MIN, 'https://www.incometax.gov.in/iec/foportal/', 'Edge');
  add(14 * MIN, 'Hi Priya, sharing the rent receipt for October. Please confirm once received. Thanks!', 'Outlook');
  history.add('text', { text: '482910' }, 'Messages', now - 3 * MIN); // reads as an OTP: masked and short-lived
  history.add('text', { text: 'ABCDE1234F' }, 'Chrome', now - 25 * MIN); // reads as a PAN
  add(41 * MIN, 'Rent for November — UPI ID asha.rao@okexample — ₹18,500', 'Notepad');
  history.add('image', { png: fakeShot(1280, 720, [39, 65, 155]) }, 'Snipping Tool', now - 52 * MIN);
  history.add('files', { files: ['C:\\Users\\asha\\Downloads\\invoice_oct_2026.pdf'] }, 'Explorer', now - 80 * MIN);
  add(3 * HOUR, 'SELECT customer_id, SUM(amount) FROM payments WHERE paid_on >= DATE "2026-10-01" GROUP BY customer_id;', 'VS Code');
  add(5 * HOUR, 'Meeting with the vendor moved to Thursday 4 pm, conference room B. Bring the signed purchase order.', 'Teams');
  add(8 * HOUR, '14, 2nd Cross, Jayanagar 4th Block, Bengaluru 560011', 'Chrome');
  history.add('image', { png: fakeShot(1280, 720, [46, 125, 90]) }, 'Snipping Tool', now - 9 * HOUR);
  add(DAY + HOUR, 'npm install @huggingface/transformers koffi', 'Terminal');
  add(DAY + 3 * HOUR, 'Dear hiring team, I am writing to apply for the Software Engineer role advertised on your careers page.', 'Word');
  add(DAY + 6 * HOUR, 'Wi-Fi password for the guest network: lemon-orchid-4417', 'Notepad');
  history.add('files', { files: ['C:\\Users\\asha\\Documents\\lease_2026.pdf', 'C:\\Users\\asha\\Documents\\photo_id.jpg'] }, 'Explorer', now - DAY - 7 * HOUR);
  add(2 * DAY, 'Electricity bill number 1104 2237 9086 — due 18 Nov — pay before 5 pm to avoid the late fee', 'Chrome');
  add(2 * DAY + 4 * HOUR, 'Reminder: renew the driving licence before it expires, take two passport photos and the old card.', 'Notes');
  add(3 * DAY, 'https://www.irctc.co.in/nget/train-search', 'Edge');
  add(4 * DAY, 'Order #88213 delivered. Return window closes on 2 November.', 'Gmail');
  add(6 * DAY, 'Pick up the parcel from the society office, flat 304, before 8 pm.', 'WhatsApp');
  history.pin(([...history.log.rows.values()].find((i) => i.text?.startsWith('Rent for')) ?? { id: '' }).id, true);

  await vault.setup(DEMO_PASSWORD);
  const f = (key: string, label: string, value: string, secret = false): Field => ({ key, label, value, secret });
  const card = (kind: 'aadhaar' | 'pan' | 'dl' | 'passport' | 'voter' | 'bank', title: string, fields: Field[]) =>
    vault.saveCard({ id: crypto.randomUUID(), kind, title, fields });
  card('aadhaar', 'Aadhaar', [f('name', 'Name on card', 'Asha Rao'), f('number', 'Aadhaar number', aadhaar.replace(/(\d{4})(?=\d)/g, '$1 '), true)]);
  card('pan', 'PAN card', [f('name', 'Name on card', 'Asha Rao'), f('number', 'PAN', 'ABCDE1234F', true)]);
  card('dl', 'Driving licence', [f('name', 'Name', 'Asha Rao'), f('number', 'Licence number', 'KA05 20180123456', true), f('expiry', 'Valid till', iso(now + 38 * DAY))]);
  card('passport', 'Passport', [f('name', 'Name', 'Asha Rao'), f('number', 'Passport number', 'Z1234567', true), f('expiry', 'Valid till', iso(now + 2400 * DAY))]);
  card('bank', 'Sample Bank · savings', [f('bank', 'Bank', 'Sample Co-operative Bank'), f('holder', 'Account holder', 'Asha Rao'), f('number', 'Account number', '004512345678', true), f('ifsc', 'IFSC', 'SMPL0000123'), f('upi', 'UPI ID', 'asha.rao@okexample')]);
  card('voter', 'Voter ID', [f('name', 'Name', 'Asha Rao'), f('number', 'EPIC number', 'XYZ1234567', true)]);

  const doc = (name: string, pages: string[][]) =>
    vault.addDoc({ name, mime: 'application/pdf', bytes: makePdf(pages), pages: pages.map((l, i) => ({ page: i + 1, text: l.join(' ') })) });
  await doc('Bank statement - October 2026.pdf', [
    ['SAMPLE CO-OPERATIVE BANK', 'Statement of account, 1 to 31 October 2026', 'Account holder: Asha Rao   Account number ending 5678   IFSC SMPL0000123', 'Opening balance 84,210.00', 'Salary credit 62,000.00 on 01 Oct   Rent paid 18,500.00 on 02 Oct'],
    ['Electricity bill 2,140.00 on 09 Oct', 'Insurance premium 12,800.00 on 15 Oct', 'Closing balance 96,370.00', 'This is a synthetic demo document.'],
  ]);
  await doc('Rental agreement 2026.pdf', [
    ['RESIDENTIAL LEASE AGREEMENT', 'Landlord: Mr. Kiran Shetty   Tenant: Asha Rao', 'Property: Flat 304, Lakeview Residency, Jayanagar, Bengaluru', 'Monthly rent 18,500 payable by the fifth of each month. Security deposit 55,500 refundable within 30 days of vacating.', 'The tenancy runs for eleven months from 1 June 2026 and may be renewed with sixty days notice.'],
  ]);
  await doc('Health insurance policy.pdf', [
    ['HEALTH INSURANCE POLICY SCHEDULE', 'Policy holder: Asha Rao   Sum insured 5,00,000', 'Cashless hospitalisation at network hospitals. Pre-existing conditions covered after a waiting period of two years.', 'Claims helpline is open around the clock.'],
  ]);
}
