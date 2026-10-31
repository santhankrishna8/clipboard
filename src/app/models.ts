// Types shared by the Electron main process (electron/*.ts) and the Angular renderer. Types only: nothing here runs.

export type Kind = 'text' | 'image' | 'files';
export type SensitiveKind = 'otp' | 'aadhaar' | 'pan' | 'card' | 'secret';

/** One clipboard entry as stored (sealed) on disk. */
export interface Item {
  id: string;
  kind: Kind;
  at: number; // last copied
  first: number;
  hits: number;
  hash: string;
  text?: string;
  files?: string[];
  blob?: string;
  w?: number;
  h?: number;
  bytes?: number;
  pinned?: boolean;
  sensitive?: SensitiveKind;
  expires?: number;
  app?: string;
  vec?: string; // base64 Float32Array(384), the smart-search embedding
}

/** What the list shows. Secrets are masked here; the full text only leaves main through `history:reveal`. */
export interface PubItem {
  id: string;
  kind: Kind;
  at: number;
  pinned: boolean;
  preview: string;
  length?: number;
  sensitive?: SensitiveKind;
  expires?: number;
  app?: string;
  w?: number;
  h?: number;
  bytes?: number;
  files?: string[];
  via?: 'text' | 'meaning';
}

export type CardKind = 'aadhaar' | 'pan' | 'dl' | 'passport' | 'voter' | 'bank' | 'other';
export interface Field {
  key: string;
  label: string;
  value: string;
  secret?: boolean;
}
export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  fields: Field[];
  added: number;
  updated: number;
}
export interface PubField {
  key: string;
  label: string;
  secret: boolean;
  shown: string;
  warn?: string;
}
export interface PubCard {
  id: string;
  kind: CardKind;
  title: string;
  fields: PubField[];
  updated: number;
  expiry?: number;
}

export interface DocMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  pages: number;
  added: number;
  blob: string;
  chunks: number;
}
export interface DocHit {
  doc: DocMeta;
  page: number | null;
  snippet: string;
  passage: string; // the whole matched passage, so the page viewer can mark it
  via: 'name' | 'text' | 'meaning';
}

export interface Settings {
  hotkey: string;
  theme: 'system' | 'light' | 'dark';
  keepDays: number; // 0 = forever
  autoLockMin: number;
  clearSecretSec: number;
  sensitiveMinutes: number;
  background: boolean; // keep capturing from the tray after the window closes
  startup: boolean;
  semantic: boolean;
  ignoredApps: string[];
}

export interface AppState {
  settings: Settings;
  privateMode: boolean;
  history: 'ok' | 'foreign'; // 'foreign': the data was sealed by another Windows user or PC
  vault: 'none' | 'locked' | 'unlocked';
  smart: 'loading' | 'ready' | 'off';
  version: string;
  demo: boolean;
  hotkeyOk: boolean;
}

export interface QuickRow {
  id: string;
  group: 'Pinned' | 'Recent' | 'Identity' | 'Matches';
  title: string;
  sub: string;
  icon: Kind | CardKind | 'lock';
  secret?: boolean;
  tail?: string; // last characters of a hidden ID value, drawn as small boxes
}

export const DEFAULTS: Settings = {
  hotkey: 'Control+Shift+V',
  theme: 'system',
  keepDays: 0,
  autoLockMin: 5,
  clearSecretSec: 30,
  sensitiveMinutes: 60,
  background: true,
  startup: false,
  semantic: true,
  ignoredApps: ['1Password', 'Bitwarden', 'KeePass', 'KeePassXC', 'Dashlane', 'LastPass', 'NordPass', 'Enpass'],
};

export const TEMPLATES: Record<CardKind, { label: string; fields: Omit<Field, 'value'>[] }> = {
  aadhaar: { label: 'Aadhaar', fields: [{ key: 'name', label: 'Name on card' }, { key: 'number', label: 'Aadhaar number', secret: true }] },
  pan: { label: 'PAN card', fields: [{ key: 'name', label: 'Name on card' }, { key: 'number', label: 'PAN', secret: true }] },
  dl: { label: 'Driving licence', fields: [{ key: 'name', label: 'Name' }, { key: 'number', label: 'Licence number', secret: true }, { key: 'expiry', label: 'Valid till' }] },
  passport: { label: 'Passport', fields: [{ key: 'name', label: 'Name' }, { key: 'number', label: 'Passport number', secret: true }, { key: 'expiry', label: 'Valid till' }] },
  voter: { label: 'Voter ID', fields: [{ key: 'name', label: 'Name' }, { key: 'number', label: 'EPIC number', secret: true }] },
  bank: {
    label: 'Bank account',
    fields: [{ key: 'bank', label: 'Bank' }, { key: 'holder', label: 'Account holder' }, { key: 'number', label: 'Account number', secret: true }, { key: 'ifsc', label: 'IFSC' }, { key: 'upi', label: 'UPI ID' }],
  },
  other: { label: 'Something else', fields: [] },
};
