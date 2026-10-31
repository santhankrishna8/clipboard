import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { Api } from './api';
import { Icon } from './icon';
import type { QuickRow } from './models';

const ICON: Record<string, string> = { text: 'text', image: 'image', files: 'files', lock: 'lock', bank: 'bank', other: 'file' };

/** The hotkey popup: type a few letters, Enter pastes into the program you were in. */
@Component({
  selector: 'cv-quick',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="quick" (keydown)="key($event)">
      <div class="search">
        <cv-icon name="search" [size]="18" />
        <input #boxEl class="input" type="text" name="quick" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="qlist" aria-label="Search to paste" [attr.aria-activedescendant]="rows().length ? 'q-' + i() : null" placeholder="Search, or type pan, aadhaar, bank…" [value]="q()" (input)="q.set(val($event))" />
      </div>
      <div id="qlist" class="list" role="listbox" aria-label="Results">
        @for (r of rows(); track r.id; let n = $index) {
          @if (n === 0 || rows()[n - 1].group !== r.group) { <div class="qgroup" role="presentation">{{ r.group }}</div> }
          <div class="row" role="option" [id]="'q-' + n" [attr.aria-selected]="n === i()" (mousemove)="i.set(n)" (click)="pick(r, true)">
            <div class="ico"><cv-icon [name]="icon(r)" [size]="16" /></div>
            <div class="txt"><span class="t">{{ r.title }}</span><span class="s">{{ r.sub }}</span></div>
            @if (r.tail) { <span class="mini" aria-hidden="true">@for (ch of r.tail.split(''); track $index) { <i>{{ ch }}</i> }</span> }
          </div>
        } @empty {
          <div class="empty">
            @if (loaded()) {
              <h2>{{ q() ? 'Nothing matches' : 'Nothing copied yet' }}</h2>
              <p>{{ q() ? 'Try other words. For IDs, unlock the vault first.' : 'Copy something and it will be here.' }}</p>
            }
          </div>
        }
      </div>
      <div class="qfoot"><span><kbd>Enter</kbd> paste</span><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> copy only</span><span><kbd>Esc</kbd> close</span></div>
    </div>
  `,
})
export class Quick {
  private api = inject(Api);
  q = signal('');
  rows = signal<QuickRow[]>([]);
  i = signal(0);
  loaded = signal(false);
  private box = viewChild.required<ElementRef<HTMLInputElement>>('boxEl');
  private token = 0;

  constructor() {
    effect((onCleanup) => {
      const q = this.q();
      this.api.tick();
      const t = setTimeout(async () => {
        const mine = ++this.token;
        const rows = await this.api.call<QuickRow[]>('quick:query', q).catch(() => []);
        if (mine === this.token) {
          this.rows.set(rows);
          this.i.set(0);
          this.loaded.set(true);
        }
      }, this.loaded() ? 70 : 0);
      onCleanup(() => clearTimeout(t));
    });
    window.clip.on((name) => {
      if (name !== 'quick-open') return;
      this.q.set('');
      this.i.set(0);
      this.box().nativeElement.value = '';
      this.box().nativeElement.focus();
      void this.api.refresh();
    });
  }

  val = (e: Event) => (e.target as HTMLInputElement).value;
  icon = (r: QuickRow) => ICON[r.icon] ?? 'id';

  key(e: KeyboardEvent) {
    const n = this.rows().length;
    if (e.key === 'ArrowDown') this.i.set((this.i() + 1) % Math.max(n, 1));
    else if (e.key === 'ArrowUp') this.i.set((this.i() - 1 + Math.max(n, 1)) % Math.max(n, 1));
    else if (e.key === 'Enter' && this.rows()[this.i()]) void this.pick(this.rows()[this.i()], !e.ctrlKey);
    else if (e.key === 'Escape') void this.api.call('quick:hide');
    else return;
    e.preventDefault();
    document.getElementById('q-' + this.i())?.scrollIntoView({ block: 'nearest' });
  }
  async pick(r: QuickRow, paste: boolean) {
    await this.api.run(() => this.api.call('quick:pick', r.id, paste));
  }
}
