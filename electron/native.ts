// The Windows clipboard calls Electron does not expose, through koffi (no compiler, no native build step).
// Electron forbids external ArrayBuffers, so koffi.view() must never be used here: memory is filled with RtlMoveMemory.
import koffi from 'koffi';
import { basename } from 'node:path';

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');
const shell32 = koffi.load('shell32.dll');

const GetClipboardSequenceNumber = user32.func('uint32_t GetClipboardSequenceNumber()');
const RegisterClipboardFormatW = user32.func('uint32_t RegisterClipboardFormatW(str16 name)');
const IsClipboardFormatAvailable = user32.func('bool IsClipboardFormatAvailable(uint32_t f)');
const OpenClipboard = user32.func('bool OpenClipboard(void *h)');
const CloseClipboard = user32.func('bool CloseClipboard()');
const EmptyClipboard = user32.func('bool EmptyClipboard()');
const SetClipboardData = user32.func('void *SetClipboardData(uint32_t f, void *h)');
const GetClipboardData = user32.func('void *GetClipboardData(uint32_t f)');
const GetClipboardOwner = user32.func('void *GetClipboardOwner()');
const GetWindowThreadProcessId = user32.func('uint32_t GetWindowThreadProcessId(void *h, _Out_ uint32_t *pid)');
const GetForegroundWindow = user32.func('void *GetForegroundWindow()');
const SetForegroundWindow = user32.func('bool SetForegroundWindow(void *h)');
const keybd_event = user32.func('void keybd_event(uint8_t vk, uint8_t scan, uint32_t flags, uintptr_t extra)');
const GlobalAlloc = kernel32.func('void *GlobalAlloc(uint32_t flags, size_t n)');
const GlobalLock = kernel32.func('void *GlobalLock(void *h)');
const GlobalUnlock = kernel32.func('bool GlobalUnlock(void *h)');
const RtlMoveMemory = kernel32.func('void RtlMoveMemory(void *dst, const void *src, size_t n)');
const OpenProcess = kernel32.func('void *OpenProcess(uint32_t access, bool inherit, uint32_t pid)');
const CloseHandle = kernel32.func('bool CloseHandle(void *h)');
const QueryFullProcessImageNameW = kernel32.func('bool QueryFullProcessImageNameW(void *p, uint32_t flags, _Out_ uint16_t *buf, _Inout_ uint32_t *n)');
const DragQueryFileW = shell32.func('uint32_t DragQueryFileW(void *h, uint32_t i, _Out_ uint16_t *buf, uint32_t n)');

const CF_UNICODETEXT = 13;
const CF_HDROP = 15;
// Password managers set this; Windows' own history and cloud clipboard honour it, so we do too.
const EXCLUDE = RegisterClipboardFormatW('ExcludeClipboardContentFromMonitorProcessing');
const wide = (s: string) => Buffer.from(s + '\0', 'utf16le');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const clipSeq = () => GetClipboardSequenceNumber() as number;
export const isExcluded = () => IsClipboardFormatAvailable(EXCLUDE) as boolean;

/** Program that put the current content on the clipboard, e.g. "chrome". */
export function owner(): string | undefined {
  const w = GetClipboardOwner();
  if (!w) return undefined;
  const pid = [0];
  GetWindowThreadProcessId(w, pid);
  const p = OpenProcess(0x1000, false, pid[0]); // PROCESS_QUERY_LIMITED_INFORMATION
  if (!p) return undefined;
  try {
    const n = [1024], buf = new Uint16Array(1024);
    if (!QueryFullProcessImageNameW(p, 0, buf, n)) return undefined;
    return basename(Buffer.from(buf.buffer, 0, n[0] * 2).toString('utf16le'), '.exe');
  } finally {
    CloseHandle(p);
  }
}

async function withClipboard<T>(fn: () => T): Promise<T> {
  for (let i = 0; i < 10; i++) {
    if (OpenClipboard(null)) {
      try {
        return fn();
      } finally {
        CloseClipboard();
      }
    }
    await sleep(25); // another program has it open for a moment
  }
  throw new Error('The clipboard is busy. Try again');
}

/** Paths of files copied in Explorer (CF_HDROP), empty if the clipboard holds something else. */
export async function readFiles(): Promise<string[]> {
  if (!IsClipboardFormatAvailable(CF_HDROP)) return [];
  return withClipboard(() => {
    const h = GetClipboardData(CF_HDROP);
    if (!h) return [];
    const count = DragQueryFileW(h, 0xffffffff, null, 0) as number;
    const out: string[] = [];
    for (let i = 0; i < Math.min(count, 200); i++) {
      const buf = new Uint16Array(1024);
      const len = DragQueryFileW(h, i, buf, 1024) as number;
      out.push(Buffer.from(buf.buffer, 0, len * 2).toString('utf16le'));
    }
    return out;
  });
}

function put(format: number, data: Buffer) {
  const h = GlobalAlloc(0x42, data.length); // GMEM_MOVEABLE | GMEM_ZEROINIT
  const p = GlobalLock(h);
  RtlMoveMemory(p, data, data.length);
  GlobalUnlock(h);
  SetClipboardData(format, h);
}

/** Replace the clipboard. `secret` adds the exclude flag so Win+V and cloud clipboard never record it. */
async function write(formats: [number, Buffer][], secret: boolean) {
  await withClipboard(() => {
    EmptyClipboard();
    for (const [f, d] of formats) put(f, d);
    if (secret) put(EXCLUDE, Buffer.from([1, 0, 0, 0]));
  });
}
export const writeText = (text: string, secret = false) => write([[CF_UNICODETEXT, wide(text)]], secret);
export function writeFiles(paths: string[]) {
  const head = Buffer.alloc(20);
  head.writeUInt32LE(20, 0); // offset of the file list
  head.writeUInt32LE(1, 16); // wide characters
  return write([[CF_HDROP, Buffer.concat([head, wide(paths.join('\0') + '\0')])]], false);
}

export const foregroundWindow = () => GetForegroundWindow();
/** Give focus back to `hwnd` and press Ctrl+V there. */
export async function pasteInto(hwnd: unknown) {
  if (hwnd) SetForegroundWindow(hwnd);
  await sleep(90);
  const KEYUP = 2, CTRL = 0x11, V = 0x56;
  keybd_event(CTRL, 0, 0, 0);
  keybd_event(V, 0, 0, 0);
  keybd_event(V, 0, KEYUP, 0);
  keybd_event(CTRL, 0, KEYUP, 0);
}
