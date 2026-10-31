import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { mask } from './validate';

/**
 * Clipvault's signature: a number set one character per box, like a printed form. Hidden values show only the last
 * four characters. When `written` changes, the boxes fill in ballpoint blue left to right: the visible "Copied".
 */
@Component({
  selector: 'cv-digits',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (boxed()) {
      <div class="digits" [class.written]="flash()" role="group" [attr.aria-label]="label()">
        @for (g of groups(); track $index) {
          <span class="grp" aria-hidden="true">
            @for (c of g.cells; track $index) {
              <span class="cell" [class.dot]="c.ch === '•'" [style.--i]="c.i">{{ c.ch === '•' ? '' : c.ch }}</span>
            }
          </span>
        }
      </div>
    } @else {
      <span class="plain-value">{{ shown() }}</span>
    }
  `,
})
export class Digits {
  value = input.required<string>();
  hidden = input(false);
  written = input(0);
  name = input('Value');
  flash = signal(false);

  shown = computed(() => (this.hidden() ? mask(this.value()) : this.value()));
  boxed = computed(() => this.value().length <= 22 && !/[@:/]/.test(this.value()));
  groups = computed(() => {
    let i = 0;
    return this.shown()
      .split(/\s+/)
      .filter(Boolean)
      .map((g) => ({ cells: [...g].map((ch) => ({ ch, i: i++ })) }));
  });
  label = computed(() => (this.hidden() ? `${this.name()}, hidden, ends in ${this.value().replace(/\s/g, '').slice(-4)}` : `${this.name()}: ${[...this.value().replace(/\s/g, '')].join(' ')}`));

  constructor() {
    let first = true;
    effect(() => {
      this.written();
      if (first) return void (first = false);
      this.flash.set(false);
      requestAnimationFrame(() => {
        this.flash.set(true);
        setTimeout(() => this.flash.set(false), 1300);
      });
    });
  }
}
