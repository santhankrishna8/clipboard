import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { ago, Api, bytes } from './api';
import { Gate } from './gate';
import { Icon } from './icon';
import type { DocHit, DocMeta } from './models';
import { extractPages, PdfView } from './pdf-view';

const isPdf = (d: DocMeta) => d.mime === 'application/pdf' || /\.pdf$/i.test(d.name);
const isImage = (d: DocMeta) => d.mime.startsWith('image/');

@Component({
  selector: 'cv-docs',
  imports: [Icon, Gate, PdfView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (api.state()?.vault !== 'unlocked') {
      <div class="main wide"><section class="pane drag"><cv-gate /></section></div>
    } @else {
      <div class="main" (dragover)="over($event)" (dragleave)="dragging.set(false)" (drop)="drop($event)">
        <section class="col" aria-label="Documents">
          <div class="col-head drag">
            <div class="titlerow">
              <h1>Documents</h1>
              <button class="btn primary" type="button" (click)="picker().nativeElement.click()"><cv-icon name="upload" [size]="16" />Add</button>
              <input #fileInput type="file" multiple hidden accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,image/*" (change)="pick($event)" />
            </div>
            <div class="search" style="margin-top:12px">
              <cv-icon name="search" [size]="16" />
              <input class="input" type="search" name="doc-search" autocomplete="off" spellcheck="false" aria-label="Search your documents" placeholder="Search names, or the words inside…" [value]="q()" (input)="q.set(val($event))" />
              @if (q()) { <button class="btn quiet sm icon" type="button" aria-label="Clear search" (click)="q.set('')"><cv-icon name="x" [size]="14" /></button> }
            </div>
          </div>
          @if (busy()) { <div class="banner" role="status"><span class="spin" aria-hidden="true"></span>{{ busy() }}</div> }
          @if (shown().length) {
            <div class="list" role="listbox" aria-label="Documents" tabindex="0" style="overflow:auto" (keydown)="listKey($event)">
              @for (h of shown(); track h.doc.id) {
                <div class="row" role="option" [attr.aria-selected]="sel() === h.doc.id" (click)="choose(h)" style="height:60px">
                  <div class="ico"><cv-icon [name]="icon(h.doc)" [size]="16" /></div>
                  <div class="txt">
                    <span class="t">{{ h.doc.name }}</span>
                    <span class="s">{{ h.snippet || meta(h.doc) }}</span>
                  </div>
                  @if (h.via !== 'name' || h.page) {
                    <div class="flag">@if (h.page) { <span class="slip blue">Page {{ h.page }}</span> }</div>
                  }
                </div>
              }
            </div>
          } @else if (loaded()) {
            <div class="empty">
              @if (q()) {
                <h2>Nothing matches “{{ q() }}”</h2>
                <p>Search covers file names and the text inside PDFs. Scanned pages have no text, so they are found by name only.</p>
              } @else {
                <div class="digits"><span class="grp"><span class="cell"></span><span class="cell"></span><span class="cell"></span><span class="cell"></span></span></div>
                <h2>No documents yet</h2>
                <p>Add your PDFs and photos of cards. They are encrypted here and you can drag them straight into a chat or an email.</p>
                <button class="btn primary" type="button" (click)="picker().nativeElement.click()">Add documents</button>
              }
            </div>
          }
        </section>

        <section class="pane" aria-label="Document">
          @if (dragging()) { <div class="drop">Drop to add to your vault</div> }
          @if (current(); as d) {
            <div class="pane-head drag">
              <div class="titlerow"><h1>{{ d.name }}</h1></div>
              <p class="meta">{{ meta(d) }}</p>
              <div class="actions">
                <button class="btn primary" type="button" (click)="copyFile(d)"><cv-icon name="copy" [size]="16" />Copy file</button>
                <button class="btn sm" type="button" title="Open" (click)="open(d)"><cv-icon name="doc" [size]="16" /><span class="lbl">Open</span></button>
                <button class="btn sm" type="button" title="Save a copy…" (click)="save(d)"><cv-icon name="download" [size]="16" /><span class="lbl">Save a copy…</span></button>
                <button class="btn quiet sm danger" type="button" title="Delete" (click)="remove(d)"><cv-icon name="trash" [size]="16" /><span class="lbl">Delete</span></button>
              </div>
            </div>
            <div class="pane-body" style="display:flex;flex-direction:column">
              @if (isPdf(d) && bytes()) {
                <div class="titlerow" style="margin-bottom:10px;align-items:center">
                  <button class="btn sm icon" type="button" aria-label="Previous page" [disabled]="page() <= 1" (click)="page.set(page() - 1)"><cv-icon name="left" [size]="16" /></button>
                  <span class="mute" style="flex:none;font-variant-numeric:tabular-nums">Page {{ page() }} of {{ total() || d.pages }}</span>
                  <button class="btn sm icon" type="button" aria-label="Next page" [disabled]="page() >= (total() || d.pages)" (click)="page.set(page() + 1)"><cv-icon name="right" [size]="16" /></button>
                  <span style="flex:1"></span>
                  <button class="btn sm icon" type="button" aria-label="Zoom out" [disabled]="zoom() <= 1" (click)="zoom.set(zoom() - 0.5)">−</button>
                  <button class="btn sm icon" type="button" aria-label="Zoom in" [disabled]="zoom() >= 3" (click)="zoom.set(zoom() + 0.5)">+</button>
                  <span class="btn sm" draggable="true" role="button" tabindex="0" aria-label="Drag this file into a chat or email" title="Drag this file into a chat or email" (dragstart)="drag($event, d)" style="cursor:grab"><cv-icon name="files" [size]="15" />Drag into a chat</span>
                </div>
                @if (!hasText(d)) { <p class="hint" style="margin:0 0 8px">This looks like a scan, so search finds it by name only.</p> }
                <cv-pdf [data]="bytes()!" [page]="page()" [zoom]="zoom()" [marks]="marks()" (pages)="total.set($event)" />
              } @else if (isImage(d) && imageUrl()) {
                <img class="shot" [src]="imageUrl()" [alt]="d.name" />
                <p class="hint">Photos have no text to search, so they are found by name.</p>
              } @else if (!isPdf(d)) {
                <div class="empty"><h2>No preview for this type of file</h2><p>Use Open to view it in its own app, or drag it out.</p></div>
              }
            </div>
          } @else {
            <div class="empty"><h2>Select a document</h2><p>Preview it here, then copy it or drag it into a chat or email.</p></div>
          }
        </section>
      </div>
    }
  `,
})
export class DocsPage {
  api = inject(Api);
  isPdf = isPdf;
  isImage = isImage;
  q = signal('');
  hits = signal<DocHit[]>([]);
  loaded = signal(false);
  hidden = signal<ReadonlySet<string>>(new Set());
  sel = signal<string | null>(null);
  page = signal(1);
  zoom = signal(1.5);
  total = signal(0);
  bytes = signal<Uint8Array | undefined>(undefined);
  imageUrl = signal<string | undefined>(undefined);
  busy = signal('');
  dragging = signal(false);
  protected picker = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private token = 0;
  shown = computed(() => this.hits().filter((h) => !this.hidden().has(h.doc.id)));
  current = computed(() => this.shown().find((h) => h.doc.id === this.sel())?.doc);
  /** What to box on the page: the text the user typed, else the whole matched passage. */
  private passage = signal('');
  marks = computed(() => [this.q(), this.passage()]);

  constructor() {
    effect((onCleanup) => {
      const q = this.q();
      this.api.tick();
      if (this.api.state()?.vault !== 'unlocked') return this.hits.set([]);
      const t = setTimeout(() => void this.load(q), untracked(() => (this.loaded() ? 120 : 0)));
      onCleanup(() => clearTimeout(t));
    });
    effect(() => {
      if (!this.shown().some((h) => h.doc.id === untracked(this.sel))) this.sel.set(this.shown()[0]?.doc.id ?? null);
    });
    effect(() => {
      const d = this.current();
      this.bytes.set(undefined);
      this.total.set(0);
      this.imageUrl.update((u) => (u && URL.revokeObjectURL(u), undefined));
      if (!d) return;
      void this.api.call<Uint8Array>('docs:bytes', d.id).then((b) => {
        if (this.sel() !== d.id) return;
        this.bytes.set(b);
        if (isImage(d)) this.imageUrl.set(URL.createObjectURL(new Blob([b.slice()], { type: d.mime })));
      }).catch(() => undefined);
    });
  }

  val = (e: Event) => (e.target as HTMLInputElement).value;
  icon = (d: DocMeta) => (isImage(d) ? 'image' : 'doc');
  meta = (d: DocMeta) => `${isPdf(d) ? `${d.pages} ${d.pages === 1 ? 'page' : 'pages'} · ` : ''}${bytes(d.size)} · added ${ago(d.added)}`;
  hasText = (d: DocMeta) => d.chunks > 0;

  private async load(q: string) {
    const mine = ++this.token;
    try {
      const hits = await this.api.call<DocHit[]>('docs:search', q);
      if (mine === this.token) {
        this.hits.set(hits);
        this.loaded.set(true);
      }
    } catch {
      this.loaded.set(true);
    }
  }
  choose(h: DocHit) {
    this.sel.set(h.doc.id);
    this.page.set(h.page ?? 1);
    this.passage.set(h.passage);
  }
  listKey(e: KeyboardEvent) {
    const i = this.shown().findIndex((h) => h.doc.id === this.sel());
    const n = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Delete' ? -5 : -9;
    if (n === -9) return;
    e.preventDefault();
    if (n === -5) return this.current() && this.remove(this.current()!);
    const h = this.shown()[Math.max(0, Math.min(this.shown().length - 1, n))];
    if (h) this.choose(h);
  }

  // ---- adding ----
  pick(e: Event) {
    const input = e.target as HTMLInputElement;
    void this.addAll([...(input.files ?? [])]);
    input.value = '';
  }
  over(e: DragEvent) {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      this.dragging.set(true);
    }
  }
  drop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    void this.addAll([...(e.dataTransfer?.files ?? [])]);
  }
  private async addAll(files: File[]) {
    for (const f of files) {
      this.busy.set(`Adding ${f.name}…`);
      try {
        const data = new Uint8Array(await f.arrayBuffer());
        const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
        const pages = pdf ? await extractPages(data) : f.type.startsWith('text/') || /\.txt$/i.test(f.name) ? [{ page: 1, text: await f.text() }] : [];
        const meta = await this.api.call<DocMeta>('docs:add', { name: f.name, mime: f.type || 'application/octet-stream', bytes: data, pages });
        this.sel.set(meta.id);
        this.api.say(pdf && pages.every((p) => !p.text.trim()) ? `Added ${f.name}. It has no text to search, so it is found by name.` : `Added ${f.name}`);
      } catch (err) {
        this.api.say(`Could not add ${f.name}. ${err instanceof Error ? err.message : ''}`);
      }
    }
    this.busy.set('');
  }

  // ---- using ----
  copyFile(d: DocMeta) {
    void this.api.run(() => this.api.call('docs:copy', d.id), 'File copied. Paste it into a chat or email.');
  }
  open(d: DocMeta) {
    void this.api.run(() => this.api.call('docs:open', d.id));
  }
  save(d: DocMeta) {
    void this.api.run(async () => (await this.api.call<boolean>('docs:save', d.id)) && this.api.say('Saved'));
  }
  drag(e: DragEvent, d: DocMeta) {
    e.preventDefault();
    window.clip.send('docs:drag', d.id);
  }
  remove(d: DocMeta) {
    this.api.undoable(
      `Deleted ${d.name}`,
      (h) => this.hidden.update((s) => (h ? new Set(s).add(d.id) : new Set([...s].filter((x) => x !== d.id)))),
      () => this.api.call('docs:remove', d.id),
    );
  }
}
