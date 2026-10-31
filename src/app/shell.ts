import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from './api';
import { Icon } from './icon';

@Component({
  selector: 'cv-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app">
      <aside class="rail">
        <div class="brand drag">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="1.5" y="6" width="6" height="12" rx="1.5" stroke="currentColor" stroke-width="1.75" />
            <rect x="9" y="6" width="6" height="12" rx="1.5" fill="currentColor" />
            <rect x="16.5" y="6" width="6" height="12" rx="1.5" stroke="currentColor" stroke-width="1.75" />
          </svg>
          <span class="name">Clipvault</span>
        </div>
        <nav class="nav" aria-label="Sections">
          <a routerLink="/history" routerLinkActive="on" title="History"><cv-icon name="history" /><span class="lbl">History</span></a>
          <a routerLink="/ids" routerLinkActive="on" title="IDs"><cv-icon name="id" /><span class="lbl">IDs</span></a>
          <a routerLink="/docs" routerLinkActive="on" title="Documents"><cv-icon name="doc" /><span class="lbl">Documents</span></a>
          <a routerLink="/settings" routerLinkActive="on" title="Settings"><cv-icon name="settings" /><span class="lbl">Settings</span></a>
        </nav>
        <div class="rail-foot">
          @if (api.state(); as s) {
            <div class="vault-state" [attr.title]="s.vault === 'unlocked' ? 'Vault unlocked' : 'Vault locked'">
              <cv-icon [name]="s.vault === 'unlocked' ? 'unlock' : 'lock'" [size]="16" />
              <span class="txt">{{ s.vault === 'unlocked' ? 'Vault unlocked' : s.vault === 'none' ? 'Vault not set up' : 'Vault locked' }}</span>
              @if (s.vault === 'unlocked') {
                <button class="btn sm" type="button" (click)="lock()">Lock</button>
              }
            </div>
            <label class="toggle">
              <input type="checkbox" [checked]="s.privateMode" (change)="pause($event)" />
              Pause capture
            </label>
          }
          <p class="safe"><cv-icon name="shield" [size]="16" />Everything stays on this laptop. Nothing is ever sent anywhere.</p>
        </div>
      </aside>
      @if (api.state()?.history === 'foreign') {
        <section class="pane">
          <div class="empty">
            <cv-icon name="alert" [size]="28" />
            <h2>This history belongs to another Windows account</h2>
            <p>Clipvault seals your data to the Windows user that created it, so this copy cannot be opened here. You can start fresh; the old files are kept in a folder called "old".</p>
            <button class="btn primary" type="button" (click)="fresh()">Start fresh</button>
          </div>
        </section>
      } @else {
        <router-outlet />
      }
    </div>
    @if (api.toast(); as t) {
      <div class="toast" role="status" aria-live="polite">
        {{ t.text }}
        @if (t.undo) {
          <button class="btn" type="button" (click)="t.undo()">Undo</button>
        }
      </div>
    }
  `,
})
export class Shell {
  api = inject(Api);
  lock() {
    void this.api.call('vault:lock');
  }
  pause(e: Event) {
    void this.api.run(() => this.api.call('private:set', (e.target as HTMLInputElement).checked));
  }
  fresh() {
    void this.api.call('app:startFresh');
  }
}
