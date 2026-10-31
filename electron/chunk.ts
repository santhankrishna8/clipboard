/** Split text into ~`size`-char windows that overlap by `overlap`, breaking on spaces. */
export function chunk(text: string, size = 900, overlap = 150): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    if (end < text.length) {
      const sp = text.lastIndexOf(' ', end);
      if (sp > i + overlap) end = sp;
    }
    const piece = text.slice(i, end).trim();
    if (piece) out.push(piece);
    if (end >= text.length) break;
    const sp = text.indexOf(' ', end - overlap); // restart on a word boundary, not mid-word
    i = sp === -1 || sp >= end ? end : sp + 1;
  }
  return out;
}
