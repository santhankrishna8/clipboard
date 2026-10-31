# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Already decided by the user: Electron (TypeScript, Windows desktop shell) with Angular 20 for the windows. The marketing site is a separate static HTML/CSS page. The UI is web technology inside Electron, so the platform is `web`.

## Users
Primary: the builder (Windows 11 laptop) and friends they share the installer with, each on their own laptop with their own empty data. Comfort with computers is mixed, so the main flow uses plain words and keeps technical detail (encryption, key handling) in Settings or an About view. Secondary audience (confirmed): recruiters and hiring managers who judge the product from the website, a demo and screenshots on a resume, portfolio and LinkedIn.

## Product Purpose
Clipvault keeps everything you copy (text, screenshots, files) and a small private vault for the numbers and documents you keep needing: Aadhaar, PAN, driving licence, bank details, PDFs. Windows' own Win+V history holds 25 items and drops the unpinned ones on restart; Clipvault keeps them all, encrypted on the laptop, and finds them again by typing exact text or describing what it was. Success: a number or document is on the clipboard in two keystrokes, and nothing ever leaves the laptop.

## Positioning
Local only, by construction: no account, no server, no sync, no network access at all. Data is encrypted and bound to this Windows user on this PC, so a copied data folder opens nowhere else. Smart search runs on a model bundled in the app, so describing a thing finds it without sending text anywhere. A cloud clipboard or password manager cannot truthfully claim any of this.

## Operating Context
Windows 11 desktop. The user is mid-task in another app (a form, a chat, an email) and needs a value or file now, via a global hotkey popup (default Ctrl+Shift+V, since Win+V is reserved by Windows). The main window is for browsing history, managing ID cards and documents, and settings. Indian identity documents are first-class (Aadhaar with checksum, PAN, driving licence, bank account with IFSC and UPI). Documents are mostly PDFs and photos, previewed in-app, dragged out into chats and mail, or copied as files.

## Capabilities and Constraints
- Clipboard history: text, screenshots (kept as an encrypted copy, with Save and Show-in-folder), files (path kept, Show in folder). Pin, delete with undo, pause capture. Items that look like OTPs, Aadhaar, PAN, card numbers or tokens are masked and expire (default 60 min, 10 for OTP-like). Honours the Windows "exclude from history" flag and an ignored-apps list (password managers).
- Hotkey quick-paste popup: search history and, when unlocked, ID fields. Enter pastes into the previous app. Secret values skip Windows history and clear from the clipboard after 30 seconds.
- Vault: one master password (minimum 8 characters), auto-locks (default 5 minutes, and on screen lock). Cards: Aadhaar, PAN, driving licence, passport, voter ID, bank account, custom. Values masked by default, one-click copy, soft validation (Aadhaar checksum, PAN pattern, IFSC), expiry reminders. Documents: import, in-app preview (pdf.js), search inside PDFs with a marked passage, save a copy, open, copy file, drag out. Encrypted backup file with its own passphrase for moving to a new PC. A forgotten password cannot be recovered; the UI must say so before the password is set.
- No cloud, no accounts, no analytics, no OCR (scanned PDFs and photos are findable by name only). Data folder: %APPDATA%\Clipvault.
- Smart search: bundled MiniLM embeddings, hybrid with exact-text match (ported from the user's Ask Your Docs project). Can be turned off.
- Names: app Clipvault; sections History, IDs, Documents, Settings.

## Brand Commitments
Name: Clipvault (confirmed by the user). The user wants a premium, clean, simple, easy-to-understand UI with simple colours that does not look AI-built. Prior preference from the user's Ask Your Docs project: they rejected a navy / serif / vermilion look as "looks like AI built it".

## Evidence on Hand
No users, customers, benchmarks or testimonials exist; none may be invented. All demo content (fake IDs, fake documents, fake clipboard history) must be labelled synthetic. Real measurements will come from the build itself (installer size, idle memory, search accuracy from the eval).

## Product Principles
1. Plain words first; technical detail on request.
2. Anything sensitive is hidden until asked for, and says how long it will stay.
3. Two keystrokes from anywhere to the thing you need.
4. Honest about limits: no recovery for a lost password, no OCR, local only.
5. Nothing leaves the laptop, and the interface shows that it doesn't.

## Accessibility & Inclusion
Follow the user's web interface guidelines: keyboard-complete (the hotkey popup is keyboard-first), visible focus, AA contrast, reduced motion honoured, hit targets at least 24px, usable at the window minimum width. English UI with India-specific document types. Colour is never the only status cue.
