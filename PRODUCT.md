# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user with an explicit default: Next.js (App Router) + TypeScript + Tailwind CSS v4 + Prisma ORM + PostgreSQL (Prisma's local dev server for local development, Neon free tier for production), deployed to Vercel. Chosen for low maintenance over scalability for a two-person personal-use app. Installable to a phone home screen via a web manifest.

## Users

Two people (a couple) who just bought a house, using the app together to track the jobs that need doing and the things that need buying, and to keep both inside a budget. Used mostly on phones: in a shop (can we afford this now?), in a half-finished room (what's left to do in here?), and on the sofa planning together.

## Product Purpose

A shared house to-do list and budget planner. Every job and every purchase lives in one place, filed by room, with a priority, an optional cost, who's on it and when it's due. Success: either of them can open it and immediately know what to do next, what the money can cover right now, and roughly when the rest becomes affordable.

## Positioning

Not a spreadsheet and not a generic to-do app. What neither gives them: a plan that spends one shared pot of money on the list in priority order and then on monthly savings, so "can we afford it, and when?" is answered for every item without any manual totalling — alongside a to-do list that works for free jobs as well as purchases.

## Operating Context

- The overhaul (2026-10-09) replaced a decorative "apothecary shelf" version that neither of them wanted to use. Their stated pain points: it didn't fit jobs/tasks (price was mandatory, statuses were purchase-only) and adding things was a chore.
- Used under mild financial pressure: deciding what waits when money is tight.
- Two-person household; one shared truth, no per-user data.
- Changes sync between phones by polling (every 15s while visible, and on refocus); there is no realtime push.

## Capabilities and Constraints

- An item is a **job** or a **thing to buy** (switchable). Fields: title (required); room (16 fixed rooms plus "Whole house", default); priority (Must / Would like / Someday); status (To do / Doing / Done, read as To buy / Ordered / Bought for purchases); optional cost as an estimate or a range, a "firm quote" flag, and the actual amount paid; who's on it (either of them, "Both", or free text like "Electrician"); due date; a checklist of steps; link; notes; an optional project tag; added by, completed by/when.
- Repeating jobs (weekly / monthly / 3-monthly / 6-monthly / yearly): finishing one schedules the next from the day it was done; undoing the finish removes it.
- Bulk add: pasting several lines, or a curated "new-home essentials" checklist (src/lib/essentials.ts).
- Due dates publish to a private iCalendar feed (token derived from AUTH_SECRET) — the substitute for notifications.
- **Claude connector:** the app is a remote MCP server (Streamable HTTP, stateless, at `/api/mcp/<token>`, token derived from AUTH_SECRET like the calendar's, shown in Settings). Added as a custom connector in claude.ai, it works from every Claude app on their subscription: Claude researches with its own tools and writes into the list (overview and plan, what-if previews of a priority, pin, cost or drop against the plan using the same `planImpact` as the item sheet, a shopping list of things to buy and job supplies by shop, find/read items, add and update items and steps, log and choose quotes, post updates, delete on request). Writes go through the same service code as the app's routes (src/lib/items-service.ts), so pot settlement and repeating jobs behave identically. Changes are attributed to "Claude", which shows in Since you last looked for both of them but is never added to the household.
- Quotes per item (from, amount, note); choosing one sets the item's estimate and marks it a firm quote. Because costed steps replace the estimate with their total, costing only some stages of a quoted or estimated job shows how far the steps fall short of (or exceed) the earlier figure, with a one-tap "Add the £X balance as a step" (`stepsGap` in src/lib/types.ts) so stage payments keep the job at its real cost. Updates: a per-item comment thread. Items can be pinned ahead of the automatic Up next order. Rows swipe (right = done, left = delete), both undoable.
- Home shows what the other person added, finished, posted as an update or logged as a quote since this device last opened the app, quoting their words.
- Quick add parses one line of plain English: "Fix bathroom tap £40 tomorrow !must @Sam #bathroom" → cost, date, priority, person and room. Dates understand "next friday", "in a fortnight", "in 3 months", "end of the week" and "on the 15th"; "asap" means Must. A full detail sheet covers everything else.
- Pasting a product link (into quick add, the sheet's links or a step) reads the page server-side for its name and price — JSON-LD, then product meta tags, then the page title; no AI, GBP only, never converted. Quick add files it as a purchase with the name, price, link and a guessed room, previewed before adding; adding never waits on a slow shop (it goes in named from the link and is filled in when the page arrives), and a shop that blocks servers just leaves the link. In the sheet and steps the found price and name are offered as one-tap suggestions, never applied unasked. The fetch refuses private and metadata addresses (rechecked at connect time and on every redirect), non-web ports, slow or huge pages.
- **The pot:** one household figure for money available now, plus a monthly saving. Completing an item with a cost takes it out of the pot automatically (reopening or correcting the price puts it back). A "Payday" button adds the monthly saving (as a server-side increment, so it never overwrites the other phone's changes) and shows both of you who last added it and when.
- **The plan:** open costed items, pinned ones first, then in priority order (in-progress first within a tier, then due date, then oldest), paid from the pot until it runs out, then month by month from savings. Ranges plan at the top figure. The item sheet places the item in the plan as currently edited (affordable now with what's left, or the month and how far short), and before saving says what a change of priority, cost or status moves: the item itself, and the other items it pushes back or brings forward (src/lib/plan.ts `planImpact`). When pinning would make it affordable now, a one-tap "Pin it" is offered with its knock-on effect.
- Views: Home (up next, money in one line, rooms, recently done), List (search across titles, notes, steps, updates and quotes, Jobs / To buy, filters, group by room/priority/when/who/project, shopping-trip mode, select several to finish, move, re-prioritise, reassign or delete together; the selection bar shows their combined cost and a bulk priority change reports what it brought forward or pushed back in the plan), Rooms (each room's paint swatch and progress, plus a room page), Money (pot, plan with the cut line, still-to-spend by room, spending, CSV export).
- Deletes and completions are undoable from a toast for a few seconds; nothing asks "are you sure?".
- User-created lists were retired in the overhaul; their names were migrated onto each item as a project tag.
- Currency is GBP throughout.
- **Ask Claude:** on any item, "Research this" (jobs), "Find options" (things to buy) or a free-form question. The app only queues it; a worker on one of their computers runs Claude Code headless on that person's own Claude subscription (web search and fetch only) and posts back a suggestion: a short summary, a typical UK cost range, steps, product options with prices, links, cautions and a DIY verdict. Nothing changes until someone taps a part to use it (estimate, steps, links into the item draft; a product as a quote), and each tap can be taken back. The app says plainly when no worker is listening and when it last checked in; rows show "Suggestion" when an answer is waiting, so the other person notices. This gives the partner without a Claude account the same help inside the app.
- **Add with Claude:** a sparkle button in quick add (shown once a worker has ever checked in) adds the line as typed and queues a job that fills the item in directly when answered, rather than as a suggestion: estimate range (or the spread of product prices), steps, links, and summary, DIY verdict, options and cautions appended to the notes. Only empty fields are filled; when the item already has a price, steps arrive without costs so the step-total rule can't replace it. Edits are attributed to Claude. If filling in fails, the answer stays a suggestion.
- Auth is a single shared PIN plus a name remembered per device (picked from the household's names), used for attribution only.
- Out of scope: photo uploads, multiple households, push notifications (the calendar feed covers reminders), native app.

## Brand Commitments

Name: "The House List". History: "architectural blueprint" (v1) → "The Apothecary Shelf" (decorative, rejected in use) → **"The Paint Chart"** (2026-10-09, chosen by the user from an Impeccable direction round as clean, warm and modern). Each room owns a named paint colour, and those paints are the app's only saturated colour besides the green used for actions. Priority is typographic, never colour alone. Charm lives in small moments (ticks that flood with the room's paint, the day-in-the-house count, friendly copy), never in decoration that slows scanning.

## Evidence on Hand

A handful of real items in the local database at the time of the overhaul. No photos or brand assets. Paint names and colours are invented (not trade names) and can be swapped for the paints actually on their walls.

## Product Principles

1. Capture in seconds — one line to add anything; details are optional and can come later.
2. The next thing to do is always obvious.
3. "Can we afford it, and when?" is answered by the app, never by mental arithmetic.
4. Jobs and purchases are equals; money is optional, not the price of entry.
5. Mobile first; desktop is a comfortable bonus, not the design target.
6. Two people, one shared truth.
7. Mistakes are cheap — undo instead of confirmation dialogs.

## Accessibility & Inclusion

No user-specific accessibility needs were flagged. Standard practice: priority never conveyed by colour alone, room colour always paired with the room's name, visible focus states, 4.5:1 text contrast in light and dark, labelled controls, 44px tick targets, reduced-motion respected.
