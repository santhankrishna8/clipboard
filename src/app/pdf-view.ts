import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import { indexPage, textItems } from './pdf-text';

interface Box { x: number; y: number; w: number; h: number } // % of the page, so the marks scale with the canvas

let lib: Promise<typeof import('pdfjs-dist')> | undefined;
export const pdfjs = () =>
  (lib ??= import('pdfjs-dist').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;
    return m;
  }));

/** Text of every page, for search. A scan has none, which the caller reports plainly. */
export async function extractPages(data: Uint8Array): Promise<{ page: number; text: string }[]> {
  const task = (await pdfjs()).getDocument({ data: data.slice() });
  const pdf = await task.promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) pages.push({ page: n, text: indexPage(textItems((await (await pdf.getPage(n)).getTextContent()).items)).text });
  await task.destroy();
  return pages;
}

/** One PDF page with the matched passage boxed (same text indexing as ingestion, so the passage can be found again). */
@Component({
  selector: 'cv-pdf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #frame class="pdf-frame" tabindex="0" [attr.aria-busy]="busy()" [attr.aria-label]="'Page ' + page() + ' of the document'">
      <div class="pdf-page" [style.width.%]="zoom() * 100">
        <canvas #canvas></canvas>
        @for (b of boxes(); track $index) { <span class="pdf-mark" [style.left.%]="b.x" [style.top.%]="b.y" [style.width.%]="b.w" [style.height.%]="b.h"></span> }
      </div>
    </div>
    @if (busy() && !error()) { <p class="hint" role="status" style="margin:8px 0 0">Loading page…</p> }
    @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
  `,
  host: { style: 'display:flex;flex-direction:column;min-height:0;flex:1' },
})
export class PdfView {
  data = input.required<Uint8Array>();
  page = input(1);
  zoom = input(1);
  marks = input<string[]>([]);
  pages = output<number>();
  busy = signal(true);
  error = signal('');
  boxes = signal<Box[]>([]);
  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private doc?: { bytes: Uint8Array; task: PDFDocumentLoadingTask; pdf: Promise<PDFDocumentProxy> };

  constructor() {
    effect((onCleanup) => {
      const [data, page, marks, zoom] = [this.data(), this.page(), this.marks(), this.zoom()];
      let live = true;
      onCleanup(() => (live = false));
      this.busy.set(true);
      this.error.set('');
      this.draw(data, page, marks, zoom, () => live).catch(() => live && this.error.set('This PDF could not be shown. Use Open or Save a copy.'));
    });
  }

  private async draw(data: Uint8Array, page: number, marks: string[], zoom: number, alive: () => boolean) {
    const lib = await pdfjs();
    if (this.doc?.bytes !== data) {
      void this.doc?.task.destroy();
      const task = lib.getDocument({ data: data.slice() });
      this.doc = { bytes: data, task, pdf: task.promise };
    }
    const pdf = await this.doc.pdf;
    this.pages.emit(pdf.numPages);
    const pg = await pdf.getPage(Math.min(Math.max(1, page), pdf.numPages));
    const base = pg.getViewport({ scale: 1 });
    const viewport = pg.getViewport({ scale: (Math.min(2400, this.frame().nativeElement.clientWidth * zoom * (window.devicePixelRatio || 1)) || 900) / base.width });
    const canvas = this.canvas().nativeElement;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pg.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    const items = textItems((await pg.getTextContent()).items);
    const { text, spans } = indexPage(items);
    const lower = text.toLowerCase();
    let at = -1, len = 0;
    for (const m of marks.map((x) => x.trim().toLowerCase()).filter((x) => x.length > 1)) {
      at = lower.indexOf(m);
      if (at >= 0) { len = m.length; break; }
    }
    const boxes: Box[] = [];
    if (at >= 0) {
      items.forEach((item, i) => {
        if (spans[i].end <= spans[i].start || spans[i].end <= at || spans[i].start >= at + len) return;
        const [, , c, d, e, f] = lib.Util.transform(viewport.transform, item.transform);
        const h = Math.hypot(c, d);
        boxes.push({ x: (e / viewport.width) * 100, y: ((f - h) / viewport.height) * 100, w: ((item.width * viewport.scale) / viewport.width) * 100, h: (h / viewport.height) * 100 });
      });
    }
    if (!alive()) return;
    this.boxes.set(boxes);
    this.busy.set(false);
    if (boxes.length) requestAnimationFrame(() => (this.frame().nativeElement.scrollTop = Math.max(0, (Math.min(...boxes.map((b) => b.y)) / 100) * this.frame().nativeElement.scrollHeight - 60)));
  }
}
