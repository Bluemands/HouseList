---
name: The House List
description: A shared jobs, buys and budget app for one house, organised as a paint chart where every room owns a named colour.
colors:
  limestone: "#f3f0ea"
  surface: "#fbfaf7"
  sunken: "#ebe7df"
  line: "#e2ddd3"
  line-strong: "#cbc4b6"
  ink: "#211f1b"
  ink-2: "#57524a"
  ink-3: "#6f695e"
  front-door-green: "#2c6a55"
  front-door-green-hover: "#245a48"
  front-door-green-ink: "#ffffff"
  front-door-green-soft: "#dceae3"
  front-door-green-text: "#24604c"
  danger: "#b03d27"
  danger-soft: "#f6e1da"
  night-ground: "#151412"
  night-surface: "#1d1c19"
  night-sunken: "#262420"
  night-line: "#2e2c28"
  night-line-strong: "#45413b"
  night-ink: "#efebe4"
  night-ink-2: "#b9b2a6"
  night-ink-3: "#9a9387"
  night-green: "#5fb497"
  night-green-hover: "#74c3a7"
  night-green-ink: "#0f2a21"
  night-green-soft: "#1e352d"
  night-green-text: "#7fcbb0"
  night-danger: "#f08a73"
  night-danger-soft: "#3b211b"
  paint-plaster: "#d9ccb9"
  paint-hall-stone: "#b8a184"
  paint-moss: "#879360"
  paint-sage: "#9db39a"
  paint-billiard: "#2f5e4e"
  paint-mousehole: "#958c7f"
  paint-skylight: "#a9c3d3"
  paint-lavender: "#b3a6cb"
  paint-apricot: "#e6b48a"
  paint-midnight: "#33405f"
  paint-seafoam: "#94c7bd"
  paint-tile-blue: "#5f8fb3"
  paint-fern: "#5c7d45"
  paint-lichen: "#bdb86c"
  paint-slate: "#5f6368"
  paint-rafter: "#a5683f"
typography:
  display:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1"
  sheet-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  item-lead:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.375
  supporting:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  hint:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  label:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.02em"
rounded:
  paint-cell: "2px"
  chip: "3px"
  pill: "4px"
  control: "10px"
  card: "14px"
  panel: "16px"
  room-header: "20px"
  sheet: "22px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.front-door-green}"
    textColor: "{colors.front-door-green-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.front-door-green-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.sunken}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
  tab-add:
    backgroundColor: "{colors.front-door-green}"
    textColor: "{colors.front-door-green-ink}"
    rounded: "{rounded.panel}"
    size: "48px"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
  filter-chip-selected:
    backgroundColor: "{colors.front-door-green-soft}"
    textColor: "{colors.front-door-green-text}"
  priority-must:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.limestone}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "1px 6px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  quick-add:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "6px 6px 6px 14px"
  paint-chip:
    rounded: "{rounded.chip}"
    size: "12px"
  swatch-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    width: "148px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.limestone}"
    rounded: "{rounded.card}"
    padding: "6px 6px 6px 16px"
  item-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    width: "460px"
---

# Design System: The House List

## Overview

**Creative North Star: "The Paint Chart"**

The house is a fan deck of paint chips. Every room owns a named paint with a card number (No. 01 Plaster through No. 16 Rafter), and the app is organised by the rooms you are actually standing in. Everything else is deliberately quiet: a warm limestone ground, near-black ink, one family of type, and a single deep Front Door Green for anything you can press, pick or finish. The paints are the only saturated colour on any screen, so a room is recognisable at a glance from a 12px chip beside a row.

Density is Things/Linear-grade: hairline rows sitting directly on the ground, a short meta line under each title, numbers in tabular figures aligned on the right. Progress is shown as paint, not as percentages: a room's swatch card carries a strip of cells that paint in one per finished job, and ticking an item floods its circle with that room's colour. Mistakes are undone, not prevented; there are no "are you sure?" dialogs, only an undo toast.

Light and dark are both first-class. Dark swaps limestone for a warm near-black (night ground) and lifts the green to a lighter mint; the room paints stay the same pigment in both, because a paint does not change colour when the lights go off.

**Key Characteristics:**
- Limestone ground, ink text, Front Door Green as the only interface accent.
- Sixteen named room paints are the only saturated colour, shown as square chips, swatch cards and a full-bleed painted room header.
- One family (Figtree), bold for headings and figures, tabular figures for every pound.
- Hairline rows on the ground, not cards; cards are reserved for swatches, the money strip and the quick-add box.
- Priority is typographic: an inked "Must" pill, a muted italic "Someday", nothing for the default.
- Undo toasts instead of confirmation dialogs.
- Bottom tab bar with a central add button on phones; left rail and a right side panel on desktop.

## Colors

A neutral, warm limestone system with one green voice and a deck of sixteen room paints that carry all the colour.

### Primary
- **Front Door Green** (front-door-green; night-green in dark): every action, selection and focus ring. Primary buttons, the tab-bar add button, the quick-add plus and focus border, selected filter chips (on front-door-green-soft with front-door-green-text), the must-haves coverage bar on the money strip, "Doing" status text and in-text links ("All 15", "All rooms").
- **Front Door Green Soft** (front-door-green-soft): the tint behind selected chips, the hover fill of an empty tick circle, the flash a freshly added row arrives on, and text selection.

### Tertiary: the room paints
Sixteen paints, one per room, each with a computed ink (dark ink #211f1b or white, whichever contrasts better; every pairing clears 4.5:1). Plaster (Whole house), Hall Stone (Hallway), Moss (Sitting room), Sage (Kitchen), Billiard (Games room), Mousehole (Understair cupboard), Skylight (Landing), Lavender (Spare room 1), Apricot (Spare room 2), Midnight (Master bedroom), Seafoam (Bathroom 1), Tile Blue (Bathroom 2), Fern (Back garden), Lichen (Front garden), Slate (Driveway), Rafter (Attic). They appear only as: the square paint chip beside a room name, the top panel of a swatch card, the painted cells of a progress strip, a ticked circle, and the full-bleed header of a room page.

### Neutral
- **Limestone** (limestone / night-ground): the page ground and the theme colour of the browser chrome. Rows sit directly on it.
- **Surface** (surface / night-surface): raised containers only: swatch cards, the money strip, quick-add, inputs, the item sheet, the tab bar (at 92% with blur).
- **Sunken** (sunken / night-sunken): hover fill on rows and ghost controls, the active rail item, the segmented control track, parsed chips in quick-add.
- **Line** (line, line-strong): hairline row dividers and card borders; line-strong for empty tick circles, dashed empty states and input hover.
- **Ink** (ink, ink-2, ink-3): titles and figures; meta lines and secondary labels; hints, placeholders, done items and "Someday".
- **Danger** (danger, danger-soft): overdue dates, "short for must-haves", late counts on swatch cards, destructive ghost buttons and error toasts. Never used for priority.

### Named Rules
**The Paint Is The Only Colour Rule.** Saturated colour on any screen comes from a room paint or from Front Door Green. Nothing else gets a hue: not priority, not kind, not person.

**The Green Means Press Rule.** Front Door Green marks what you can act on or what is selected. A paint never marks an action, and green never marks a room.

**The Same Paint Day And Night Rule.** Room paints are fixed pigments; only the neutrals and the green change between light and dark.

## Typography

**Display Font:** Figtree (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Figtree
**Label/Mono Font:** none; figures use Figtree's tabular numerals.

**Character:** One rounded grotesk throughout, friendly without being soft. Hierarchy comes from weight and size steps, with tight negative tracking on the big sizes. Stylistic set 01 is on globally.

### Hierarchy
- **Display** (700, 32px, line-height 1, -0.03em): the room name in a painted room header.
- **Headline** (700, 28px, -0.025em): the view title on Home ("Evening, Connor"), Everything, Rooms, Money, and the login welcome (26px).
- **Figure** (700, 34px, tabular): the headline money figure on the Money view; 28px and 22px steps of the same style for secondary totals.
- **Sheet title** (700, 22px, -0.015em): the editable item title at the top of the detail sheet.
- **Item lead** (600, 18px, -0.01em): the first "Up next" row only.
- **Title** (700, 17px, -0.01em): section heads ("Up next", "Rooms") and the pot figure in the money strip. Sticky group heads in the list step down to 700 at 14px.
- **Body** (500, 15px, line-height 1.375): row titles and input text. Supporting sentences run 14px regular in ink-2.
- **Meta** (400, 13px; 12-12.5px for hints): the line under a row title: room tag, due date, assignee, steps, affordability month.
- **Label** (600-700, 11px): paint number and name on a swatch, the "Must" pill, tab-bar labels.

### Named Rules
**The Tabular Pound Rule.** Every money figure, count and date-like number is set in tabular figures, so prices align down the right edge of a list.

**The One Family Rule.** Figtree is the only typeface. Emphasis is weight (500, 600, 700) and size, never a second family.

**The Typographic Priority Rule.** Priority is shown by type, never colour: "Must" is an inked pill (ink ground, limestone text, 11px bold); "Someday" is 12px italic in ink-3; the default ("Would like") shows nothing.

## Layout

Phone-first, single column. Content sits in a centred column capped at 800px with 16px side gutters on phones and 24px from 640px up; bottom padding clears the tab bar and the safe-area inset. Views stack sections on a 28px gap (Home) or 20px gap (Rooms, room pages, lists). Rows pad 12px vertically, 16px for the lead row.

At 1024px the shell becomes a two-column grid: a 240px sticky left rail (wordmark, a full-width green "Add something" button with an N shortcut hint, the four nav items, settings at the foot) and the content column. The room swatch rail on Home scrolls horizontally on phones (148px cards, hidden scrollbar, momentum kept) and becomes a four-column grid on desktop showing the first eight rooms. The Rooms view is a 2/3/4-column grid of swatch cards for the rooms with something in them, followed by a "Not started" grid of compact paint tiles (a 36px square of the room's paint carrying its card number, beside the room name) on the same columns, so busy rooms are never buried under empty ones. A brand-new house shows all sixteen as swatch cards.

In the Everything list the filter bar and group heads are sticky on the limestone ground so you always know which group you are in. The painted room header bleeds to the screen edges on phones and becomes a rounded block from 640px.

## Elevation & Depth

Flat by default, tonal by structure. Rows have no surface at all; raised containers are separated by a 1px line border and the slightly lighter surface tone, not by shadow. Shadows appear only on things that float above the page or respond to touch.

### Shadow Vocabulary
- **Sheet** (`0 -12px 40px rgb(33 31 27 / 0.16)`; dark `0 -12px 40px rgb(0 0 0 / 0.5)`): the item sheet and settings sheet, over a 42% warm-black backdrop.
- **Pop** (`0 10px 30px rgb(33 31 27 / 0.14), 0 2px 6px rgb(33 31 27 / 0.08)`; darker in dark mode): toasts, the tab-bar add button, and a swatch card on hover (with a 2px lift).
- **Paint edge** (`inset 0 0 0 1px rgb(0 0 0 / 0.08)`): the inner edge on a paint chip so pale paints hold against limestone.

### Named Rules
**The Float-Only Shadow Rule.** A shadow means the element is floating (sheet, toast, add button) or being hovered. Resting cards and rows never carry one.

## Shapes

Softly rounded, with radius growing with the size of the thing. Paint cells are 2px, paint chips 3px (deliberately square, like a chip cut from a card), the "Must" pill 4px, buttons, inputs and segmented controls 10px, swatch cards and toasts 14px, the quick-add box and money strip 16px, the painted room header 20px, sheets 22px on their leading edge. Tick targets and filter chips are full circles and pills. Empty states use a dashed line-strong border instead of an illustration.

## Components

### Buttons
- **Shape:** gently rounded (10px).
- **Primary:** Front Door Green with white text (dark ink on mint in dark mode), 600 weight, 10px by 16px padding; hover deepens to the hover green; press scales to 0.97.
- **Secondary:** surface fill with a hairline border, ink text; hover fills sunken.
- **Ghost:** no fill, ink-2 text; hover fills sunken and darkens to ink. **Danger** is a ghost in danger red with a danger-soft hover.
- **Focus:** a 2px green outline offset 2px, everywhere.

### Chips
- **Filter chips:** full pills, hairline border on surface, ink-2 text at 13px 500; selected switches to a green border, green-soft fill and green text.
- **Parsed chips (quick-add):** sunken pills at 12.5px that appear under the input as you type, showing the parsed room (with its paint chip), priority, cost, date and person.

### Cards / Containers
- **Corner Style:** 14px (swatch cards) and 16px (money strip, quick-add).
- **Background:** surface, with a 1px line border.
- **Shadow Strategy:** none at rest; swatch cards lift 2px with the pop shadow on hover.
- **Internal Padding:** 10px on swatch cards, 14px by 16px on the money strip.

### Inputs / Fields
- **Style:** surface fill, 1px line border, 10px radius, 15px text, 10px by 12px padding; money inputs carry a £ prefix in ink-3 and tabular figures.
- **Focus:** border turns green with a soft green ring (20% of the accent).
- **Labels:** 13px semibold ink-2 above the field; hints 12px ink-3 below.

### Navigation
- **Phone:** a fixed bottom tab bar on translucent surface with blur and a top hairline: Home, List, a central 48px green add button (16px radius, pop shadow, scales to 0.9 on press), Rooms, Money. Labels 11px semibold; active is ink with a heavier icon stroke, inactive ink-3.
- **Desktop:** the 240px left rail; active item is a sunken fill with ink text.

### Item Row (signature)
A hairline row directly on the ground: a round tick target on the left (26px, 32px on the lead row, inside a 44px hit area), the title, a right-aligned tabular cost (with a small "QUOTE" qualifier for quotes, and ranges as "£450–600"), and a 13px meta line: priority, room tag (paint chip plus name), due date (danger when overdue), person, steps done, and "Affordable Jun 2027" right-aligned when the pot does not yet cover it. Done rows go ink-3 with a soft strikethrough. Hover fills sunken at 60%.

Ticking a row in an open list does not remove it on the spot: for one second the list holds the house as it was just before the tick, so the row keeps its place while its circle floods and its title strikes through, then the row folds away (its grid row collapses to nothing) and the list re-sorts against the new pot. Nothing reshuffles under the finger. On phones a row swipes right to finish and left to delete; the action icon underneath pops (scale 1.1) and the phone gives a light tap at the moment letting go would count.

### Tick (signature)
An empty circle with a line-strong edge; on hover it tints green-soft and previews a faint green tick. Finishing floods the circle with the room's paint (scale 0.6 to 1.12 to 1, 320ms) and draws the tick in the paint's ink (260ms, 80ms delay).

### Paint Chip and Swatch Card (signature)
The paint chip is a 12px square (10px inline in tags) at 3px radius with the paint edge. The swatch card is a surface card whose top panel is solid paint (68px compact, 88px full) carrying the paint number and name in the paint's ink; below it the room name, a "3 to do · £1.2k" line, and the paint strip: one 6px cell per job, painted cells in the room's colour and open cells in line, painting in from the bottom 40ms apart on first view. Over twelve jobs the strip becomes a proportional bar. A room with nothing in it shows a dashed strip.

### Painted Room Header
A room's page opens on a full-bleed block of its paint, with the room name in display type, To do / Done / Still to spend / Spent stats in tabular figures, the tall strip on an 85% surface inset, and the paint number and name at the foot.

### Item Sheet
A native dialog that rises as a bottom sheet on phones (92dvh max, 22px top corners, drag handle, 340ms rise) and slides in as a 460px right side panel on desktop (22px left corners, 260ms). Closing, tapping the backdrop or pulling the sheet down by its top bar saves; there is no cancel-and-lose path. Every bottom sheet (item, settings, bulk add) follows the finger when pulled down by its handle: a pull past 110px or a quick flick dismisses it, anything less springs back.

### Toasts
Ink pills (limestone text) that rise 8px into view above the tab bar, carrying the message and an "Undo" action in green-soft bold. Errors use a danger fill. They replace every confirmation dialog. While a sheet is open the toasts render inside it (a modal sheet makes everything outside it inert), so an undo or an error raised from a sheet is always visible and tappable.

### Motion
One easing (`cubic-bezier(0.16, 1, 0.3, 1)`) for tick flood and draw, row arrive (420ms, from 6px above with a green-soft flash), row leave (320ms fold after a 620ms pause), sheet up and panel in, toast in (240ms) and out (160ms, 6px down), and paint-in. Under reduced motion every animation and transition collapses to 1ms and loops run once, so state still changes without movement.

**Chappie (signature).** Whenever a question is out with Claude, a small visor-faced robot with antenna ears (after the film's Chappie) stands beside the words, drawn in currentColor: 16px in a row's meta line, 22px in the sheet's Ask Claude panel. Waiting for a worker to pick it up, in ink-3, he looks about, blinks and twitches an ear on a 3.6s loop. Once Claude is working, in green text, his ears bob and the visor scans (0.55s). When the answer lands while the row is on screen, the "Suggestion" tag pops in on a green-soft wash (900ms), once.

**Change feedback.** A row whose item changes while it's showing (saved from the sheet, or arriving from the other phone) washes green-soft and fades over 1.4s. The pot figure on Home and Money counts to its new value over 600ms (whole pounds stay whole). Quick add's parsed chips pop in (200ms, from 0.88 scale) as each is understood, and an Ask Claude panel rises 4px into view when it changes state.

## Do's and Don'ts

### Do:
- **Do** give every room-bearing element its paint chip, and keep the chip square (3px radius).
- **Do** use Front Door Green for every action, selection, focus ring and the must-haves coverage bar, and for nothing decorative.
- **Do** set every pound, count and date in tabular figures.
- **Do** lay lists out as hairline rows on the limestone ground, with the cost right-aligned.
- **Do** show progress as paint: a strip that fills one cell per finished job, a tick that floods with the room's colour.
- **Do** offer undo in a toast after ticking, deleting or changing the pot, instead of asking first.
- **Do** design both themes; check the dark ground (night-ground) against every new token.
- **Do** honour reduced motion by collapsing animation rather than removing state changes.

### Don't:
- **Don't** colour priority, item kind or people; priority is the inked "Must" pill, italic "Someday", or nothing.
- **Don't** introduce a hue outside the room paints and Front Door Green (danger red is reserved for overdue, short and destructive).
- **Don't** wrap rows in cards or give resting containers a shadow.
- **Don't** add a confirmation dialog where an undo toast will do.
- **Don't** bring in a second typeface or a monospace for numbers.
- **Don't** use a room paint as a button fill or a link colour, and don't use the green to mark a room.
