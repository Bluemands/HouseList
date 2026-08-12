---
name: The House List
description: A shared home-renovation wishlist and budget tracker, styled as an architectural blueprint.
colors:
  blueprint-bg: "#0a1626"
  blueprint-bg-raised: "#0f2038"
  blueprint-bg-inset: "#071120"
  blueprint-ink: "#dfe9f7"
  blueprint-ink-muted: "#8ea0c2"
  blueprint-ink-faint: "#7c8caa"
  paper: "#f4efe2"
  paper-raised: "#faf7ee"
  paper-ink: "#1d2333"
  paper-ink-muted: "#5c6274"
  paper-line: "#ddd4bd"
  must: "#c2402c"
  must-ink: "#4a140b"
  must-soft: "#f6ded7"
  must-bright: "#f0897a"
  like: "#d69f3a"
  like-ink: "#402d05"
  like-soft: "#f4e3c2"
  someday: "#3a739e"
  someday-ink: "#ffffff"
  someday-soft: "#d9e7f2"
  someday-dark: "#1f4e6e"
  good: "#4c9868"
  good-solid: "#2e6b47"
  good-ink: "#ffffff"
  good-dark: "#1f5c3a"
  on-solid: "#ffffff"
typography:
  display:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.2em"
rounded:
  sm: "4px"
  md: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.someday}"
    textColor: "{colors.someday-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.someday}"
  button-secondary:
    backgroundColor: "{colors.blueprint-bg}"
    textColor: "{colors.blueprint-ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-destructive:
    backgroundColor: "{colors.must}"
    textColor: "{colors.on-solid}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: The House List

## Overview

**Creative North Star: "The Drafting Table"**

The House List renders as a working architectural drawing: a deep-navy canvas ruled with a faint measurement grid, with each real thing on the list — a hob, a fan, a shed — pinned to it as a paper spec sheet. The system exists to make a financial tradeoff legible in seconds, not to decorate a todo list. Every device serves that: the budget bar reads as a dimension line rather than a progress ring, prices set in tabular monospace so figures compare cleanly down a column, and priority is a paper title-block tab rather than a colored dot.

This is an **Operate**-mode surface (a tool used mid-decision, not browsed for pleasure), so the system deliberately refuses ornament: no kickers, no icon-plus-heading feature cards, no gradient text. Color is functional throughout — red/amber/blue never appear as decoration, only as the priority or status they name, and always paired with a text label so the system never depends on color alone.

**Key Characteristics:**
- Dark drafting-table canvas (ruled grid) as permanent chrome; content lives on paper-toned cards pinned to it.
- Monospace for every price, date, tag, and room name — data reads as data, distinct from prose.
- A dimension-line budget bar, not a progress bar or a KPI tile.
- Every priority color is paired with a text label; never color alone.
- Calm, flat, and quiet — the system's only job is legibility under a real spending decision.

## Colors

Color plays a strictly functional role: navy is the app's permanent chrome, paper is where content lives, and red/amber/blue are reserved entirely for priority and status — never used decoratively.

### Primary
- **Someday Blue** (`#3a739e`): the one interactive accent — primary buttons, the add-item action, active filter chips, focus rings. Doubles as the "Someday" priority color; this dual role is deliberate, keeping the palette from growing a separate "brand blue."

### Secondary
- **Must Red** (`#c2402c`): the "Must have" priority color and the destructive/danger color (delete, overspend). Darkened from a lighter red specifically so white text on a solid fill clears 4.5:1 contrast — see the Named Rule below.
- **Would-Like Amber** (`#d69f3a`): the "Would like" priority color. Light enough that it always pairs with dark ink text, never white — the one priority color that inverts the usual light-on-solid pattern.
- **Bought Green** (`#4c9868` text / `#2e6b47` solid fills): marks completed purchases and positive budget states. Not a priority color — reserved for "this is done" / "this is fine," so it never competes visually with the three priority hues.

### Neutral
- **Blueprint Navy** (`#0a1626`, raised `#0f2038`, inset `#071120`): the permanent dark canvas — page background, sticky header, the budget-bar panel.
- **Blueprint Ink** (`#dfe9f7` primary text, `#8ea0c2` muted, `#7c8caa` faint labels): text on the navy canvas, three steps of emphasis.
- **Paper** (`#f4efe2`, raised `#faf7ee`): the card and modal surface pinned onto the canvas.
- **Paper Ink** (`#1d2333` primary, `#5c6274` muted): text on paper.

### Named Rules
**The Never-Color-Alone Rule.** Every priority is a text badge ("MUST HAVE" / "WOULD LIKE" / "SOMEDAY"), never a bare color swatch or dot. Confirmed by the user as an explicit accessibility requirement.

**The Surface-Tuned Ink Rule.** A priority's saturated swatch is never used as body text directly. Each color carries separate variants for its three real contexts — dark `*-ink` for text on its own pale `*-soft` tint, `*-bright`/`*-dark` for that color used as text directly on the blueprint or paper surface, and (for must/someday) a deliberately darkened solid swatch so white button text clears 4.5:1. A swatch light enough for one context (like's `#d69f3a` solid) is too light for white text, so it pairs with dark ink instead — the rule is "tune per context," not "one color, one text pairing."

## Typography

**UI Font:** Geist Sans (with ui-sans-serif, system-ui fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace fallback)

**Character:** A modern geometric sans for prose and controls, paired with its matching mono for anything measured — prices, dates, room names, priority tags. The pairing itself carries the "technical drawing" register without needing a display face.

### Hierarchy
- **Display** (600, 1.875rem / 30px, 1.2): page-level heading, login screen only.
- **Title** (600, 1.125rem, 1.35): card titles, dialog headings, section headings.
- **Body** (400, 0.875rem, 1.5): notes, descriptions, form helper text.
- **Label** (500, 0.6875rem / 11px, tracking 0.2em, uppercase, mono): every field label, section header ("PRIORITY", "BUDGET AVAILABLE NOW"), and metadata line.
- **Figures** (mono, tabular-nums): every price and percentage — the `font-tabular` utility forces tabular figure widths so columns of prices align.

### Named Rules
**The Mono-Is-Data Rule.** Monospace marks measurement, not "technical mood": prices, dates, room/status/priority tags. Prose (titles, notes, descriptions) stays in the sans face. Applying mono to a heading or paragraph is a violation of this rule.

## Layout

Mobile-first, single-column by default; content widens into a responsive card grid (`sm:grid-cols-2`, `xl:grid-cols-3`) and a max-width-5xl centered shell at desktop widths. The header is sticky (`position: sticky; top: 0`) with a translucent blurred navy background so scrolled content remains legible beneath it. On mobile, the primary "add item" action moves from a header button to a fixed bottom-right floating action button for one-thumb reach; both never render simultaneously (`sm:hidden` / `hidden sm:inline-flex`). Spacing follows Tailwind's default scale; card interiors use 16–20px padding, sections stack with 12–20px gaps.

## Elevation & Depth

Flat by default — the blueprint canvas has no shadows. Depth is reserved for content pinned "on top of" the canvas: paper cards and modals carry a soft, warm-toned shadow (`rgba(5, 12, 24, 0.45)`) that reads as the paper lifting slightly off the navy surface, never a hard offset or neobrutalist block shadow.

### Shadow Vocabulary
- **Card rest** (`0 6px 20px rgba(5,12,24,0.45)`): item cards against the canvas.
- **Modal** (`0 20px 48px rgba(5,12,24,0.45)`, or `0 -8px 40px` for the mobile bottom sheet): dialogs and the add/edit form.
- **Floating action button** (`0 10px 24px rgba(0,0,0,0.4)`): the mobile add-item button, slightly heavier since it floats free of any card.

### Named Rules
**The Paper-Lifts Rule.** Only surfaces literally described as "paper pinned to the canvas" (cards, dialogs, the FAB) ever carry a shadow. The canvas itself, the header, and the budget-bar panel are flat — they're the wall, not the paper.

## Shapes

Corners stay small and drafted-looking rather than soft/app-like: 4px (`rounded`) on buttons, inputs, and chips; 6px (`rounded-md`) on cards, dialogs, and section panels; full pill radius reserved for status chips and the FAB. Priority is marked with a 7px solid-color tab running the full height of a card's left edge — deliberately thicker than a typical 1–2px accent border so it reads as a physical tab/bookmark rather than a decorative line, per the user's explicit brief.

## Components

### Buttons
- **Shape:** 4px radius (`rounded`), never fully rounded except icon-only circular buttons (FAB).
- **Primary:** solid `someday` fill, white text, used for the one primary action per screen (Add item, Save budget).
- **Secondary:** solid navy (`blueprint-bg`) fill with light ink text — used for the card-level "Mark [status]" action and non-destructive dialog confirms.
- **Destructive:** solid `must` fill, white text (`text-on-solid`) — delete confirmation only.
- **Ghost/ text link:** no fill, muted ink, used for Cancel actions and the "Clear filters" control.
- **Hover / Focus:** solid fills darken slightly (`/90` opacity) on hover; every interactive element gets a 2px `someday`-colored focus-visible outline, offset 2px — the one focus treatment used everywhere, deliberately not varied per component.

### Chips (filter chips)
- **Style:** pill-shaped (full radius), 1px border, transparent background at rest.
- **State:** unselected — muted ink text, border only. Selected — solid `someday` fill, white text, border becomes `someday`.

### Cards / Containers
- **Corner Style:** 6px radius.
- **Background:** `paper` (`#f4efe2`), `paper-raised` (`#faf7ee`) for input fields and the card footer strip.
- **Shadow Strategy:** see Elevation & Depth — card-rest shadow.
- **Border:** 1px `paper-line` (`#ddd4bd`).
- **Internal Padding:** 16–20px, with a 7px reserved gutter on the left edge for the priority tab.
- **Bought state:** the whole card drops to 75% opacity (`opacity-75`) rather than changing shape — a quiet, reversible-feeling way to mark "done" without the item disappearing from view.

### Inputs / Fields
- **Style:** 1px `paper-line` border, `paper-raised` background, 4px radius, generous padding (12px vertical).
- **Focus:** 2px `someday` ring with 2px offset against the paper surface (`focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper`).
- **Error:** inline text below the field in `must-ink` (dark red — tuned for the paper surface, not the brighter `must-bright` used on navy), paired with `aria-invalid` and `aria-describedby`.

### Navigation
- Sticky header only — no persistent nav chrome beyond the page title, signed-in name, and the primary action. Filters live in a collapsible in-page panel, not a separate navigation surface.

### The Budget Bar (signature component)
A dimension-line reinterpretation of a progress bar: a thin ruled track with tick marks at 25/50/75%, end-cap ticks taller than the track (echoing an architectural dimension line), a percentage label that walks along the fill, and the remaining-or-overspend figure right-aligned in its own color. The percentage label is suppressed once overspent — the bar is already full and the £-over figure carries the information, so showing both created a real layout collision at high percentages. Fill color steps through good → like → must as the must-have total approaches and passes the budget.

## Do's and Don'ts

### Do:
- **Do** pair every priority color with its text label — badge, filter chip, or status text. Never a bare swatch.
- **Do** use monospace exclusively for measured data (prices, dates, tags) — never for prose.
- **Do** use the 7px solid priority tab on any new card-like surface that carries a priority; keep it a full-height tab, not a thin accent border.
- **Do** reach for the `*-ink` / `*-bright` / `*-dark` surface-tuned variant whenever a priority or status color is used as text; never the bare saturated swatch.
- **Do** keep the canvas flat and reserve shadow for surfaces literally "pinned on top of" it.

### Don't:
- **Don't** add a kicker/eyebrow label above a heading anywhere in the system — removed twice already ("Drawing No. HL-001", "One-time setup") as a category default the brief never asked for; the heading carries its own weight.
- **Don't** use a hard-edged, zero-blur "neobrutalist" shadow anywhere — this system's depth language is a soft lifted-paper shadow only.
- **Don't** introduce a second accent color. `someday` blue is the only non-semantic accent; a new feature should reuse it rather than adding a brand color.
- **Don't** render a priority/status color as body text without checking which surface it's on — the same red is a different hex depending on whether it sits on navy, on paper, or on its own soft tint.

<!-- Documenter note: this DESIGN.md was produced by the build agent running the
degraded in-thread documenter role, not the dedicated impeccable-documenter
subagent — this harness session has no subagent capability under that name.
Disclosed per the skill's substitution-disclosure requirement. -->
