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
- Quotes per item (from, amount, note); choosing one sets the item's estimate and marks it a firm quote. Updates: a per-item comment thread. Items can be pinned ahead of the automatic Up next order. Rows swipe (right = done, left = delete), both undoable.
- Home shows what the other person added, finished, posted as an update or logged as a quote since this device last opened the app, quoting their words.
- Quick add parses one line of plain English: "Fix bathroom tap £40 tomorrow !must @Sam #bathroom" → cost, date, priority, person and room. Dates understand "next friday", "in a fortnight", "in 3 months", "end of the week" and "on the 15th"; "asap" means Must. A full detail sheet covers everything else.
- **The pot:** one household figure for money available now, plus a monthly saving. Completing an item with a cost takes it out of the pot automatically (reopening or correcting the price puts it back). A "Payday" button adds the monthly saving (as a server-side increment, so it never overwrites the other phone's changes) and shows both of you who last added it and when.
- **The plan:** open costed items, pinned ones first, then in priority order (in-progress first within a tier, then due date, then oldest), paid from the pot until it runs out, then month by month from savings. Ranges plan at the top figure.
- Views: Home (up next, money in one line, rooms, recently done), List (search across titles, notes, steps, updates and quotes, Jobs / To buy, filters, group by room/priority/when/who/project, shopping-trip mode), Rooms (each room's paint swatch and progress, plus a room page), Money (pot, plan with the cut line, still-to-spend by room, spending, CSV export).
- Deletes and completions are undoable from a toast for a few seconds; nothing asks "are you sure?".
- User-created lists were retired in the overhaul; their names were migrated onto each item as a project tag.
- Currency is GBP throughout.
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
