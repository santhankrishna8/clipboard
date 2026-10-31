---
name: Clipvault
description: A clipboard and private vault that reads like a filled-in Indian application form, with every number set one character per box in ballpoint-blue ink.
colors:
  paper: "#f6f8f3"
  field: "#fdfefb"
  rail: "#e9efe4"
  rule: "#c9d7c5"
  edge: "#6f8f75"
  box: "#8aab8f"
  selected: "#e1eadc"
  ink: "#16241c"
  mute: "#54665a"
  ballpoint-blue: "#1f3fae"
  on-blue: "#ffffff"
  blue-wash: "#dfe6fa"
  ink-red: "#a8321f"
  red-wash: "#f6e4df"
  safe-green: "#276a43"
  night-paper: "#0f1712"
  night-pane: "#151f19"
  night-field: "#1a261f"
  night-rule: "#2c4033"
  night-edge: "#6a8b75"
  night-box: "#557562"
  night-selected: "#1d2c23"
  night-ink: "#e3ebe4"
  night-mute: "#9bb0a1"
  night-blue: "#9db2ff"
  night-on-blue: "#0b1020"
  night-blue-wash: "#1e2a55"
  night-red: "#f2917b"
  night-red-wash: "#3a1d17"
  night-safe-green: "#7fcf9f"
typography:
  title:
    fontFamily: "'Hanken Grotesk Variable', 'Segoe UI Variable Text', 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Hanken Grotesk Variable', 'Segoe UI Variable Text', 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "'Hanken Grotesk Variable', 'Segoe UI Variable Text', 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "'Hanken Grotesk Variable', 'Segoe UI Variable Text', 'Segoe UI', sans-serif"
    fontSize: "12.5px"
    fontWeight: 650
    lineHeight: 1.45
  cell:
    fontFamily: "'Hanken Grotesk Variable', 'Segoe UI Variable Text', 'Segoe UI', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    fontFeature: "'tnum'"
rounded:
  sm: "2px"
  md: "3px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "32px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  button-primary:
    backgroundColor: "{colors.ballpoint-blue}"
    textColor: "{colors.on-blue}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "34px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.ink-red}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
    height: "36px"
  cell:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    width: "28px"
    height: "38px"
  nav-item:
    textColor: "{colors.mute}"
    rounded: "{rounded.md}"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
  row:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    height: "56px"
  row-selected:
    backgroundColor: "{colors.selected}"
  chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "28px"
  slip:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "20px"
---

# Design System: Clipvault

## Overview

**Creative North Star: "The Comb-Box Form"**

Clipvault is a filled-in Indian bank or passport application: pale dropout-green stock, hairline green rules, square boxed fields, and exactly one pen, a ballpoint blue. The numbers people come for (Aadhaar, PAN, bank accounts) are set one character per square box, and the same boxes carry every number in the product. It is calm and dense, a form somebody has already completed, not a grey three-pane clipboard tool.

Blue is the only action ink. Red appears only for expiry, hidden-until-asked warnings and destructive actions. Everything else is green-tinted neutral. Corners are 2-3px, captions are sentence case, and depth comes from rules and outlines rather than shadow. The dark scheme (follows `prefers-color-scheme`) is the same form at night: green-black stock with a light periwinkle ink.

**Key Characteristics:**
- Dropout-green neutrals, never grey; one blue ink for action and focus.
- One character per box wherever a short number is shown; tabular figures.
- Square 3px corners, 1px outlines, hairline rules, sentence-case captions at 12.5px.
- Flat at rest; shadow only on the toast (and the PDF page sheet).
- Light and dark are both first-class and token-swapped, not inverted.

## Colors

Green-tinted paper and rules with a single blue ink; red and green are status only.

### Primary
- **Ballpoint Blue** (`ballpoint-blue`, night: `night-blue`): primary button fill, focus ring, selection, checkbox accent, the "written" ink in the copy moment, active cells in the password comb. White text on it in light (`on-blue`), near-black (`night-on-blue`) in dark.
- **Blue Wash** (`blue-wash`, night: `night-blue-wash`): the settling tint behind freshly written cells, banners, blue slips, PDF drop target.

### Secondary
- **Ink Red** (`ink-red`, night: `night-red`, wash `red-wash`): expiry, hidden-until-asked warnings, errors, danger buttons.
- **Safe Green** (`safe-green`, night: `night-safe-green`): the "stays on this laptop" shield only.

### Neutral
- **Dropout Paper** (`paper`, night `night-paper`): app and list-column background. The detail pane uses `pane` (same in light, `night-pane` in dark).
- **Field White** (`field`, night `night-field`): inputs, cells, active nav item, previews, gate card.
- **Rail Green** (`rail`; same as `night-field` in dark): sidebar and quick-paste footer.
- **Rule Green** (`rule`, night `night-rule`): hairline dividers and quiet borders.
- **Edge Green** (`edge`, night `night-edge`): input, button and selected-row outlines (about 3.2:1 on paper).
- **Box Green** (`box`, night `night-box`): comb-box outline; the character inside carries the contrast.
- **Selection Tint** (`selected`, night `night-selected`): hover and selected row, hover for ghost buttons.
- **Form Ink** (`ink`, night `night-ink`) and **Pencil Grey-Green** (`mute`, night `night-mute`): primary and secondary text.

### Named Rules
**The One Pen Rule.** Blue is the only action color. It marks what you can do or what was just written, never decoration.

**The Red Is a Warning Rule.** Red appears only for expiry, hidden-until-asked and destructive states, and always with words or an icon beside it.

## Typography

**Display/Body Font:** Hanken Grotesk Variable (with Segoe UI Variable Text, Segoe UI, sans-serif), bundled via fontsource.
**Label/Mono Font:** none; figures use the same face with `tabular-nums`.

**Character:** One humanist grotesque at small, even sizes. Hierarchy comes from weight (550-700) and the green-grey secondary color, not size jumps.

### Hierarchy
- **Title** (650, 22px, 1.25, -0.015em): item or page name in the detail pane, balanced wrap.
- **Headline** (650, 15px, 1.3): section and empty-state headings.
- **Body** (400-600, 14px, 1.45): rows, buttons, nav; previews at 14.5px / 1.55.
- **Label** (650, 12.5px): form captions, day groups, meta lines (12.5px regular, `mute`), hints.
- **Cell** (600, 18px, tabular): characters in comb boxes; 15px in the password comb and at narrow widths.

### Named Rules
**The Sentence Case Rule.** Captions are sentence case at 12.5px semibold; no uppercase, no tracking.

## Layout

Fixed desktop-window grid: a 224px rail, then a content area of a list column (300-440px) and a fluid detail pane; `.main.wide` drops to a single pane. Detail pane has 52px top padding (below the drag region), 32px side padding and 18px body padding. Spacing is a 4/8/12/16 rhythm with 32px for pane gutters; rows are 56px (48px in the quick-paste popup). Settings content caps at 640px. Below 1000px the rail collapses to a 60px icon strip, the list column narrows to 250-330px, pane padding shrinks to 20-24px, cells shrink to 22x32px, and small action buttons lose labels. The quick-paste popup is a full-height single column: boxed search, grouped rows, a keyboard-hint footer.

## Elevation & Depth

Flat by default. Depth is carried by 1px outlines, hairline rules, and tonal steps from paper to field.

### Shadow Vocabulary
- **Toast** (`box-shadow: 0 1px 2px rgb(22 36 28 / 0.12), 0 8px 24px rgb(22 36 28 / 0.16)`; dark: `0 1px 2px rgb(0 0 0 / 0.5), 0 10px 30px rgb(0 0 0 / 0.5)`): the undo toast only.
- **PDF sheet** (`0 1px 3px rgb(0 0 0 / 0.18)`): page sheets in the viewer, to lift a rendered page off its frame.

### Named Rules
**The Outline Not Shadow Rule.** Selected and active states are a 1px `edge` inset outline, not a lift.

## Shapes

Square-ish: 3px radius on controls, cells, rows, cards and inputs; 2px on slips, mini cells and kbd. Everything is a 1px outline box. Only spinners and the dot placeholder in masked cells are round. Fixed-size character cells (28x38) in groups with 3px gaps and 14px between groups, mirroring a printed comb field.

## Components

### Buttons
- **Shape:** 3px corners, 34px tall (sm 28px, icon 34 or 28 square), 1px `edge` outline, 600 weight.
- **Primary:** Ballpoint Blue fill, `on-blue` text; hover brightens 12%. One per view.
- **Ghost (default):** transparent with `edge` outline; hover fills `selected`. **Quiet:** no outline until hover. **Danger:** `ink-red` text and outline, `red-wash` on hover.
- **Active / disabled:** 1px downward nudge; 50% opacity. Focus is a 2px blue outline offset 2px.

### Inputs / Fields
- **Style:** `field` fill, 1px `edge`, 3px radius, 36px tall (search 40px, quick search 44px/16px text). Placeholder in `mute`.
- **Hover / focus:** border goes to `ink`; focus is a 2px blue outline at 0 offset. **Error:** `ink-red` border plus a red message.
- Selects use a drawn chevron; checkboxes and radios are 16px with blue accent.

### Navigation
- Rail links: 36px, `mute` text at weight 550, icon plus label, optional tabular count. Hover tints `selected`; the active link is `field` with an inset `edge` outline. Collapses to centred icons under 1000px.

### Chips
- Filter tabs: 28px, transparent, `mute` text; pressed state is solid `ink` with `paper` text.

### List rows
- 56px, 8px side margin, 32px boxed kind icon, one-line title (600) over a 12.5px `mute` meta line. Hover and selected use `selected`; selected adds the inset outline. Day headings are 12.5px semibold `mute`.
- Slips: small 20px boxed labels for pinned, hidden, time left; red and blue variants carry words as well as color.

### Comb Boxes (signature)
- `cv-digits` renders a value as groups of square cells, one character each, `field` fill, `box` outline. Masked values show dots with the last four characters. Values that are long or contain `@ : /` fall back to plain bold text.
- **Copy moment:** the `written` state runs a 1300ms animation, cells staggered 26ms apiece, each lifting 3px, turning blue (text and outline), washing in `blue-wash`, then settling to ink. Reduced motion shows the final blue state statically.
- **Password comb (lock screen):** a hidden input over a row of 24x32 cells; typed characters fill cells as blue-wash, the next cell is dashed and blinks (1.1s steps) while focused.

### Toast, banner, dialog
- Toast: `ink` fill, `paper` text, centred bottom 22px, with an Undo ghost button. Banner: `blue-wash` with `edge` outline. Gate card: `field` fill, 1px `edge`, 28px padding, max 420px.

## Do's and Don'ts

### Do:
- **Do** set any short number (IDs, bank numbers, OTP-like values) in comb boxes with tabular figures.
- **Do** use Ballpoint Blue for the one primary action per view, focus, and the "written" copy moment.
- **Do** use 1px `edge` outlines, 3px radius and hairline `rule` dividers for structure.
- **Do** provide every color a night counterpart through the same token name swap, and keep reduced-motion fallbacks.
- **Do** pair red and blue status with words or icons.

### Don't:
- **Don't** use grey neutrals; every neutral is green-tinted.
- **Don't** add shadows to cards, rows or panels; flat with outlines.
- **Don't** use blue for decoration or red for anything other than expiry, warnings and destructive actions.
- **Don't** use uppercase, tracked captions or other labels above headings.
- **Don't** introduce pill radii or larger-than-3px corners.
