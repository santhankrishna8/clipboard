// Checks for the Indian ID formats Clipvault knows. Shared by the windows (live hints while typing) and the main
// process (detection and the hints shown on saved cards). No imports on purpose: both sides load this file as is.

// Verhoeff check digit, the checksum every Aadhaar number carries.
const D = ['0123456789', '1234067895', '2340178956', '3401289567', '4012395678', '5987604321', '6598710432', '7659821043', '8765932104', '9876543210'];
const P = ['0123456789', '1576283094', '5803796142', '8916043527', '9453126870', '4286573901', '2793806415', '7046913258'];
export function verhoeff(digits: string): boolean {
  let c = 0;
  [...digits].reverse().forEach((ch, i) => (c = +D[c][+P[i % 8][+ch]]));
  return c === 0;
}
export const digitsOf = (s: string) => s.replace(/\D/g, '');
export const aadhaarOk = (s: string) => /^[2-9]\d{11}$/.test(s) && verhoeff(s);

export function luhn(digits: string): boolean {
  let sum = 0;
  [...digits].reverse().forEach((ch, i) => {
    let n = +ch;
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  });
  return sum % 10 === 0;
}

export const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** A gentle hint for a saved or typed field, or undefined when it looks right (or is empty). Never blocks saving. */
export function fieldWarning(kind: string, key: string, raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  if (kind === 'aadhaar' && key === 'number' && !aadhaarOk(digitsOf(v))) return 'This does not look like a valid Aadhaar number';
  if (kind === 'pan' && key === 'number' && !PAN.test(v.toUpperCase())) return 'A PAN has 5 letters, 4 digits, then 1 letter';
  if (kind === 'bank' && key === 'ifsc' && !IFSC.test(v.toUpperCase())) return 'An IFSC has 4 letters, a 0, then 6 letters or digits';
  return undefined;
}

/** Keep the last four characters, hide the rest (spaces and hyphens stay so the shape is recognisable). */
export function mask(v: string, keep = 4): string {
  let seen = 0;
  return [...v]
    .reverse()
    .map((ch) => (/[\s-]/.test(ch) ? ch : seen++ < keep ? ch : '•'))
    .reverse()
    .join('');
}
