# Clipvault

A clipboard history and a private vault for IDs and documents, for Windows. Everything stays on the laptop it runs on.

- **History.** Keeps everything you copy (text, screenshots, files), not the last 25. Pin, delete with undo, pause capture.
- **Quick paste.** `Ctrl+Shift+V` anywhere, type a few letters, `Enter` pastes into the program you were in.
- **IDs.** Aadhaar, PAN, driving licence, passport, voter ID, bank account. Numbers stay hidden until asked for, are set in one box per character, are checked as you type (the Aadhaar checksum, the PAN pattern, IFSC), copy in one click and clear from the clipboard after 30 seconds.
- **Documents.** Import PDFs and photos, preview them, search inside PDFs with the matched passage marked, drag them straight into a chat or email.
- **Smart search.** Find things by what they say or what they mean ("when does my plane leave for Bangalore" finds the flight booking). Runs on a model bundled in the installer.
- **Honest about limits.** No OCR (scans are found by name), the vault password cannot be recovered (a passphrase-locked backup file is how you move or restore), English only.

## Privacy and security

| | |
|---|---|
| No network | The app blocks every network request (`electron/main.ts`, `hardenSession`). The search model ships inside the installer; nothing is downloaded at run time. |
| Encryption | AES-256-GCM for every item, image and document. |
| History key | Random 256-bit key sealed by Windows DPAPI (Electron `safeStorage`): the data folder opens only for the same Windows user on the same PC. |
| Vault key | Random key wrapped by `scrypt(password + device secret)`. The device secret is also DPAPI-sealed, so a copied vault file is useless on another PC even with the right password. |
| Locking | Auto-locks (5 minutes by default) and when Windows locks. The key is zeroed and the decrypted rows are dropped from memory. |
| Secrets in history | OTPs, Aadhaar, PAN, card numbers and API keys are detected, masked and expire (10 minutes for OTP-like, 60 for the rest). |
| Clipboard hygiene | Respects `ExcludeClipboardContentFromMonitorProcessing` (password managers set it) and an ignored-programs list. Secrets copied from the vault carry the same flag, so Windows' own Win+V history and cloud clipboard are asked not to record them, and the clipboard is cleared after 30 seconds. |
| Where the data is | `%APPDATA%\Clipvault`. Items are appended as sealed records to one log file, so a crash can only lose the last write. |

What it does not protect against: malware running as you while the vault is unlocked, someone with your Windows password, a forgotten vault password.

## Run it

```
npm install
npm run web          # builds the Angular windows (leave running, or use npm run build once)
npm start            # opens Clipvault
npm run demo         # same, on throwaway made-up data (vault password: clipvault-demo)
```

Build the Windows installer (about 180 MB, because it carries Electron, the search runtime and the 23 MB model):

```
npm run dist         # writes release/Clipvault Setup 1.0.0.exe
npm run pack         # unpacked app in release/win-unpacked, faster, for testing
```

The installer is not code-signed, so Windows SmartScreen will say "unknown publisher" the first time. A signing certificate removes that.

## Checks

| Command | What it proves |
|---|---|
| `npm run check` | Encryption round trips, tamper and wrong-key failures, a torn write in the log, key binding to the device secret, ID detection (Verhoeff, Luhn, PAN), hybrid search ranking. No Electron needed. |
| `npm run e2e` | Launches the real app on an empty data folder and copies things the way other programs do: text, a duplicate, an OTP, text flagged by a password manager (must be skipped), an image, a file. Checks capture, dedupe, masking, search, that Clipvault's own copies are not re-captured, and that no plaintext reaches disk. |
| `npm run eval` | Retrieval quality of the search (below). |
| `node scripts/smoke.mjs` | Launches the packaged app from `release/win-unpacked` and checks it renders styled, loads the model and answers a meaning query. |
| `npm run shots` | Screenshots of every screen, light and dark, from the real app on demo data. |

### Search quality

24 realistic clipboard items, each asked two ways: a paraphrase that shares no words with the item, and an exact fragment. Hybrid search is the one in the app: exact text first, then keywords weighted by rarity, then meaning (MiniLM embeddings), merged by reciprocal rank fusion. It is the retrieval core of the author's *Ask Your Docs* project, ported from SQL to in-memory TypeScript.

| search | paraphrase, first | paraphrase, top 3 | exact fragment, first |
|---|---|---|---|
| keywords only | 0% | 0% | 100% |
| meaning only | 79% | 92% | 88% |
| **hybrid** | **79%** | **92%** | **100%** |

Unrelated questions return nothing. The cut-off was picked from a sweep on this same set and the items are made up, so read it as a regression check, not a benchmark.

## How it is built

```
electron/            main process, runs as TypeScript directly (Node strips the types)
  main.ts            windows, tray, hotkey, the app:// protocol and its CSP, IPC
  history.ts         clipboard watcher, dedupe, sensitive detection, search index
  vault.ts           password, IDs, documents, backup
  crypto.ts          AES-GCM, scrypt, the encrypted append-only log
  native.ts          Win32 calls through koffi: clipboard sequence number, exclude flag, owner, file lists, paste
  search.ts          hybrid search + the embedding worker thread
src/app/             Angular windows (zoneless, signals)
site/                the showcase website (static)
scripts/             e2e, eval, smoke and screenshot tools
DESIGN.md            the design system (The Comb-Box Form)
```

## The website

`site/` is plain HTML, CSS and JavaScript: open `site/index.html`, or host the folder anywhere. Its demos run in the browser and send nothing. The download button links to the installer attached to the latest GitHub release (`RELEASE_URL` at the top of `site/site.js`). Attach the installer under the fixed name `Clipvault-Setup.exe` (`release/Clipvault-Setup.exe` after `npm run dist`; copy it from `Clipvault Setup <version>.exe`) and every new release keeps the same link. The installer is too large to host beside the page.

Every ID, document and clipboard item in screenshots, the demo mode and the website is made up.

## License

MIT, see `LICENSE`. Clipvault bundles the all-MiniLM-L6-v2 embedding model (Apache-2.0, ONNX conversion by Xenova), the Hanken Grotesk typeface (SIL Open Font License 1.1) and Lucide icons (ISC). Other packages carry their own licences in `node_modules`.

## Code signing policy

Status: **applying to SignPath Foundation; releases are not signed yet.** Until then, Windows and your browser will ask you to confirm the installer, because the publisher is unknown. Every release lists its SHA-256 checksum so you can check the file you downloaded, and the installer is built by `.github/workflows/release.yml` from the code in this repository.

Once approved, releases will be signed through SignPath: *Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).*

- Authors, reviewers and approvers: the repository owner, [santhankrishna8](https://github.com/santhankrishna8).
- Privacy: this program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it. Clipvault makes no network connections at all.
- Setup steps: `docs/code-signing.md`.
