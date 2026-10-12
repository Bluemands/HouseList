---
target: House List app at phone width
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\kerri\\Coding\\Projects\\House-List\\src\\components\\HouseListApp.tsx"
target_fingerprint: "sha256:f679aea5538fb632974e15424796447edf2d26b425eb4682bff647620bc05bfe"
target_path: "C:\\Users\\kerri\\Coding\\Projects\\House-List\\src\\components\\HouseListApp.tsx"
timestamp: 2026-10-12T11-19-28Z
slug: src-components-houselistapp-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector + browser sub-agent)

Target: The House List app shell (src/components/HouseListApp.tsx), phone width 390px, local DB mirroring the real list (10 items, pot not set). Includes uncommitted gesture-motion work.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Row animates "Waiting for Claude" however long the worker has been away; Money shows £0 when the pot is simply unset |
| 2 | Match System / Real World | 3 | Floor-plan short names ("Bath 1", "Spare 2") differ from list names |
| 3 | User Control and Freedom | 3 | Undo everywhere; closing always saves (by design) |
| 4 | Consistency and Standards | 3 | Green on non-pressables ("Doing", Claude working); undocumented amber --warn; three Claude verbs split across sheet |
| 5 | Error Prevention | 3 | 31px next-step checkbox sits under the 44px tick on every row |
| 6 | Recognition Rather Than Recall | 3 | Quick-add syntax hint only on focus |
| 7 | Flexibility and Efficiency | 3 | Strong accelerators; Cost ~600px down the sheet |
| 8 | Aesthetic and Minimalist Design | 2 | "Must" pill on 8/10 rows; 13-section sheet shown for every item |
| 9 | Error Recovery | 3 | Undo toasts, honest Claude/offline/link errors |
| 10 | Help and Documentation | 3 | Good inline money explanations; worker setup points to README |
| **Total** | | **29/40** | **Good** |

## Design Specificity Verdict
Authored for this product: room paints, the traced floor plan, tabular pounds and plain money copy could not transplant. Rows alone are Things-generic; identity rests on paint chips and Rooms. Chappie is the one element from a different world (a film mascot in a paint fan deck).
Deterministic: CLI detector exit 0, 10 advisory design-system-font-size findings (7 true: undocumented 16px in 6 places, 20px sheet titles vs documented 22px; 3 false). Browser overlay failed (live server truncates detect.js); static-snapshot fallback produced 87 findings, all verified false positives (no layout in static scan, closed dialog content). No anti-pattern true positives.

## Priority Issues
1. [P1] Someday items inflate every money total (Home pot card, List header, Money by room): £22,858 of £27,388 is the Someday garage. Fix: split totals ("£4,530 on the list · £22,858 someday"), mute Someday in by-room bars. /impeccable clarify
2. [P1] Chappie's waiting loop signals activity while the worker may be offline for hours, as perpetual motion in list rows. Fix: static glyph while queued, animate only RUNNING, show worker staleness in row meta. /impeccable quieter
3. [P1] Empty tick ring (line-strong) is 1.52:1 on limestone, 1.82:1 dark: fails WCAG 1.4.11 non-text 3:1 for the app's primary control. /impeccable polish
4. [P2] Item sheet is a 13-section wall; Cost is below the fold on a phone; 17-chip room scroller clipped. Fix: Cost + plan placement under Priority; Repeats/Quotes/Links/Project/Updates only when set, behind "More". /impeccable distill
5. [P2] Unset pot renders as "£0" with a pencil-only affordance (MoneyView.tsx ~206-220). Fix: "Not set yet" + primary "Set the pot". /impeccable onboard
6. [P2] Touch targets under 44px: next-step checkbox 31px under the tick; quick-add sparkle (queues Claude) 36px beside the submit arrow; 28px remove/delete icons, delete-update icon at 60% opacity. /impeccable adapt
7. [P3] "Must" pill on 80% of items no longer separates anything. /impeccable typeset

## Charm verdict
Chappie: tone down (static while queued, animate only when running). Row wash: keep (only save confirmation + other-phone signal). Pot count-up: keep. Chip pop-in: keep. Panel rise-in: keep as is.

## Persona Red Flags
Casey: next-step checkbox mis-taps under the tick; sparkle beside submit; horizontal room scroller in sheet.
Alex: ~600px scroll to Cost; three Claude entry points; two close controls.
Partner without Claude, in a shop: no affordability answer with pot unset, only a £27k total that's 83% Someday; animated "Waiting for Claude" for hours with no hint the worker is Connor's computer.

## Minor Observations
Redundant next steps ("Sort Gym Room → Next: Sort room"); quick-add focus popover covers the pot card; --warn tokens and new motion (sheet exit, swipe fly-off) not in DESIGN.md; 16px/20px sizes off the documented scale; row wash double-fires after an in-row step tick.

## Questions to Consider
- If nearly everything is a Must, is priority doing any work, or should pinning carry the order?
- Should Someday count in "costs on the list" when the promise is "what can we afford now"?
- Could Claude's status live in the paint world instead of a film robot?
