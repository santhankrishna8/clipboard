---
version: 1
slug: "src-app-app-html"
primary_target: "src/app/app.html"
related_targets: []
---

# Clipvault app surface (all windows: history, IDs, documents, settings, lock, quick-paste popup)

Mode: Operate. Success: a copied item, number or document is found and on the clipboard in two actions; sensitive values stay hidden until asked for.

## Audience, job, constraints
The builder and friends (mixed computer comfort, plain words first) on Windows 11 in a 1180x760 Electron window plus a hotkey popup. Jobs: find something copied earlier; pull out an Aadhaar/PAN/licence/bank number; share a PDF. Synthetic demo content only. Hit targets at least 24px, keyboard-complete, light and dark both designed, reduced motion honoured.

## Chosen direction: The Comb-Box Form (user-picked from the pick card)
Indian bank/passport application forms: dropout-green stock, ballpoint blue, one character per square box.

## Memorable moment
Copying an ID number writes it back in ballpoint blue, box by box, left to right, then settles; the same boxes carry every number in the product.

## Unresolved
Logo mark (a small boxed "C" drawn as authored SVG). Website reuses the same world as a persuade surface later.

## Direction contract

THESIS: Numbers are what people come here for, so every number is set the way an Indian form sets it, one character per square box, and the whole app reads as a calm, filled-in form instead of the grey three-pane clipboard manager with identical rows.

OWN-WORLD: Dropout-green form stock: paper #f6f8f3, rail #e9efe4, rule green #b9cdb6, box outline #8fae93, ink #16241c, secondary text #54665a. One ink for action, ballpoint blue #1f3fae (white text on it). Ink red #a8321f only for expiry and hidden-until-asked warnings. Square corners (2-3px), form captions in sentence case at 12.5px semibold, boxed inputs, hairline rules; no shadows except the popup. Night form for dark: #0f1712 paper, #141f18 rail, light blue ink #9db2ff. Type: Hanken Grotesk with tabular figures in fixed-width cells.

STORY: The user sees immediately that everything they copy is kept privately on this laptop, finds any item by typing or describing it, and gets a number or file out in two actions; a recruiter sees a product with one specific idea, not a template.

FIRST VIEWPORT: 1180x760 window. Left rail 232px: wordmark Clipvault, nav History / IDs / Documents / Settings, and at the foot a plain note "Everything stays on this laptop". Middle column 440px: boxed search field, filter tabs, day groups, rows (kind icon, one-line preview, small meta line, small label for pinned/hidden/time left). Right pane fills the rest: the open item, with Copy as the single blue primary at the top; for an ID the value sits in comb boxes with a Show control, and copying writes it in blue, box by box.

FORM: The Comb-Box Form, candidate 1 of 7 on the ordered list (the IMPECCABLE'S PICK card, chosen by the user); seed: seed:c9402e398e55d160.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
