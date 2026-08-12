# The House List

A shared home-renovation wishlist and budget tracker for two people. Log things you want to buy, fix, or change in the house, see the running cost, and see at a glance what your "must have" items would do to the budget you've got right now.

Not a spreadsheet: items are scannable, colour-coded cards, and a live budget bar at the top always shows how much of your available money the must-have items would use.

## Features

- Add / edit / delete items (title, room, estimated price, actual price, priority, link, notes, who added it, status)
- Move items Wishlist → Planned → Bought, prompting for the actual price paid when marked Bought
- Live budget bar: set a "budget available now" figure and see it compared against outstanding must-have costs, with remainder or overspend shown clearly
- Filter by priority / room / status (multi-select) and sort by priority, price, or recency
- Running totals per priority tier, a grand total, and actual spend on bought items shown separately
- A single shared PIN gate (no accounts) plus a one-time "what's your name" prompt remembered per device
- Mobile-first, dark "architectural blueprint" design with accessible colour contrast throughout

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
2. Create a new project (any name and region are fine).
3. On the project dashboard, find the **connection string** (it looks like `postgresql://user:password@host/dbname?sslmode=require`). Copy it — you'll need it in Step 4.

### Step 3: Import the project into Vercel

1. Go to [vercel.com](https://vercel.com) and sign up using your GitHub account — this lets Vercel see your repositories directly.
2. Click **Add New… → Project**, and select the GitHub repository you pushed in Step 1.
3. Vercel will auto-detect it as a Next.js project. Don't click Deploy yet — first add the environment variables below.

### Step 4: Add environment variables in Vercel

Still on the import screen (or afterwards under **Project Settings → Environment Variables**), add:

| Name | Value |
|---|---|
| `DATABASE_URL` | The Neon connection string from Step 2 |
| `HOUSE_PIN` | Whatever PIN you and your partner want to use |
| `AUTH_SECRET` | A long random string — generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Do **not** add `DATABASE_POOL_MAX` — leave it unset in production.

### Step 5: Deploy

Click **Deploy**. Vercel installs dependencies and builds the project (this also runs `prisma generate` automatically via the `postinstall` script already configured in `package.json`).

### Step 6: Create the database tables

The first deploy creates the app but not the database tables yet. From your local machine, with `DATABASE_URL` temporarily pointed at your **Neon** connection string, run:

```bash
DATABASE_URL="your-neon-connection-string-here" npx prisma migrate deploy
```

(On Windows PowerShell: `$env:DATABASE_URL="your-neon-connection-string-here"; npx prisma migrate deploy`.) This applies the same schema you've been using locally to your live database. You only need to do this once, and again any time the schema changes in the future.

### You're live

Vercel gives you a URL like `your-project.vercel.app`. Share that link and the PIN with your partner — that's the whole rollout. Every time you push to the `main` branch on GitHub, Vercel redeploys automatically.

## Project structure

```
src/
  app/
    page.tsx          # server component: fetches initial data
    login/page.tsx     # PIN entry
    api/                # items, settings, auth routes
  components/           # BudgetBar, ItemCard, ItemForm, FilterBar, dialogs, HouseListApp (the client app shell)
  lib/                   # prisma client, validation, auth, formatting, types
  proxy.ts               # PIN-gate middleware (Next.js 16's middleware convention)
prisma/
  schema.prisma          # Item + Settings models
```

## Non-functional notes

- Form validation runs both client-side (inline, immediate) and server-side (the API routes re-validate everything, so the app is safe even if a request bypasses the UI).
- Deleting an item requires an explicit confirmation step; there's no undo, by design (kept simple for two trusted users).
- The list has no realtime sync between devices, but it quietly refreshes in the background whenever the tab regains focus, so switching back to it after your partner's made changes picks them up without a manual reload.
- Out of scope for v1 (see the original brief): photo uploads, multiple households/lists, email notifications, and a native mobile app.
