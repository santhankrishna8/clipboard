// Characters pdf.js extracts but no font can draw: icon fonts and small-caps heading glyphs (private use area).
const JUNK = /[-�]/g;

/** Keep only text items: pdf.js interleaves marked-content markers that carry no `str`. */
export const textItems = <T extends object>(items: T[]) => items.filter((i): i is Extract<T, { str: string }> => 'str' in i);

/**
 * Join a PDF page's text items into one string and remember where each item landed. Ingestion chunks this
 * string and the page viewer searches it again, so both must use this one function to agree on offsets.
 */
export function indexPage(items: { str: string }[]) {
  let text = '';
  const spans = items.map(({ str }) => {
    const s = str.replace(JUNK, '').replace(/\s+/g, ' ').trim();
    if (!s) return { start: text.length, end: text.length };
    if (text) text += ' ';
    const start = text.length;
    text += s;
    return { start, end: text.length };
  });
  return { text, spans };
}
