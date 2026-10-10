# The House List

A shared to-do list and budget planner for a new house, for two people. Log every job and every thing to buy, room by room, and the app tells you what to do next, what the money covers right now, and roughly when the rest becomes affordable.

## Features

- **One-line quick add** — type `Fix bathroom tap £40 tomorrow !must @Sam` and it's filed: cost, due date, priority, who and room are pulled out of the sentence. `#kitchen` names a room explicitly; `£100-150` is a range.
- **Paste a list** — paste several lines (from Notes, a chat, a spreadsheet) and each becomes its own item, reviewed before adding.
- **New-home essentials** — a one-tap starter checklist of the jobs most UK households do in the first months (locks, stopcock, meter readings, boiler service…).
- **Repeating jobs** — weekly to yearly. Ticking one off schedules the next, counted from the day it was done (`Boiler service every year` works in quick add).
- **Jobs and purchases** — cost is optional, so "call the electrician" works as well as "buy a sofa". Statuses read To do / Doing / Done (or To buy / Ordered / Bought).
- **Everything editable** in one sheet: room, priority, who's on it (either of you, both, or a tradesperson), due date, cost range, firm-quote flag, actual price paid, a checklist of steps, link, notes, project tag.
- **Home** — the one thing to do next, then four more; the money in one line; rooms filling in; what the other person finished recently.
- **Rooms** — every room has its own paint colour; its swatch strip paints in as jobs get done.
- **Money** — the pot (money you have now) and a monthly saving. The plan spends the pot on the list in priority order, marks where it runs out, and dates the rest month by month. Ticking off something with a cost takes it out of the pot automatically. Spending so far, accuracy vs. estimates, and a CSV export of everything.
- **Shopping trip** — under *To buy*, show only what the pot covers right now and tick things off in the shop.
- **Compare quotes** — log quotes from tradespeople against a job; the cheapest is flagged, and choosing one sets the job's cost.
- **Updates** — a short thread on any item ("rang them, waiting for a callback"), with who said it and when.
- **Pin to the top** — anything you've decided is next leads Up next and its list group.
- **Swipe on your phone** — right to finish, left to delete.
- **Undo instead of "are you sure?"** for ticks, swipes and deletes.
- **Offline banner** — no signal in the shop? It says so instead of failing quietly.
- **Since you last looked** — opening the app shows what the other person added and finished.
- **Due dates in your phone calendar** — subscribe once (Settings) and everything with a date shows up with a 9am reminder. The link is private and unguessable; rotating `AUTH_SECRET` revokes it.
- Light and dark mode, installable to your phone's home screen, keyboard shortcut `N` to add on desktop.
- A single shared PIN plus "who's this?" per device.

## Tech stack

- **Next.js 16 (App Router) + TypeScript** — UI and API routes in one project
- **Tailwind CSS v4** — for the design system
- **Prisma ORM + PostgreSQL** — [Prisma's local dev Postgres](https://www.prisma.io/docs/orm/tools/prisma-dev) for local development (zero setup, no account needed), [Neon](https://neon.tech) (free tier) recommended for production
- **Deployment target:** Vercel

## Local setup

You'll need [Node.js](https://nodejs.org) 20 or later installed.

### 1. Environment variables

Copy the example file — the defaults already work for local development, no editing required to get started:

```bash
cp .env.example .env
```

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. The example file's default points at a local database that gets created automatically — see below. |
| `HOUSE_PIN` | Yes | The shared PIN the two of you type in to unlock the app. The example ships with `changeme`; pick your own before sharing the app with anyone. |
| `AUTH_SECRET` | Yes | A long random string used to sign the login cookie. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output in — the shipped placeholder is fine for local dev only. |
| `DATABASE_POOL_MAX` | No (local dev only) | Leave at `1` locally — see the note below. Omit this variable entirely in production. |

### Tests

`npm test` runs the unit tests for the quick-add parser and the budget planner.

### 2. Install and run

```bash
npm install
npm run dev
```

That's genuinely it. Behind the scenes, `npm run dev` first starts (or reuses) **Prisma's own local Postgres server** — a real Postgres-compatible database that runs on your machine with no signup, no Docker, and no separate install — then applies the database schema, then starts the app. Your data persists across restarts.

Open [http://localhost:3000](http://localhost:3000).

> **Why `DATABASE_POOL_MAX=1` locally?** Prisma's local dev Postgres server has a known issue returning "prepared statement" errors under more than one concurrent database connection. Capping the pool at 1 works around it. This is a local-only quirk — production Postgres (Neon) doesn't need it, so that variable should be **left unset** on Vercel.

If you ever want to inspect the local database directly, `npx prisma studio` opens a browser-based data viewer.

## Deploying (Vercel + Neon)

This assumes you've never deployed anything before. It takes about 15 minutes.

### Step 1: Put the code on GitHub

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Create a new, empty repository (click the **+** in the top right → **New repository**). Don't add a README or .gitignore — this project already has them.
3. In your terminal, from this project's folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```

### Step 2: Create a free Postgres database on Neon

1. Go to [neon.tech](https://neon.tech) and sign up (free tier is plenty for this app).
2. Create a new project (any name; pick a region near you, e.g. London).
3. Click **Connect** on the project dashboard. Copy the connection string twice — once with **Connection pooling** on (its host contains `-pooler`), once with it off. You will need both in Step 4.

### Step 3: Import the project into Vercel

1. Go to [vercel.com](https://vercel.com) and sign up using your GitHub account — this lets Vercel see your repositories directly.
2. Click **Add New… → Project**, and select the GitHub repository you pushed in Step 1.
3. Vercel will auto-detect it as a Next.js project. Don't click Deploy yet — first add the environment variables below.

### Step 4: Add environment variables in Vercel

Still on the import screen (or afterwards under **Project Settings → Environment Variables**), add:

| Name | Value |
|---|---|
| `DATABASE_URL` | The **pooled** Neon connection string from Step 2 |
| `DATABASE_URL_UNPOOLED` | The **direct** (non-pooled) Neon connection string — used only to apply database migrations |
| `HOUSE_PIN` | Whatever PIN you and your partner want to use |
| `AUTH_SECRET` | A long random string — generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Do **not** add `DATABASE_POOL_MAX` — leave it unset in production.

### Step 5: Deploy

Click **Deploy**. Vercel runs the `vercel-build` script, which applies any pending database migrations (creating the tables on the first deploy) and then builds the app. Schema changes in later pushes are applied the same way, so there is nothing to run by hand.

### You're live

Vercel gives you a URL like `your-project.vercel.app`. Share that link and the PIN with your partner — that's the whole rollout. Every time you push to the `main` branch on GitHub, Vercel redeploys automatically.

## Project structure

```
src/
  app/
    page.tsx          # server component: fetches initial data
    login/page.tsx     # PIN entry
    api/                # state, items, settings, export (CSV), auth routes
  components/           # HouseListApp (shell), views/ (Home, List, Rooms, Money), ItemRow, QuickAdd, ItemSheet, …
  lib/                   # store (shared state + sync), plan (budget maths), parse (quick add), rooms (paints), …
  proxy.ts               # PIN-gate middleware (Next.js 16's middleware convention)
prisma/
  schema.prisma          # Item, Step, Settings models
```

## Non-functional notes

- Validation runs on the server for every write (zod), so the API is safe even if a request bypasses the UI.
- Changes appear instantly and save in the background. If a save fails, the change is rolled back and a message says so.
- Deletes wait out a few-second undo window before they reach the server.
- No realtime push: the app polls every 15 seconds while it's open and refreshes when you switch back to it, so your partner's changes show up within moments.
- Out of scope: photo uploads, multiple households, reminders/notifications, a native app.
