// Small pure text helpers: rich clipboard formats to plain words, and tidying dictated speech.
// No Electron here, so `npm run check` can run them.

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const entity = (m: string, e: string) => {
  if (e[0] !== '#') return ENT[e.toLowerCase()] ?? m;
  const hex = e[1] === 'x' || e[1] === 'X';
  const n = parseInt(e.slice(hex ? 2 : 1), hex ? 16 : 10);
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
};

/** Plain words of an HTML clipboard fragment, keeping line breaks between blocks. */
export const htmlText = (h: string) =>
  h
    .replace(/<!--[\s\S]*?-->|<(script|style|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[\da-f]+|\w+);/gi, entity)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// RTF groups that hold formatting tables, not words.
const SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'themedata', 'colorschememapping', 'latentstyles', 'datastore']);

/** Plain words of an RTF clipboard fragment (good enough for search and pasting back). */
export function rtfText(r: string): string {
  let out = '';
  const stack: boolean[] = [];
  let skip = false;
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    if (c === '{') {
      stack.push(skip);
      continue;
    }
    if (c === '}') {
      skip = stack.pop() ?? false;
      continue;
    }
    if (c === '\\') {
      const next = r[i + 1];
      if (next === '\\' || next === '{' || next === '}') {
        if (!skip) out += next;
        i++;
        continue;
      }
      if (next === "'") {
        if (!skip) out += String.fromCharCode(parseInt(r.slice(i + 2, i + 4), 16));
        i += 3;
        continue;
      }
      if (next === '*') {
        skip = true;
        i++;
        continue;
      }
      const m = /^([a-z]+)(-?\d+)? ?/i.exec(r.slice(i + 1, i + 40));
      if (!m) continue;
      i += m[0].length;
      const word = m[1];
      if (SKIP.has(word)) skip = true;
      else if (!skip && (word === 'par' || word === 'line')) out += '\n';
      else if (!skip && word === 'tab') out += '\t';
      else if (!skip && word === 'u' && m[2]) {
        out += String.fromCharCode((Number(m[2]) + 65536) % 65536);
        if (r[i + 1] === '?') i++; // the plain-text stand-in that follows a \u character
      }
      continue;
    }
    if (!skip && c !== '\r' && c !== '\n') out += c;
  }
  return out.replace(/[ \t]+\n/g, '\n').trim();
}

// ---- dictation -------------------------------------------------------------------------------------------------
// What Whisper writes for silence or background sound instead of words.
const NOISE = /\[(?:blank_audio|silence|music|noise|inaudible|applause|laughter)[^\]]*\]|\((?:silence|music|noise|inaudible|applause|laughs?|laughter|sighs?|coughs?)[^)]*\)|♪+/gi;
const FILLER = /(^|[\s,.;!?])(?:um+|uh+|erm+|er|ah+|hmm+|mm+)(?=[\s,.;!?]|$)[,]?/gi;

/**
 * Turns raw speech-to-text output into what you meant to type: drops sound tags and filler words when asked,
 * and follows the spoken commands "new line" and "new paragraph".
 */
export function tidy(raw: string, dropFillers = true): string {
  let t = raw.replace(NOISE, ' ');
  if (dropFillers) t = t.replace(FILLER, '$1');
  t = t
    .replace(/\s*\bnew paragraph\b[,.]?\s*/gi, '\n\n')
    .replace(/\s*\bnew line\b[,.]?\s*/gi, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ([,.;!?])/g, '$1')
    .replace(/([,.;!?]){2,}/g, '$1')
    .replace(/ *\n */g, '\n')
    .replace(/(^|\n)[,.;] */g, '$1')
    .trim();
  // Capitalise after a spoken line break or the start, as a person would type it.
  return t.replace(/(^|\n)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}
