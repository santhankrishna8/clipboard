// Spots clipboard text that should not sit in history in the clear: OTPs, Aadhaar, PAN, card numbers, tokens.
import type { SensitiveKind } from '../src/app/models.ts';

import { aadhaarOk, luhn, PAN } from '../src/app/validate.ts';
export { aadhaarOk, IFSC, luhn, mask, PAN, verhoeff } from '../src/app/validate.ts';

const SECRET = /^(sk-[\w-]{16,}|gh[pousr]_\w{20,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[\w-]{10,}|eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*)$|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

export function detect(raw: string): SensitiveKind | undefined {
  const t = raw.trim();
  if (!t || t.length > 4000) return undefined;
  if (SECRET.test(t)) return 'secret';
  if (t.length > 40) return undefined;
  const digits = t.replace(/[\s-]/g, '');
  if (/^\d+$/.test(digits)) {
    if (/^[\d]{4}([\s-]?\d{4}){2}$/.test(t) && aadhaarOk(digits)) return 'aadhaar';
    if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) return 'card';
    // A bare short number is most often a one-time code, but not a year (2026), which used to be hidden and
    // deleted after ten minutes. A number copied twice (a PIN code, a customer ID) stops expiring: see History.add.
    if (/^\d{4,8}$/.test(t) && !/^(19|20)\d\d$/.test(t)) return 'otp';
  }
  if (PAN.test(t.toUpperCase()) && t.length === 10) return 'pan';
  return undefined;
}
