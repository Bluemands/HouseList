---
version: 1
slug: "src-components-houselistapp-tsx"
primary_target: "src/components/HouseListApp.tsx"
related_targets: ["src/app/page.tsx"]
---

# Surface: The House List app shell (all signed-in screens)

Mode: Operate. Two people, mostly on phones — standing in a shop, in a half-done room, on the sofa planning. Job: capture a task or a purchase in seconds, see what to do next, and know what the pot can afford now and when the rest becomes affordable.

User answers (2026-10-09): clean, warm, modern (Things/Linear-quality, warmer; light + dark); pain was "doesn't fit tasks/jobs" and "adding things is a chore"; items carry who's doing it, due date, checklist steps, cost as a range/quote; budget = one pot + monthly top-up; lists replaced by smart views (old list names survive as a project tag).

## Direction contract

THESIS: The house is a fan deck of paint chips — every room owns a named paint colour, and the app is organised by the rooms you're actually standing in. It refuses the grey checkbox inbox where everything is one undifferentiated list.

OWN-WORLD: Warm limestone ground, ink near-black, Front Door Green for every action and selection. Sixteen named room paints (Plaster, Hall Stone, Sage, Billiard, Midnight…) are the only saturated colour in the app and appear as square paint chips beside room names and as swatch cards with a strip that fills in as jobs finish. Priority is typographic, never colour: an inked "Must" pill, an outlined "Should", muted "Someday". One rounded grotesk (Figtree) throughout, heavy for numerals, tabular for every £. Hairline rows, not cards.

STORY: Open the app and you see the one thing to do next, the money picture in one line, and the rooms filling in. Type "fix bathroom tap £40 tomorrow" and it's filed, parsed into chips, in under three seconds. Tick it and it's done — undo is right there.

FIRST VIEWPORT: Phone. Top: greeting + day-in-the-house count. Quick-add field with live parsed chips. One-line budget strip: pot, must-haves, spare/short, "rest affordable by <month>". "Up next" — item 1 large, then 4 compact rows with room chips. Then the horizontal fan of room swatch cards. Bottom tab bar: Home · List · Rooms · Money, add button in the bar. Desktop: same content, left rail nav, detail opens as a side panel.

FORM: Impeccable's pick — "The Paint Chart" (my rank 1 of 7 grounded candidates; the roll assigned rank 6, the Assembly Sheet; user chose the pick card). Seed key 3e477b1b. Kept from the hand: single next decision on small screens (wayfinding), hairline density (high-density web), sticky group headers naming where you are (lexicon), shopping-trip mode (event catalogue), nothing labelled twice (catalogue sleeve).

Signature move: room paint chips — swatch cards whose strip fills as a room's jobs are done; the same chip marks every row's room.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Real paint colours for their actual rooms, if they want to swap the authored ones.
