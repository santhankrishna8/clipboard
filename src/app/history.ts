import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { ago, Api, bytes, dayLabel, left, timeOf } from './api';
import { Digits } from './digits';
import { Icon } from './icon';
import type { Kind, PubItem } from './models';

type Filter = 'all' | Kind | 'pinned';
type Row = { head: string } | { item: PubItem };

const SENSITIVE = { otp: 'One-time code', aadhaar: 'Aadhaar number', pan: 'PAN', card: 'Card number', secret: 'Secret key' } as const;
const KIND = { text: 'Text', image: 'Screenshot', files: 'File' } as const;

@Component({
  selector: 'cv-thumb',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (src()) { <img [src]="src()" alt="" loading="lazy" /> } @else { <cv-icon name="image" [size]="16" /> }`,
  host: { style: 'display:contents' },
})
export class Thumb {
  id = input.required<string>();
  src = signal<string | undefined>(undefined);
  private api = inject(Api);
  constructor() {
    effect(() => void this.api.thumb(this.id()).then((s) => this.src.set(s)));
  }
}

@Component({
  selector: 'cv-history',
  imports: [ScrollingModule, Icon, Digits, Thumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="main">
      <section class="col" aria-label="Copied items">
        <div class="col-head drag">
          <div class="search">
            <cv-icon name="search" [size]="16" />
            <input #boxEl class="input" type="search" name="search" autocomplete="off" spellcheck="false" aria-label="Search your history" placeholder="Search, or describe it…" [value]="q()" (input)="q.set(val($event))" (keydown)="searchKey($event)" />
            @if (q()) { <button class="btn quiet sm icon" type="button" aria-label="Clear search" (click)="q.set(''); box().nativeElement.focus()"><cv-icon name="x" [size]="14" /></button> }
          </div>
          <div class="chips" role="group" aria-label="Show">
            @for (f of filters; track f.id) {
              <button class="chip" type="button" [attr.aria-pressed]="kind() === f.id" (click)="kind.set(f.id)">{{ f.label }}</button>
            }
          </div>
        </div>
        @if (api.state()?.privateMode) {
          <div class="banner" role="status"><cv-icon name="alert" [size]="16" />Capture is paused. New copies are not being saved. <button class="btn sm" type="button" (click)="resume()">Resume</button></div>
        }
        @if (rows().length) {
          <cdk-virtual-scroll-viewport #list class="list" itemSize="56" role="listbox" tabindex="0" aria-label="History" [attr.aria-activedescendant]="sel() ? 'r-' + sel() : null" (keydown)="listKey($event)">
            <ng-container *cdkVirtualFor="let r of rows(); trackBy: track">
              @if (head(r); as h) {
                <div class="day" role="presentation">{{ h }}</div>
              } @else if (item(r); as it) {
                <div class="row" role="option" [id]="'r-' + it.id" [attr.aria-selected]="sel() === it.id" (click)="sel.set(it.id)" (dblclick)="copy(it)">
                  <div class="ico">
                    @if (it.kind === 'image') { <cv-thumb [id]="it.id" /> } @else { <cv-icon [name]="glyph(it)" [size]="16" /> }
                  </div>
                  <div class="txt">
                    <span class="t">{{ it.preview }}</span>
                    <span class="s">{{ it.via === 'meaning' ? 'Similar meaning' : label(it) }}{{ it.app ? ' · ' + it.app : '' }} · {{ ago(it.at) }}</span>
                  </div>
                  <div class="flag">
                    @if (it.sensitive && it.expires) { <span class="slip" [class.red]="it.expires - now < 300000">Hidden · {{ left(it.expires) }}</span> }
                    @if (it.pinned) { <cv-icon name="pin" [size]="15" /> }
                  </div>
                </div>
              }
            </ng-container>
          </cdk-virtual-scroll-viewport>
        } @else if (loaded()) {
          <div class="empty">
            @if (q()) {
              <h2>Nothing matches “{{ q() }}”</h2>
              <p>Try fewer words, or describe it differently. Search looks at the exact text and at the meaning.</p>
              <button class="btn" type="button" (click)="q.set('')">Clear search</button>
            } @else {
              <div class="digits"><span class="grp"><span class="cell"></span><span class="cell"></span><span class="cell"></span><span class="cell"></span><span class="cell"></span></span></div>
              <h2>Nothing copied yet</h2>
              <p>Copy something anywhere and it appears here, kept safe on this laptop.</p>
            }
          </div>
        }
      </section>

      <section class="pane" aria-label="Selected item">
        @if (current(); as it) {
          <div class="pane-head drag">
            <div class="titlerow">
              <h1>{{ title(it) }}</h1>
            </div>
            <p class="meta">{{ label(it) }}{{ it.app ? ' · from ' + it.app : '' }} · {{ ago(it.at) }}, {{ time(it.at) }}{{ it.length ? ' · ' + it.length.toLocaleString() + ' characters' : '' }}{{ it.bytes ? ' · ' + size(it.bytes) : '' }}</p>
            <div class="actions">
              <button class="btn primary" type="button" (click)="copy(it)"><cv-icon name="copy" [size]="16" />Copy</button>
              <button class="btn sm" type="button" [attr.title]="it.pinned ? 'Unpin' : 'Pin'" (click)="pin(it)"><cv-icon [name]="it.pinned ? 'unpin' : 'pin'" [size]="16" /><span class="lbl">{{ it.pinned ? 'Unpin' : 'Pin' }}</span></button>
              @if (it.kind === 'image') { <button class="btn sm" type="button" title="Save as…" (click)="saveImage(it)"><cv-icon name="download" [size]="16" /><span class="lbl">Save as…</span></button> }
              @if (it.kind === 'files') { <button class="btn sm" type="button" title="Show in folder" (click)="show(it)"><cv-icon name="folder" [size]="16" /><span class="lbl">Show in folder</span></button> }
              <button class="btn quiet sm danger" type="button" title="Delete" (click)="remove(it)"><cv-icon name="trash" [size]="16" /><span class="lbl">Delete</span></button>
            </div>
          </div>
          <div class="pane-body">
            @if (it.sensitive) {
              <cv-digits [value]="revealed() ?? it.preview" [written]="written()" [name]="title(it)" />
              <div class="actions">
                <button class="btn sm" type="button" (click)="reveal(it)"><cv-icon [name]="revealed() ? 'eye-off' : 'eye'" [size]="15" />{{ revealed() ? 'Hide' : 'Show' }}</button>
              </div>
              <p class="hint">Hidden because it looks like {{ sensitiveWord(it) }}.{{ it.expires ? ' Clipvault removes it ' + left(it.expires).replace(' left', '') + ' from now.' : '' }} Copying it clears your clipboard after {{ api.state()?.settings?.clearSecretSec }} seconds.</p>
            } @else if (it.kind === 'text') {
              <div class="preview-text text-body" tabindex="0">{{ full() ?? it.preview }}</div>
            } @else if (it.kind === 'image') {
              @if (image()) { <img class="shot" [src]="image()" [alt]="'Screenshot, ' + it.w + ' by ' + it.h + ' pixels'" /> }
            } @else {
              <ul class="file-list">
                @for (f of it.files; track f) { <li>{{ f }}</li> }
              </ul>
              <p class="hint">Clipvault keeps the file's location, not the file. If it moves, Copy will no longer find it.</p>
            }
          </div>
        } @else {
          <div class="empty"><h2>Select an item</h2><p>Choose something from the list to copy, pin or delete it.</p></div>
        }
      </section>
    </div>
  `,
})
export class HistoryPage {
  api = inject(Api);
  ago = ago;
  now = Date.now();
  left = left;
  time = timeOf;
  size = bytes;
  q = signal('');
  kind = signal<Filter>('all');
  items = signal<PubItem[]>([]);
  loaded = signal(false);
  hidden = signal<ReadonlySet<string>>(new Set());
  sel = signal<string | null>(null);
  full = signal<string | undefined>(undefined);
  image = signal<string | undefined>(undefined);
  revealed = signal<string | undefined>(undefined);
  written = signal(0);
  filters: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'text', label: 'Text' }, { id: 'image', label: 'Images' }, { id: 'files', label: 'Files' }, { id: 'pinned', label: 'Pinned' }];
  protected box = viewChild.required<ElementRef<HTMLInputElement>>('boxEl');
  private token = 0;

  visible = computed(() => this.items().filter((i) => !this.hidden().has(i.id)));
  current = computed(() => this.visible().find((i) => i.id === this.sel()));
  rows = computed<Row[]>(() => {
    const out: Row[] = [];
    let last = '';
    for (const it of this.visible()) {
      if (this.q().trim()) out.push({ item: it });
      else {
        const d = it.pinned && this.kind() === 'all' ? 'Pinned' : dayLabel(it.at);
        if (d !== last) out.push({ head: (last = d) });
        out.push({ item: it });
      }
    }
    return this.q().trim() ? [{ head: `${out.length} ${out.length === 1 ? 'result' : 'results'}` }, ...out] : out;
  });

  constructor() {
    effect((onCleanup) => {
      const [q, kind] = [this.q(), this.kind()];
      this.api.tick();
      const t = setTimeout(() => void this.load(q, kind), untracked(() => (this.loaded() ? 90 : 0)));
      onCleanup(() => clearTimeout(t));
    });
    effect(() => {
      const first = this.visible()[0]?.id ?? null;
      if (!this.visible().some((i) => i.id === untracked(this.sel))) this.sel.set(first);
    });
    effect(() => {
      const it = this.current();
      this.revealed.set(undefined);
      this.full.set(undefined);
      this.image.set(undefined);
      if (!it) return;
      if (it.kind === 'text' && !it.sensitive) void this.api.call<string | undefined>('history:full', it.id).then((t) => this.sel() === it.id && this.full.set(t));
      if (it.kind === 'image') void this.api.call<string | undefined>('history:image', it.id).then((t) => this.sel() === it.id && this.image.set(t));
    });
  }

  private async load(q: string, kind: Filter) {
    const mine = ++this.token;
    try {
      const items = await this.api.call<PubItem[]>('history:list', { q, kind: kind === 'all' ? undefined : kind });
      if (mine === this.token) {
        this.items.set(items);
        this.loaded.set(true);
      }
    } catch {
      this.loaded.set(true);
    }
  }

  val = (e: Event) => (e.target as HTMLInputElement).value;
  head = (r: Row) => ('head' in r ? r.head : '');
  item = (r: Row) => ('item' in r ? r.item : null);
  track = (_: number, r: Row) => ('head' in r ? 'h:' + r.head : r.item.id);
  label = (it: PubItem) => (it.sensitive ? SENSITIVE[it.sensitive] : KIND[it.kind]);
  glyph = (it: PubItem) => (it.kind === 'files' ? 'files' : it.sensitive ? 'lock' : /^https?:\/\//i.test(it.preview) ? 'link' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(it.preview) ? 'mail' : 'text');
  title = (it: PubItem) => (it.sensitive ? SENSITIVE[it.sensitive] : it.kind === 'text' ? (/^https?:\/\//i.test(it.preview) ? 'Web link' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(it.preview) ? 'Email address' : 'Copied text') : it.kind === 'image' ? `Screenshot ${it.w}×${it.h}` : (it.files?.length ?? 0) > 1 ? `${it.files!.length} files` : 'Copied file');
  sensitiveWord = (it: PubItem) => ({ otp: 'a one-time code', aadhaar: 'an Aadhaar number', pan: 'a PAN', card: 'a card number', secret: 'a secret key' })[it.sensitive!];

  searchKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.move(1);
    } else if (e.key === 'Enter' && this.current()) void this.copy(this.current()!);
    else if (e.key === 'Escape') this.q.set('');
  }
  listKey(e: KeyboardEvent) {
    const it = this.current();
    if (e.key === 'ArrowDown') this.move(1);
    else if (e.key === 'ArrowUp') this.move(-1);
    else if (e.key === 'Home') this.pick(0);
    else if (e.key === 'End') this.pick(this.visible().length - 1);
    else if (e.key === 'Enter' && it) void this.copy(it);
    else if (e.key === 'Delete' && it) this.remove(it);
    else return;
    e.preventDefault();
  }
  private move(d: number) {
    const i = this.visible().findIndex((x) => x.id === this.sel());
    this.pick(Math.max(0, Math.min(this.visible().length - 1, i + d)));
  }
  private pick(i: number) {
    const it = this.visible()[i];
    if (!it) return;
    this.sel.set(it.id);
    document.getElementById('r-' + it.id)?.scrollIntoView({ block: 'nearest' });
  }

  async copy(it: PubItem) {
    if (!(await this.api.run(() => this.api.call('history:copy', it.id)))) return;
    this.written.update((n) => n + 1);
    this.api.say(it.sensitive ? `Copied. It clears from your clipboard in ${this.api.state()?.settings.clearSecretSec} seconds.` : 'Copied');
  }
  pin(it: PubItem) {
    void this.api.run(() => this.api.call('history:pin', it.id, !it.pinned));
  }
  async reveal(it: PubItem) {
    if (this.revealed()) return this.revealed.set(undefined);
    this.revealed.set(await this.api.call<string>('history:reveal', it.id));
  }
  saveImage(it: PubItem) {
    void this.api.run(async () => (await this.api.call<boolean>('history:saveImage', it.id)) && this.api.say('Saved'));
  }
  show(it: PubItem) {
    void this.api.call('history:show', it.id);
  }
  remove(it: PubItem) {
    this.api.undoable(
      'Deleted',
      (h) => this.hidden.update((s) => (h ? new Set(s).add(it.id) : new Set([...s].filter((x) => x !== it.id)))),
      () => this.api.call('history:remove', [it.id]),
    );
  }
  resume() {
    void this.api.call('private:set', false);
  }
}
