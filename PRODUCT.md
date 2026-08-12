# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user with an explicit default: Next.js (App Router) + TypeScript + Tailwind CSS v4 + Prisma ORM + PostgreSQL (Prisma's local dev server for local development, Neon free tier for production), deployed to Vercel. Chosen for low maintenance over scalability for a two-person personal-use app.

## Users

Two people (a couple) who just moved into a new house, using the app together to plan renovations and purchases. Used mostly on phones, in two situations: while out shopping (deciding whether to buy something now) and at the house (assessing what needs doing). Not used daily — used in bursts around purchase decisions.

## Product Purpose

A shared home-renovation wishlist and budget tracker. Replaces a spreadsheet for logging things they want to buy, fix, or change, so they can see the running cost and decide what they can actually afford right now. Primary success condition: confidently knowing what the "must have" items would cost against the budget available right now (budget discipline first, shared record-keeping second — confirmed by the user).

## Positioning

Not a spreadsheet and not a generic todo/shopping list. The mechanism a spreadsheet doesn't give them: a live, always-visible budget bar comparing "must have, not yet bought" costs against a settable "budget available now" figure, so the tradeoff is legible at a glance rather than requiring manual totalling.

## Operating Context

- Used under mild financial stress: deciding what to cut when money is tight, often standing in a shop or in the unfinished house.
- Two-person household only; both partners use the same shared list, no separation of data between them.
- Real transaction flow: item is wishlisted with an estimated price, optionally moves to "planned," then to "bought" with the actual price paid (so estimate vs. reality can be compared over time).

## Capabilities and Constraints

- Fields per item: title (required), room (fixed set: Kitchen, Bathroom, Living Room, Bedroom, Garden, Exterior, Whole House, Other), estimated price (GBP), actual price (optional, set on purchase), priority (Must have / Would like / Someday), link (optional URL), notes (optional), addedBy (free-text name), status (Wishlist / Planned / Bought), timestamps.
- Currency is GBP throughout; no multi-currency requirement.
- Auth is a single shared PIN (not per-user accounts) plus a locally-remembered display name per browser, used only to attribute who added an item.
- Explicitly out of scope for v1: photo uploads, multi-household/multi-list support, email notifications/reminders, native mobile app.
- No real content/branding assets exist yet (brand-new house, brand-new app).

## Brand Commitments

Name: "The House List". Visual identity was specified up front by the user as a starting point (see DESIGN.md) rather than left open — an "architectural blueprint" aesthetic (dark navy, faint grid lines) with red/amber/blue priority coding and paper-toned cards, explicitly chosen to feel technical/calm rather than decorative, since it will be used while making real financial tradeoffs.

## Evidence on Hand

None. No real items, prices, photos, or copy exist yet — this is a brand-new list for a brand-new house. All example content used during design/build is illustrative placeholder, not real data.

## Product Principles

1. Clarity beats decoration — this is used mid-decision about real money, not browsed for pleasure.
2. The budget tradeoff is always visible, never a number the user has to go calculate themselves.
3. Every item is fully editable after creation — nothing is add/delete-only.
4. Mobile is the primary surface, not an adapted afterthought.
5. Two people, one shared truth — no per-user silos in the data.

## Accessibility & Inclusion

No user-specific accessibility needs were flagged. Standard practice applies: priority is never conveyed by color alone (paired with text/shape), visible focus states, sufficient contrast, and labeled form fields — called out explicitly by the user as a requirement.
