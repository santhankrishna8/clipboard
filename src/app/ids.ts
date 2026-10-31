import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Api } from './api';
import { Digits } from './digits';
import { Gate } from './gate';
import { Icon } from './icon';
import { TEMPLATES, type Card, type CardKind, type Field, type PubCard } from './models';
import { fieldWarning } from './validate';

const KINDS = Object.keys(TEMPLATES) as CardKind[];
const ICON: Record<CardKind, string> = { aadhaar: 'id', pan: 'id', dl: 'id', passport: 'id', voter: 'id', bank: 'bank', other: 'file' };

@Component({
  selector: 'cv-ids',
  imports: [Icon, Digits, Gate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (api.state()?.vault !== 'unlocked') {
      <div class="main wide"><section class="pane drag"><cv-gate /></section></div>
    } @else {
      <div class="main">
        <section class="col" aria-label="Your IDs">
          <div class="col-head drag">
            <div class="titlerow">
              <h1>IDs</h1>
              <button class="btn primary" type="button" (click)="add()"><cv-icon name="plus" [size]="16" />Add</button>
            </div>
            <p class="meta">Numbers stay hidden until you ask. Copying one clears the clipboard after {{ api.state()?.settings?.clearSecretSec }} seconds.</p>
          </div>
          @if (visible().length) {
            <div class="list" role="listbox" aria-label="IDs" tabindex="0" (keydown)="listKey($event)" style="overflow:auto">
              @for (c of visible(); track c.id) {
                <div class="row" role="option" [attr.aria-selected]="sel() === c.id && !draft()" (click)="open(c)" style="height:60px">
                  <div class="ico"><cv-icon [name]="icon(c.kind)" [size]="16" /></div>
                  <div class="txt">
                    <span class="t">{{ c.title }}</span>
                    <span class="s">{{ hint(c) }}@if (last4(c); as t) { <span class="mini" aria-hidden="true">@for (ch of t; track $index) { <i>{{ ch }}</i> }</span><span class="sr">ends in {{ t.join('') }}</span> }</span>
                  </div>
                  <div class="flag">
                    @if (expiry(c); as e) { <span class="slip red">{{ e }}</span> }
                  </div>
                </div>
              }
            </div>
          } @else if (!draft()) {
            <div class="empty">
              <div class="digits"><span class="grp"><span class="cell"></span><span class="cell"></span><span class="cell"></span><span class="cell"></span></span><span class="grp"><span class="cell"></span><span class="cell"></span><span class="cell"></span><span class="cell"></span></span></div>
              <h2>No IDs yet</h2>
              <p>Add your Aadhaar, PAN, driving licence or bank details once, then copy them in two clicks.</p>
              <button class="btn primary" type="button" (click)="add()">Add your first ID</button>
            </div>
          }
        </section>

        <section class="pane" aria-label="ID details">
          @if (draft(); as d) {
            <form (submit)="save($event)" class="pane-body" style="padding-top:52px" novalidate>
              <h1>{{ isNew() ? 'Add an ID' : 'Edit ' + d.title }}</h1>
              @if (isNew()) {
                <div class="chips" role="radiogroup" aria-label="Kind of ID" style="padding-top:14px">
                  @for (k of kinds; track k) {
                    <button type="button" class="chip" role="radio" [attr.aria-checked]="d.kind === k" [attr.aria-pressed]="d.kind === k" (click)="kindOf(k)">{{ templates[k].label }}</button>
                  }
                </div>
              }
              <div style="margin-top:18px;max-width:460px;display:grid;gap:16px">
                <div>
                  <label class="field-label" for="title">Name this card</label>
                  <input id="title" class="input" name="title" autocomplete="off" [value]="d.title" (input)="patch('title', val($event))" />
                </div>
                @for (f of d.fields; track $index; let i = $index) {
                  <div>
                    @if (d.kind === 'other') {
                      <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px">
                        <input class="input" style="min-height:30px" [attr.aria-label]="'Label for field ' + (i + 1)" [value]="f.label" (input)="field(i, 'label', val($event))" placeholder="Label, for example Policy number…" autocomplete="off" />
                        <label class="check" style="white-space:nowrap"><input type="checkbox" [checked]="f.secret" (change)="field(i, 'secret', !f.secret)" />Hide</label>
                        <button class="btn quiet sm icon" type="button" [attr.aria-label]="'Remove ' + (f.label || 'field')" (click)="drop(i)"><cv-icon name="x" [size]="14" /></button>
                      </div>
                    } @else {
                      <label class="field-label" [for]="'f' + i">{{ f.label }}</label>
                    }
                    <input [id]="'f' + i" class="input" [attr.name]="f.key" autocomplete="off" spellcheck="false" [attr.type]="f.key === 'expiry' ? 'date' : 'text'" [attr.inputmode]="f.secret ? 'text' : null" [value]="f.value" [class.bad]="warn(d, f)" (input)="field(i, 'value', val($event))" [attr.aria-label]="d.kind === 'other' ? 'Value for ' + (f.label || 'field ' + (i + 1)) : null" />
                    @if (warn(d, f); as w) { <p class="hint warn">{{ w }} You can still save it.</p> }
                  </div>
                }
                @if (d.kind === 'other') {
                  <div><button class="btn sm" type="button" (click)="more()"><cv-icon name="plus" [size]="15" />Add a field</button></div>
                }
                @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
              </div>
              <div class="actions">
                <button class="btn primary" type="submit">Save</button>
                <button class="btn quiet" type="button" (click)="cancel()">Cancel</button>
              </div>
            </form>
          } @else if (current(); as c) {
            <div class="pane-head drag">
              <div class="titlerow">
                <cv-icon [name]="icon(c.kind)" [size]="24" />
                <h1>{{ c.title }}</h1>
                @if (expiry(c); as e) { <span class="slip red">{{ e }}</span> }
              </div>
              <p class="meta">Saved {{ saved(c.updated) }}</p>
            </div>
            <div class="pane-body">
              <dl class="fields" style="margin-top:0">
                @for (f of c.fields; track f.key) {
                  <div class="frow">
                    <dt>{{ f.label }}</dt>
                    <dd>
                      @if (f.secret) {
                        <cv-digits [value]="values()[c.id + f.key] || f.shown" [written]="written()[c.id + f.key] || 0" [name]="f.label" />
                      } @else if (f.shown) {
                        <span class="plain-value">{{ f.shown }}</span>
                      } @else {
                        <span class="mute">Not filled in</span>
                      }
                    </dd>
                    <div class="acts">
                      @if (f.secret) {
                        <button class="btn sm" type="button" [attr.aria-label]="(values()[c.id + f.key] ? 'Hide ' : 'Show ') + f.label" (click)="toggle(c, f.key)"><cv-icon [name]="values()[c.id + f.key] ? 'eye-off' : 'eye'" [size]="15" />{{ values()[c.id + f.key] ? 'Hide' : 'Show' }}</button>
                      }
                      @if (f.shown) {
                        <button class="btn sm" type="button" [attr.aria-label]="'Copy ' + f.label" (click)="copy(c, f.key, f.secret)"><cv-icon name="copy" [size]="15" />Copy</button>
                      }
                    </div>
                    @if (f.warn) { <p class="hint warn">{{ f.warn }}. Check it against the card.</p> }
                  </div>
                }
              </dl>
              <div class="actions">
                <button class="btn" type="button" (click)="edit(c)"><cv-icon name="edit" [size]="16" />Edit</button>
                <button class="btn quiet danger" type="button" (click)="remove(c)"><cv-icon name="trash" [size]="16" />Delete</button>
              </div>
            </div>
          } @else if (!draft()) {
            <div class="empty"><h2>Pick an ID</h2><p>Choose a card on the left to copy its numbers.</p></div>
          }
        </section>
      </div>
    }
  `,
})
export class IdsPage {
  api = inject(Api);
  kinds = KINDS;
  templates = TEMPLATES;
  cards = signal<PubCard[]>([]);
  hidden = signal<ReadonlySet<string>>(new Set());
  sel = signal<string | null>(null);
  values = signal<Record<string, string>>({});
  written = signal<Record<string, number>>({});
  draft = signal<Card | null>(null);
  isNew = signal(false);
  error = signal('');
  visible = computed(() => this.cards().filter((c) => !this.hidden().has(c.id)));
  current = computed(() => this.visible().find((c) => c.id === this.sel()));

  constructor() {
    effect(() => {
      this.api.tick();
      if (this.api.state()?.vault !== 'unlocked') return this.cards.set([]);
      void this.api.call<PubCard[]>('cards:list').then((c) => this.cards.set(c)).catch(() => this.cards.set([]));
    });
    effect(() => {
      if (!this.visible().some((c) => c.id === this.sel())) this.sel.set(this.visible()[0]?.id ?? null);
    });
    effect(() => {
      this.sel();
      this.values.set({}); // revealed values never outlive the selection
    });
  }

  val = (e: Event) => (e.target as HTMLInputElement).value;
  icon = (k: CardKind) => ICON[k];
  saved = (t: number) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(t);
  hint(c: PubCard) {
    const f = c.fields.find((x) => x.secret && x.shown);
    return f ? f.label : TEMPLATES[c.kind].label;
  }
  last4(c: PubCard): string[] | null {
    const f = c.fields.find((x) => x.secret && x.shown);
    return f ? [...f.shown.replace(/\s/g, '').slice(-4)] : null;
  }
  expiry(c: PubCard) {
    if (!c.expiry) return '';
    const days = Math.ceil((c.expiry - Date.now()) / 86_400_000);
    return days < 0 ? 'Expired' : days <= 60 ? `Expires in ${days} ${days === 1 ? 'day' : 'days'}` : '';
  }
  open(c: PubCard) {
    this.draft.set(null);
    this.sel.set(c.id);
  }
  listKey(e: KeyboardEvent) {
    const i = this.visible().findIndex((c) => c.id === this.sel());
    const n = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : -9;
    if (n === -9) return;
    e.preventDefault();
    const c = this.visible()[Math.max(0, Math.min(this.visible().length - 1, n))];
    if (c) this.open(c);
  }

  async toggle(c: PubCard, key: string) {
    const k = c.id + key;
    if (this.values()[k]) return this.values.update((v) => ({ ...v, [k]: '' }));
    const v = await this.api.call<string>('cards:reveal', c.id, key);
    this.values.update((x) => ({ ...x, [k]: v }));
  }
  async copy(c: PubCard, key: string, secret: boolean) {
    if (!(await this.api.run(() => this.api.call('cards:copy', c.id, key)))) return;
    this.written.update((w) => ({ ...w, [c.id + key]: (w[c.id + key] ?? 0) + 1 }));
    this.api.say(secret ? `Copied. It clears from your clipboard in ${this.api.state()?.settings.clearSecretSec} seconds.` : 'Copied');
  }
  remove(c: PubCard) {
    this.api.undoable(
      `Deleted ${c.title}`,
      (h) => this.hidden.update((s) => (h ? new Set(s).add(c.id) : new Set([...s].filter((x) => x !== c.id)))),
      () => this.api.call('cards:remove', c.id),
    );
  }

  // ---- editor ----
  add() {
    this.isNew.set(true);
    this.error.set('');
    this.draft.set(this.blank('aadhaar'));
  }
  private blank(kind: CardKind): Card {
    return { id: crypto.randomUUID(), kind, title: TEMPLATES[kind].label === 'Something else' ? '' : TEMPLATES[kind].label, fields: TEMPLATES[kind].fields.map((f) => ({ ...f, value: '' })), added: 0, updated: 0 };
  }
  kindOf(k: CardKind) {
    const d = this.draft()!;
    this.draft.set({ ...this.blank(k), id: d.id });
  }
  async edit(c: PubCard) {
    const full = await this.api.call<Card>('cards:get', c.id);
    this.isNew.set(false);
    this.error.set('');
    this.draft.set(full);
  }
  patch(key: 'title', v: string) {
    this.draft.update((d) => ({ ...d!, [key]: v }));
  }
  field(i: number, key: keyof Field, v: string | boolean) {
    this.draft.update((d) => ({ ...d!, fields: d!.fields.map((f, j) => (j === i ? { ...f, [key]: v, ...(key === 'label' ? { key: 'x' + i } : {}) } : f)) }));
  }
  more() {
    this.draft.update((d) => ({ ...d!, fields: [...d!.fields, { key: 'x' + d!.fields.length, label: '', value: '', secret: false }] }));
  }
  drop(i: number) {
    this.draft.update((d) => ({ ...d!, fields: d!.fields.filter((_, j) => j !== i) }));
  }
  warn = (d: Card, f: Field) => fieldWarning(d.kind, f.key, f.value);
  cancel() {
    this.draft.set(null);
  }
  async save(e: Event) {
    e.preventDefault();
    const d = this.draft()!;
    if (!d.title.trim()) return this.error.set('Give the card a name.');
    this.error.set('');
    if (await this.api.run(() => this.api.call('cards:save', { id: d.id, kind: d.kind, title: d.title, fields: d.fields }), 'Saved')) {
      this.sel.set(d.id);
      this.draft.set(null);
    }
  }
}
