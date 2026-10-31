import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AppState } from './models';

declare global {
  interface Window {
    clip: {
      call<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
      send(channel: string, ...args: unknown[]): void;
      on(cb: (name: string, payload?: unknown) => void): () => void;
    };
  }
}

export interface Toast {
  text: string;
  undo?: () => void;
}

/** Everything the windows know about the main process: one place for calls, state, toasts and undo. */
@Injectable({ providedIn: 'root' })
export class Api {
  private router = inject(Router);
  state = signal<AppState | null>(null);
  /** Bumps whenever data changed in the main process, so open views reload. */
  tick = signal(0);
  toast = signal<Toast | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;
  private pending = new Set<() => void>();
  private thumbs = new Map<string, Promise<string | undefined>>();

  constructor() {
    void this.refresh();
    window.clip.on((name, payload) => {
      if (name === 'changed') {
        void this.refresh();
        this.tick.update((n) => n + 1);
      } else if (name === 'goto') void this.router.navigateByUrl(String(payload));
    });
    // Deletes wait out their undo window; closing the window commits them rather than losing the user's intent.
    window.addEventListener('pagehide', () => [...this.pending].forEach((f) => f()));
  }

  call<T = unknown>(channel: string, ...args: unknown[]) {
    return window.clip.call<T>(channel, ...args);
  }
  async refresh() {
    this.state.set(await this.call<AppState>('state'));
  }
  /** Runs `fn`; any failure becomes a readable toast instead of an unhandled rejection. */
  async attempt<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    try {
      const r = await fn();
      if (ok) this.say(ok);
      return r;
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Something went wrong');
      return undefined;
    }
  }

  /** Like `attempt` for calls that return nothing: true when it worked. */
  async run(fn: () => Promise<unknown>, ok?: string): Promise<boolean> {
    try {
      await fn();
      if (ok) this.say(ok);
      return true;
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Something went wrong');
      return false;
    }
  }

  say(text: string, undo?: () => void) {
    clearTimeout(this.toastTimer);
    this.toast.set({ text, undo });
    this.toastTimer = setTimeout(() => this.toast.set(null), undo ? 8000 : 3500);
  }
  dismiss() {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  /** Hide now, delete for real after 8 seconds unless the user taps Undo. */
  undoable(text: string, hide: (hidden: boolean) => void, commit: () => Promise<unknown>) {
    hide(true);
    const run = () => {
      clearTimeout(timer);
      this.pending.delete(run);
      void commit();
    };
    const timer = setTimeout(run, 8000);
    this.pending.add(run);
    this.say(text, () => {
      clearTimeout(timer);
      this.pending.delete(run);
      hide(false);
      this.dismiss();
    });
  }

  /** Small data-URL thumbnails, fetched once per item. */
  thumb(id: string) {
    let p = this.thumbs.get(id);
    if (!p) {
      p = this.call<string | undefined>('history:thumb', id).catch(() => undefined);
      this.thumbs.set(id, p);
      if (this.thumbs.size > 400) this.thumbs.delete(this.thumbs.keys().next().value!);
    }
    return p;
  }
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const day = new Intl.DateTimeFormat('en', { weekday: 'long' });
const full = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });
const clock = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });

export function ago(t: number, now = Date.now()): string {
  const s = Math.round((t - now) / 1000);
  if (Math.abs(s) < 45) return 'just now';
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
export function dayLabel(t: number, now = new Date()): string {
  const d = new Date(t);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? day.format(d) : full.format(d);
}
export const timeOf = (t: number) => clock.format(new Date(t));
export const fullDate = (t: number) => full.format(new Date(t));
export function bytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}
export function left(until: number, now = Date.now()): string {
  const m = Math.max(1, Math.round((until - now) / 60000));
  return m < 60 ? `${m} min left` : `${Math.round(m / 60)} h left`;
}
