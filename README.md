# The House List

A shared to-do list and budget planner for a new house, for two people. Log every job and every thing to buy, room by room, and the app tells you what to do next, what the money covers right now, and roughly when the rest becomes affordable.

## Features

- **One-line quick add** — type `Fix bathroom tap £40 tomorrow !must @Sam` and it's filed: cost, due date, priority, who and room are pulled out of the sentence. `#kitchen` names a room explicitly; `£100-150` is a range.
- **Paste a product link** — paste a shop link into quick add (on its own, or with `!must #kitchen` and the rest) and it's filed as something to buy, with the product's name, price and the link filled in from the page, and a room guessed from the name ("shower" → bathroom). No AI: it reads the page's own product data. Works with Screwfix, B&Q, IKEA, Wickes, Toolstation, and Amazon with [Amazon prices](#amazon-prices) on; shops that turn servers away (Argos) still get added straight away, named from the link. Adding a link in the detail sheet, or as a step, offers "Use £X from Screwfix" with one tap.
- **Paste a list** — paste several lines (from Notes, a chat, a spreadsheet) and each becomes its own item, reviewed before adding.
- **New-home essentials** — a one-tap starter checklist of the jobs most UK households do in the first months (locks, stopcock, meter readings, boiler service…).
- **Repeating jobs** — weekly to yearly. Ticking one off schedules the next, counted from the day it was done (`Boiler service every year` works in quick add).
- **Jobs and purchases** — cost is optional, so "call the electrician" works as well as "buy a sofa". Statuses read To do / Doing / Done (or To buy / Ordered / Bought).
- **Everything editable** in one sheet: room, priority, who's on it (either of you, both, or a tradesperson), due date, cost range, firm-quote flag, actual price paid, links (as many as you like), notes, project tag.
- **Steps** — break a job into stages. Each step can have its own cost, link and details; when steps have costs, the item's estimate is their total. Type a price into a step ("Deposit £200") or paste a list to add several at once. Drag the grip (or use the arrow keys) to reorder. Each row shows its next step with a tick of its own, so you can work through a job without opening it. Costing only part of a quoted job ("Deposit £500" on a £2,000 quote) says the steps now come to less than the quote and offers "Add the £1,500 balance as a step", so the job keeps its real cost and paying the rest is a tick.
- **Home** — the one thing to do next, then four more; the money in one line; rooms filling in; what the other person finished recently.
- **Rooms** — every room has its own paint colour; its swatch strip paints in as jobs get done.
- **Money** — the pot (money you have now) and a monthly saving. The plan spends the pot on the list in priority order, marks where it runs out, and dates the rest month by month. Once you've set the pot, ticking off something with a cost takes it out automatically (and undo puts it back). For a range like £100–150 it takes the £100, and the toast asks what it actually cost: type it in to correct the pot, or ignore it. Jobs paid in stages work too: ticking a costed step pays that stage, and finishing the job pays only what's left. Spending so far, accuracy vs. estimates, and a CSV export of everything.
- **What a change does to the plan** — open anything with a cost and the sheet says when it's affordable ("Affordable now, £400 left in the pot after it", or "Affordable from March 2027, £340 short today"). Change its priority or cost and that line updates before you save, naming what it pushes back or brings forward ("This change moves it forward from Sept 2027, and pushes back “Sofa” (to Dec 2026)"). When pinning it would make it affordable now, that's one tap, with what it would push back alongside.
- **Shopping trip** — under *To buy*, show only what the pot covers right now and tick things off in the shop. Supplies inside jobs ("Buy socket faceplates" under "Fit new sockets", or any step with a product link and a price) are listed too, under *For jobs*.
- **Select several** in the list to finish, move, re-prioritise, hand over or delete them in one go — with one undo. The bar shows what the selection costs between them, and re-prioritising says what it did to the plan ("Set 2 things to Someday: brings forward “Hallway runner” (to now) and 2 more"), so putting things off when money's tight shows what it frees up.
- **Guarantees** — note when a guarantee or warranty runs out; it's listed under Money and the calendar feed reminds you a month before.
- **Ask Claude** — on any item, one tap for "Research this" (or "Find options" for things to buy), or ask your own question. Claude comes back with a short summary, a typical UK cost range, suggested steps, product options with prices, useful links and things to watch out for (Part P, Gas Safe…). Each part is one tap to use — "Use this estimate", "Add these steps", "Add link", "Log as quote" — and a second tap takes it back. It runs on your own Claude subscription through a small worker on your computer (see [Ask Claude: the worker](#ask-claude-the-worker)), so your partner gets it without a Claude account. A row shows **Suggestion** when an answer is waiting.
- **Add with Claude** — type a rough line in quick add ("replace bathroom extractor fan #bathroom") and tap the sparkle instead of the arrow. It's added straight away as typed, and when the worker answers, Claude fills in what's empty: the cost range, steps, links, and its summary and cautions in the notes. Nothing you typed is overwritten (if you gave a price, Claude's steps come without costs so your figure stands). The row says *Waiting for Claude* until then. The sparkle only appears once a worker has checked in. The full new-item sheet has the same thing as **Add with Claude** beside *Add*: fill in as much as you know (room, who, when, a note like "DIY, budget about £200") and Claude works from it and fills in the rest.
- **Compare quotes** — log quotes from tradespeople against a job; the cheapest is flagged, and choosing one sets the job's cost.
- **Updates** — a short thread on any item ("rang them, waiting for a callback"), with who said it and when.
- **Duplicate** anything — the same job in another room, or again next year.
- **Pin to the top** — anything you've decided is next leads Up next and its list group.
- **Swipe on your phone** — right to finish, left to delete.
- **Undo instead of "are you sure?"** for ticks, swipes and deletes.
- **Offline banner** — no signal in the shop? It says so instead of failing quietly.
- **Since you last looked** — opening the app shows what the other person added and finished.
- **Due dates in your phone calendar** — subscribe once (Settings) and everything with a date shows up with a 9am reminder. The link is private and unguessable; rotating `AUTH_SECRET` revokes it.
- **Use it from Claude** — add the app to Claude as a connector and ask in plain English: "research what rewiring a 3-bed costs and put a range on the rewire job", "log this quote against the boiler job", "break 'tile bathroom 1' into steps", "what can we afford this month?", "what if we made the bathroom a must?", "what do we need from Screwfix?". Claude does the research and writes the results into the list, signed "Claude" (see [Use it from Claude](#use-it-from-claude)).
- Light and dark mode, installable to your phone's home screen, keyboard shortcut `N` to add on desktop.
- A single shared PIN plus "who's this?" per device. Wrong PINs are rate-limited (10 per 15 minutes per device, 60 an hour overall), but use something longer than a single word.

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
| `RAINFOREST_API_KEY` | No | Turns on [Amazon prices](#amazon-prices): a key from [rainforestapi.com](https://www.rainforestapi.com). Without it, Amazon links work as before. |
| `HOUSE_LIST_URL` | Worker only | Where the [Ask Claude worker](#ask-claude-the-worker) finds the app. Defaults to `http://localhost:3000`. |
| `HOUSE_LIST_WORKER_TOKEN` | Worker only | The worker's key, from Settings → Ask Claude. Locally it can be left out (it's derived from `AUTH_SECRET`). |
| `HOUSE_LIST_CLAUDE_MODEL` | No | Model alias the worker asks `claude` for. Defaults to `sonnet`. |
| `HOUSE_LIST_CLAUDE_BIN` | No | Path to the `claude` executable, if the worker can't find it on your PATH. |
| `HOUSE_LIST_WORKER_MAX_IDLE` | No | Longest wait between checks when nothing's happening, in seconds. Defaults to `60`. |

### Tests

`npm test` runs the unit tests for the quick-add parser, the product-link reader (against saved shop-page shapes, no network), the budget planner, the pot rules, the Claude connector and the Ask Claude worker (prompt, `claude` arguments, answer checking).

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
| `RAINFOREST_API_KEY` | Optional: turns on [Amazon prices](#amazon-prices). |

Do **not** add `DATABASE_POOL_MAX` — leave it unset in production. The worker's own variables don't go on Vercel either: they live on the computer that runs the worker. (`RAINFOREST_API_KEY` is the exception that belongs here: the worker borrows the app's Amazon lookups rather than holding the key.)

### Step 5: Deploy

Click **Deploy**. Vercel runs the `vercel-build` script, which applies any pending database migrations (creating the tables on the first deploy) and then builds the app. Schema changes in later pushes are applied the same way, so there is nothing to run by hand.

### You're live

Vercel gives you a URL like `your-project.vercel.app`. Share that link and the PIN with your partner — that's the whole rollout. Every time you push to the `main` branch on GitHub, Vercel redeploys automatically.

## Use it from Claude

The app is also a remote [MCP](https://modelcontextprotocol.io) server, so Claude can read and edit the list on your Claude plan (no API key).

1. Deploy first: claude.ai needs to reach the app over the internet, so `localhost` won't work.
2. In the app, open **Settings** and copy the link under **Use it from Claude**.
3. In [claude.ai](https://claude.ai), go to **Settings → Connectors → Add custom connector**, give it a name ("The House List") and paste the link. Leave the OAuth fields empty.
4. That's it: it's available in the Claude apps on your phone and desktop too, and in Claude Code (`claude mcp add --transport http house-list <link>`).

Claude can see the overview and budget plan, preview what a change would do to the plan without making it (a new priority, a pin, dropping something, a big new cost: what it moves forward and what it pushes back), pull together the shopping list (things to buy plus the supplies inside jobs, by shop, or just what the pot covers), find and read items, add and update them (steps, costs, links, notes, due dates, status), log and choose quotes, post updates and delete items when asked. Its changes go through the same rules as the app (finishing something costed spends from the pot, repeating jobs reschedule) and show up on both phones, attributed to "Claude" and in *Since you last looked*. Claude isn't added to your household.

The link carries its own key, like the calendar link, so keep it private. Rotating `AUTH_SECRET` changes it (and the calendar link); you'd then re-add the connector with the new link.

## Ask Claude: the worker

The app never calls Claude itself. Pressing **Ask Claude** queues the question; a small worker script, running on a computer that's signed in to Claude Code, picks it up, runs `claude -p` (Claude Code's headless mode) with **your own Claude Pro/Max subscription**, and sends the answer back. No API key, nothing to pay beyond the subscription. While no worker is running, the app says so honestly ("Waiting for Claude… It runs when the worker's computer is on"), and Settings shows when the worker last checked in.

**Set it up once, on your computer:**

1. Install [Claude Code](https://code.claude.com) and sign in with your Claude account (run `claude` and follow the login). `claude auth status` should say `"loggedIn": true`.
2. In this project's `.env` on that computer, add:
   ```bash
   HOUSE_LIST_URL="https://your-project.vercel.app"
   HOUSE_LIST_WORKER_TOKEN="paste from Settings → Ask Claude → Copy token"
   ```
3. Run it:
   ```bash
   npm run ai-worker
   ```
   It checks for questions every 20 seconds or so (easing off to once a minute when it's quiet), answers them one at a time, and stops with Ctrl+C. An answer usually takes under a minute and uses a little of your subscription's usage.

Against your local copy (`npm run dev`), step 2's variables aren't needed: the worker defaults to `http://localhost:3000` and derives the token from `AUTH_SECRET` in `.env`.

**Start it with Windows.** Task Scheduler → *Create Task…* → Triggers: *At log on*; Actions: *Start a program*, Program `node`, Arguments `scripts/ai-worker.mjs`, Start in: this project's folder. Leave *Run only when user is logged on* ticked (Claude Code needs your login). On a Mac, a login item or `launchd` agent running the same command does the same job.

**Or don't keep a computer on.** A scheduled [Claude Code cloud routine](https://code.claude.com/docs/en/scheduled-tasks) on this repository, with `HOUSE_LIST_URL` and `HOUSE_LIST_WORKER_TOKEN` set, can run `node scripts/ai-worker.mjs --once` every so often: `--once` answers whatever is waiting and exits. Answers then arrive on the routine's schedule rather than within a minute.

**What Claude can do from the worker:** web search and web fetch, plus the app's two Amazon price tools when [Amazon prices](#amazon-prices) are on, nothing else. It runs in an empty temporary folder with no shell, no file editing and none of your MCP servers, hooks, plugins, skills or CLAUDE.md files (`--tools WebSearch,WebFetch`, `--permission-mode dontAsk`, `--strict-mcp-config`, and `--safe-mode`; with the price tools, whose server `--safe-mode` would drop, `--setting-sources project --disable-slash-commands` and `CLAUDE_CODE_DISABLE_CLAUDE_MDS` instead). The price tools come from the app's `/api/worker/mcp`, signed in with the worker token, and can only read Amazon prices: nothing there can change the list. The household's text is passed in as data, not instructions, the prompt goes in on stdin rather than the command line, and each job is stopped after five minutes. Answers are checked against a schema when they arrive, and links that aren't plain web addresses are refused.

> **Neon note:** every check is a tiny database query, so while the worker runs, a Neon free-tier database doesn't get to sleep. That's fine for a computer that's on during the day; for round-the-clock use, raise `HOUSE_LIST_WORKER_MAX_IDLE` or use the scheduled `--once` option.

Rotating `AUTH_SECRET` revokes the worker token along with the calendar link; copy the new one from Settings.

## Amazon prices

Amazon turns servers away, so neither a pasted link nor Claude's web fetch can read its prices. With `RAINFOREST_API_KEY` set (on Vercel, and in `.env` locally), [Rainforest API](https://www.rainforestapi.com) reads them instead:

- **Pasting an Amazon link** (including `amzn.eu/d/…` share links) fills in the real name and current price, and tidies the link to `amazon.co.uk/dp/…`.
- **Ask Claude** gets two tools: one prices an Amazon link or ASIN, the other searches Amazon UK. It's told to price any Amazon link already on the item and compare it with other shops.
- **The Claude connector** gets the same two tools.

Every lookup spends one Rainforest credit. Answers are kept for six hours, and Claude is asked to keep to a few lookups per question. If a lookup fails (no credits left, say), a pasted link falls back to reading the page as before.

## Project structure

```
src/
  app/
    page.tsx          # server component: fetches initial data
    login/page.tsx     # PIN entry
    api/                # state, items, settings, export (CSV), unfurl (product links), auth, calendar feed, mcp (Claude connector), ai-jobs, worker routes
  components/           # HouseListApp (shell), views/ (Home, List, Rooms, Money), ItemRow, QuickAdd, ItemSheet, …
  lib/                   # store (shared state + sync), items-service (write rules), plan (budget maths), parse (quick add), mcp + mcp-tools (connector), rooms (paints), …
  proxy.ts               # PIN-gate middleware (Next.js 16's middleware convention)
prisma/
  schema.prisma          # Item, Step, Quote, Comment, AiJob, Settings models
scripts/
  ai-worker.mjs          # the Ask Claude worker (runs claude -p on your computer)
```

## Non-functional notes

- Validation runs on the server for every write (zod), so the API is safe even if a request bypasses the UI.
- Changes appear instantly and save in the background. If a save fails, the change is rolled back and a message says so.
- Deletes wait out a few-second undo window before they reach the server.
- No realtime push: the app polls every 15 seconds while it's open and refreshes when you switch back to it, so your partner's changes show up within moments.
- Out of scope: photo uploads, multiple households, reminders/notifications, a native app.
