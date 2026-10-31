import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Api } from './api';
import { Icon } from './icon';

/** Shown in place of IDs and Documents until the vault exists and is unlocked. */
@Component({
  selector: 'cv-gate',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="gate" (submit)="submit($event)" novalidate>
      <div class="titlerow">
        <cv-icon [name]="setup() ? 'shield' : 'lock'" [size]="22" />
        <h1>{{ setup() ? 'Create your vault password' : 'Unlock your vault' }}</h1>
      </div>
      @if (setup()) {
        <p>Your IDs and documents are locked with this password. It never leaves this laptop, so Clipvault cannot reset it for you.</p>
      } @else {
        <p>Enter your vault password to see your IDs and documents. It locks again after {{ api.state()?.settings?.autoLockMin || 'a few' }} minutes of not using it.</p>
      }
      <div>
        <label class="field-label" for="pw">{{ setup() ? 'New password' : 'Password' }}</label>
        <div class="pwbox" [class.bad]="error() && !again()">
          <span class="grp" aria-hidden="true">
            @for (c of typed(); track $index) { <span class="cell on" [class.dot]="!show()">{{ show() ? c : '' }}</span> }
            <span class="cell next"></span>
          </span>
          <input #pwInput id="pw" [attr.type]="show() ? 'text' : 'password'" name="password" [attr.autocomplete]="setup() ? 'new-password' : 'current-password'" (input)="pw.set(val($event))" [value]="pw()" spellcheck="false" />
        </div>
        @if (setup()) { <p class="hint" [class.warn]="pw().length > 0 && pw().length < 8">{{ pw().length < 8 ? 'Use at least 8 characters. A short phrase of three or four words works well.' : 'Good length.' }}</p> }
      </div>
      <label class="check"><input type="checkbox" [checked]="show()" (change)="show.set(!show())" />Show password</label>
      @if (!setup()) { <p class="hint" style="margin:-6px 0 0">Forgot it? It cannot be reset. Your IDs and documents can only be restored from a backup file.</p> }
      @if (setup()) {
        <div>
          <label class="field-label" for="pw2">Type it again</label>
          <input id="pw2" class="input" type="password" name="confirm" autocomplete="new-password" [class.bad]="error() && again()" (input)="pw2.set(val($event))" [value]="pw2()" spellcheck="false" />
        </div>
        <label class="check">
          <input type="checkbox" [checked]="sure()" (change)="sure.set(!sure())" />
          <span>I understand that if I forget this password, my IDs and documents cannot be recovered.</span>
        </label>
      }
      @if (error()) {
        <p class="err" role="alert">{{ error() }}</p>
      }
      <button class="btn primary" type="submit" [attr.aria-busy]="busy()">
        @if (busy()) { <span class="spin" aria-hidden="true"></span> }
        {{ setup() ? 'Create vault' : 'Unlock' }}
      </button>
    </form>
  `,
})
export class Gate {
  api = inject(Api);
  setup = computed(() => this.api.state()?.vault === 'none');
  show = signal(false);
  pw = signal('');
  pw2 = signal('');
  sure = signal(false);
  busy = signal(false);
  error = signal('');
  again = signal(false);
  typed = computed(() => [...this.pw()]);
  private pwInput = viewChild.required<ElementRef<HTMLInputElement>>('pwInput');

  val = (e: Event) => (e.target as HTMLInputElement).value;

  async submit(e: Event) {
    e.preventDefault();
    this.error.set('');
    this.again.set(false);
    if (this.busy()) return;
    if (this.setup()) {
      if (this.pw().length < 8) return this.fail('Use at least 8 characters.');
      if (this.pw() !== this.pw2()) return this.fail('The two passwords are different.', true);
      if (!this.sure()) return this.fail('Tick the box to confirm you understand.');
    } else if (!this.pw()) return this.fail('Enter your password.');
    this.busy.set(true);
    try {
      await this.api.call(this.setup() ? 'vault:setup' : 'vault:unlock', this.pw());
      this.pw.set('');
      this.pw2.set('');
      this.sure.set(false);
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Could not unlock.');
    } finally {
      this.busy.set(false);
    }
  }
  private fail(msg: string, again = false) {
    this.error.set(msg);
    this.again.set(again);
    if (!again) this.pwInput().nativeElement.focus();
  }
}
