# Account Intel

A per-user, account-scoped customer-intelligence platform. Each team member logs in and
sees **only the accounts assigned to them** (their POD) plus a **live news/signals feed**
for those accounts, populated by automated research agents (Google News RSS → dedupe →
AI/heuristic enrichment → persist).

Admins can also configure account-specific watch signals, filter each account's feed to a
signal, create follow-ups from a story, and track RFB/bid opportunities through completion.

Standalone SvelteKit 2 + Svelte 5 (runes) app. Backed by Supabase Postgres via Drizzle ORM.
Bespoke UI (no Tailwind). The app is served under `/watch` (root `/` redirects there).

## Stack

- **SvelteKit 2 / Svelte 5**, TypeScript, bespoke CSS design system (`src/lib/watch/watch.css`)
- **Drizzle ORM** + `postgres.js` → **Supabase** (via the IPv4 pooler)
- **Auth**: DB-session cookies (`bcryptjs`), per-user isolation enforced on every query
- **Agents**: `src/lib/server/watch/agents/*` — Google News RSS source, enrichment via
  OpenRouter (heuristic fallback when no key)

## Setup

```sh
npm install
cp .env.example .env        # then fill DATABASE_URL, CRON_SECRET, OPENROUTER_API_KEY
npm run db:check            # verify the Supabase connection
npm run db:migrate          # apply the schema (idempotent)
```

Load the account list and users, then pull news:

```sh
npm run watch:build-seed    # build data/seed.json from the POD list (scripts/build-seed.ts)
npm run watch:seed          # upsert accounts + users; temp passwords → data/credentials.csv
npm run watch:ingest        # fetch + classify news for every account
```

## Run

```sh
npm run dev                 # http://localhost:5173  → redirects to /watch
```

Sign in with an email from `data/credentials.csv`. `admin@cosol.in` is the admin
(sees all accounts + an **"View as"** control to preview any member's scoped view).

## Layout

```
src/lib/server/watch/   auth · db (schema/client) · data (scoped queries) · agents (ingestion)
src/lib/watch/          client-safe types, segments, format, watch.css, UI components
src/routes/watch/       login, (app) group [dashboard, feed, accounts, admin, account], api
scripts/                build-seed · seed · ingest · db-check · verify · find-pooler
drizzle/                SQL migrations
```

See [CUSTOMER_WATCH_PLAN.md](CUSTOMER_WATCH_PLAN.md) for the full architecture and design notes.

## Deploy (Vercel)

Set the env vars in Vercel, use the Supabase **transaction** pooler URL (port 6543,
`prepare:false` is already set), and wire `POST /watch/api/cron/ingest` to Vercel Cron
(auth via `Authorization: Bearer $CRON_SECRET`).
