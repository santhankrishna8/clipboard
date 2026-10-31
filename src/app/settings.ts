import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Api } from './api';
import { Icon } from './icon';
import type { Settings } from './models';

const KEEP = [[0, 'Forever'], [365, '1 year'], [90, '90 days'], [30, '30 days'], [7, '7 days']] as const;
const LOCK = [[1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [0, 'Only when I lock it']] as const;
const HIDE = [[10, '10 minutes'], [60, '1 hour'], [240, '4 hours'], [0, 'Never']] as const;
const CLEAR = [[15, '15 seconds'], [30, '30 seconds'], [60, '1 minute'], [0, 'Never']] as const;

@Component({
  selector: 'cv-settings',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="main wide">
      <section class="pane" aria-label="Settings">
        <div class="pane-head drag"><h1>Settings</h1></div>
        <div class="pane-body">
          @if (s(); as s) {
            <div class="sets">
              <section>
                <h2>Quick paste</h2>
                <div class="srow">
                  <div><div class="lbl" id="hk">Shortcut</div><p class="hint">Press it anywhere to search, then Enter to paste. Windows keeps Win+V for itself.</p></div>
                  <button class="btn key" type="button" aria-labelledby="hk" (click)="record()" (keydown)="keys($event)" (blur)="recording.set(false)">{{ recording() ? 'Press the new keys…' : pretty(s.hotkey) }}</button>
                </div>
                @if (api.state()?.hotkeyOk === false) { <p class="hint warn">Another program is using this shortcut. Choose a different one.</p> }
                @if (recordError()) { <p class="hint warn" role="alert">{{ recordError() }}</p> }
              </section>

              <section>
                <h2>Appearance and startup</h2>
                <div class="srow">
                  <label for="theme">Theme</label>
                  <select id="theme" class="select" [value]="s.theme" (change)="theme($event)">
                    <option value="system">Match Windows</option><option value="light">Light</option><option value="dark">Dark</option>
                  </select>
                </div>
                <label class="chkrow"><input id="bg" type="checkbox" [checked]="s.background" (change)="set('background', chk($event))" /><span><b>Keep running in the background</b><p class="hint">Needed to keep saving what you copy after the window is closed.</p></span></label>
                <label class="chkrow"><input id="st" type="checkbox" [checked]="s.startup" (change)="set('startup', chk($event))" /><span><b>Start with Windows</b></span></label>
              </section>

              <section>
                <h2>History</h2>
                <div class="srow">
                  <div><label for="keep">Keep history for</label><p class="hint">Pinned items are always kept.</p></div>
                  <select id="keep" class="select" [value]="s.keepDays" (change)="set('keepDays', num($event))">@for (o of keep; track o[0]) { <option [value]="o[0]" [selected]="o[0] === s.keepDays">{{ o[1] }}</option> }</select>
                </div>
                <div class="srow">
                  <div><label for="hide">Remove hidden items after</label><p class="hint">One-time codes, Aadhaar, PAN, card numbers and keys are hidden when copied.</p></div>
                  <select id="hide" class="select" (change)="set('sensitiveMinutes', num($event))">@for (o of hide; track o[0]) { <option [value]="o[0]" [selected]="o[0] === s.sensitiveMinutes">{{ o[1] }}</option> }</select>
                </div>
                <div class="srow">
                  <div><label for="clear">Clear the clipboard after copying a secret</label></div>
                  <select id="clear" class="select" (change)="set('clearSecretSec', num($event))">@for (o of clears; track o[0]) { <option [value]="o[0]" [selected]="o[0] === s.clearSecretSec">{{ o[1] }}</option> }</select>
                </div>
                <label class="chkrow"><input id="smart" type="checkbox" [checked]="s.semantic" (change)="set('semantic', chk($event))" /><span><b>Smart search</b><p class="hint">Find things by describing them. Runs on this laptop with a model built into the app.{{ api.state()?.smart === 'loading' ? ' Getting ready…' : '' }}{{ api.state()?.smart === 'off' && s.semantic ? ' Not available right now; exact search still works.' : '' }}</p></span></label>
                <div class="srow" style="align-items:start">
                  <div><label for="ign">Never save copies from these programs</label><p class="hint">One per line. Password managers are already listed.</p></div>
                  <textarea id="ign" class="textarea" rows="5" spellcheck="false" [value]="s.ignoredApps.join('\\n')" (change)="ignored($event)"></textarea>
                </div>
              </section>

              <section>
                <h2>Vault</h2>
                <div class="srow">
                  <div><label for="al">Lock the vault after</label><p class="hint">It also locks when you lock Windows.</p></div>
                  <select id="al" class="select" (change)="set('autoLockMin', num($event))">@for (o of lock; track o[0]) { <option [value]="o[0]" [selected]="o[0] === s.autoLockMin">{{ o[1] }}</option> }</select>
                </div>
                @if (api.state()?.vault === 'unlocked') {
                  <div class="srow"><div><div class="lbl">Change password</div></div><button class="btn" type="button" (click)="panel.set(panel() === 'pw' ? '' : 'pw')">Change…</button></div>
                  @if (panel() === 'pw') {
                    <form class="gate" style="margin:0 0 12px;width:100%" (submit)="changePw($event)" novalidate>
                      <div><label class="field-label" for="o">Current password</label><input id="o" class="input" type="password" name="old" autocomplete="current-password" (input)="old.set(val($event))" /></div>
                      <div><label class="field-label" for="n">New password</label><input id="n" class="input" type="password" name="new" autocomplete="new-password" (input)="fresh.set(val($event))" /></div>
                      @if (pwError()) { <p class="err" role="alert">{{ pwError() }}</p> }
                      <div class="actions" style="margin:0"><button class="btn primary" type="submit">Change password</button></div>
                    </form>
                  }
                  <div class="srow"><div><div class="lbl">Backup</div><p class="hint">A file with your IDs and documents, locked with its own passphrase. Use it to move to a new laptop or keep a safe copy.</p></div>
                    <div style="display:flex;gap:8px"><button class="btn" type="button" (click)="backup('export')"><cv-icon name="download" [size]="15" />Export…</button><button class="btn" type="button" (click)="backup('import')"><cv-icon name="upload" [size]="15" />Import…</button></div></div>
                  @if (bk()) {
                    <form class="gate" style="margin:0 0 12px;width:100%" (submit)="runBackup($event)" novalidate>
                      <div><label class="field-label" for="bp">{{ bk() === 'export' ? 'Choose a passphrase for the backup' : 'Passphrase of the backup' }}</label><input id="bp" class="input" type="password" name="passphrase" [attr.autocomplete]="bk() === 'export' ? 'new-password' : 'off'" (input)="bkPass.set(val($event))" /><p class="hint">{{ bk() === 'export' ? 'At least 8 characters. Without it the backup cannot be opened.' : '' }}</p></div>
                      @if (pwError()) { <p class="err" role="alert">{{ pwError() }}</p> }
                      <div class="actions" style="margin:0"><button class="btn primary" type="submit">{{ bk() === 'export' ? 'Save backup…' : 'Choose file…' }}</button></div>
                    </form>
                  }
                }
              </section>

              <section>
                <h2>On this laptop</h2>
                <div class="srow">
                  <div><div class="lbl">Your data</div><p class="hint">Everything is encrypted (AES-256-GCM) and sealed to your Windows account. This app has no network access at all.</p></div>
                  <button class="btn" type="button" (click)="folder()"><cv-icon name="folder" [size]="15" />Show folder</button>
                </div>
                <div class="srow">
                  <div><div class="lbl">Delete all history</div><p class="hint">Removes everything you copied except pinned items. Your IDs and documents are not touched.</p></div>
                  <button class="btn danger" type="button" (click)="clear()">{{ confirm() ? 'Click again to delete' : 'Delete history…' }}</button>
                </div>
                <p class="hint">Clipvault {{ api.state()?.version }}{{ api.state()?.demo ? ' · demo data, not real' : '' }}</p>
              </section>
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class SettingsPage {
  api = inject(Api);
  s = computed(() => this.api.state()?.settings);
  keep = KEEP;
  lock = LOCK;
  hide = HIDE;
  clears = CLEAR;
  recording = signal(false);
  recordError = signal('');
  panel = signal<'' | 'pw'>('');
  bk = signal<'' | 'export' | 'import'>('');
  old = signal('');
  fresh = signal('');
  bkPass = signal('');
  pwError = signal('');
  confirm = signal(false);

  val = (e: Event) => (e.target as HTMLInputElement).value;
  num = (e: Event) => Number((e.target as HTMLSelectElement).value);
  chk = (e: Event) => (e.target as HTMLInputElement).checked;
  set<K extends keyof Settings>(k: K, v: Settings[K]) {
    void this.api.run(() => this.api.call('settings:set', { [k]: v }));
  }
  theme(e: Event) {
    this.set('theme', this.val(e) as Settings['theme']);
  }
  ignored(e: Event) {
    this.set('ignoredApps', this.val(e).split('\n').map((x) => x.trim()).filter(Boolean));
  }
  pretty = (a: string) => a.replace('Control', 'Ctrl').replaceAll('+', ' + ');

  record() {
    this.recordError.set('');
    this.recording.set(true);
  }
  keys(e: KeyboardEvent) {
    if (!this.recording()) return;
    e.preventDefault();
    if (e.key === 'Escape') return this.recording.set(false);
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean) as string[];
    if (!mods.length) return void this.recordError.set('Include Ctrl, Alt or Shift so it does not clash with typing.');
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key.replace('Arrow', '');
    this.recording.set(false);
    this.set('hotkey', [...mods, key].join('+'));
  }

  async changePw(e: Event) {
    e.preventDefault();
    this.pwError.set('');
    if (await this.api.run(() => this.api.call('vault:change', this.old(), this.fresh()), 'Password changed')) this.panel.set('');
    else this.pwError.set(this.api.toast()?.text ?? '');
  }
  backup(kind: 'export' | 'import') {
    this.pwError.set('');
    this.bk.set(this.bk() === kind ? '' : kind);
  }
  async runBackup(e: Event) {
    e.preventDefault();
    const kind = this.bk();
    try {
      const r = await this.api.call<boolean | number>(kind === 'export' ? 'vault:export' : 'vault:import', this.bkPass());
      if (r === false || r === -1) return;
      this.api.say(kind === 'export' ? 'Backup saved' : `Restored ${r} items`);
      this.bk.set('');
    } catch (err) {
      this.pwError.set(err instanceof Error ? err.message : 'That did not work.');
    }
  }
  folder() {
    void this.api.call('app:folder');
  }
  clear() {
    if (!this.confirm()) {
      this.confirm.set(true);
      setTimeout(() => this.confirm.set(false), 4000);
      return;
    }
    this.confirm.set(false);
    void this.api.run(() => this.api.call('history:clear'), 'History deleted');
  }
}
