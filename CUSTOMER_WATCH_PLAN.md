# COSOL Customer Watch — Plan & Implementation

> A per-user, account-scoped intelligence platform. Each COSOL person logs in and
> sees **only their accounts** and a **live news/signals feed** for those accounts,
> populated by automated research + search agents that fetch, scrape, enrich, and
> classify real-world data.

Reference UI: the attached "COSOL Customers Watch" dashboard (segments sidebar,
KPI cards, Key Customer Signals table, Priority Alerts, Sector Sentiment, Client
Stock Watch). We rebuild this **cleaner and more systematic**, not pixel-for-pixel.

---

## ✅ Status (built & verified)

The platform is implemented and live end-to-end against Supabase with the **real
COSOL portfolio**: 131 accounts across 5 PODs (Ashwini, Shruthi, Ojas, Sowmya, Sowmya1).

- **DB**: Drizzle schema (8 tables) migrated to Supabase (Tokyo pooler, IPv4).
- **Auth**: session cookies + `hooks.server.ts`, login/logout, forced password change;
  login is constant-time (dummy-hash compare), temp passwords use the CSPRNG.
- **Isolation**: verified — a member sees only their POD's accounts & news; admin sees all.
- **Admin "view as"**: an admin can impersonate any user and see their exact scoped
  dashboard/feed/accounts, with an exit banner. Enforced server-side (admins only).
- **Agents**: Google News RSS (India locale) → dedupe → enrich (heuristics; OpenRouter
  when keyed) → persist, run across all 131 accounts.
- **Segments**: India taxonomy — Financial Services, Government & Public, Technology,
  Manufacturing, Pharma & Healthcare, Consulting & Services, Telecom & Media.
- **UI**: dashboard, feed, account pages, admin, login — bespoke `.watch` design system.
- **Quality**: `svelte-check` 0 errors · Prettier · production build passes · an
  adversarial multi-agent review ran and its findings were fixed.

**Sign in** (temp passwords in `data/credentials.csv`, git-ignored):
`vishal@cosol.in` (admin — sees all + can "view as" anyone) and one member per POD
(`ashwini@cosol.in`, `shruthi@cosol.in`, `ojas@cosol.in`, `sowmya@cosol.in`,
`sowmya1@cosol.in`).

### Run it

```sh
npm run dev                 # then open /watch
npm run watch:ingest        # pull fresh news for all accounts (needs network)
npm run build:seed          # rebuild data/seed.json from the POD list  (npx tsx scripts/build-seed.ts)
SEED_PRUNE=1 npm run watch:seed   # (re)seed + prune accounts/users no longer in the list
npm run db:check            # verify DB connectivity
```

### Still optional

- **`OPENROUTER_API_KEY`** in `.env` upgrades classification from heuristics to an LLM.
- **Rotate the Supabase password** — it was shared in chat.

---

## 1. Goals

1. **Auth + isolation** — each person in the POD account list gets login credentials
   and sees only the accounts assigned to them/their POD, and only news for those.
2. **Live data** — automated agents continuously pull news, signals, and (for listed
   companies) market data for every tracked account, into a per-account **news feed**.
3. **Enrichment** — each raw item is summarized and classified (signal type, impact,
   sentiment, trend) so the dashboard can render the Key Signals table and alerts.
4. **Admin** — manage users, accounts, POD → account assignments, and trigger/monitor
   ingestion runs.
5. **Quality UI** — a systematic, well-designed dashboard + feed, in this SvelteKit app.

---

## 2. Where it lives

A **standalone SvelteKit app** in this repo (`cosol-news`). It is its own product — no
marketing site, no Ringg AI, no Three.js/Tailwind. The app is served under `/watch`:

```
/                     → redirects to /watch
/watch                → login
/watch/dashboard      → main dashboard (reference screen)
/watch/feed           → unified news feed across the user's accounts
/watch/accounts       → the user's accounts (grid/list)
/watch/accounts/[slug]→ single account: profile + full news feed + signals
/watch/admin/*        → admin only: users, accounts, assignments, ingestion runs, view-as
/watch/api/*          → internal endpoints (ingest triggers, feed data)
```

Server-only code lives under `src/lib/server/watch/**` (SvelteKit guards it from the
client bundle); client-safe types/components under `src/lib/watch/**`.

---

## 3. Tech stack additions

| Concern          | Choice                                                             | Why                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB               | Supabase Postgres (provided)                                       | Given                                                                                                                                                                 |
| ORM              | **Drizzle ORM** + `drizzle-kit`                                    | Required                                                                                                                                                              |
| PG driver        | `postgres` (postgres.js)                                           | Best Drizzle + Supabase fit; works with pooler                                                                                                                        |
| Auth             | Custom email/password + DB sessions (Oslo-style)                   | We were given a raw Postgres URL, not Supabase Auth keys; keeps everything in Drizzle and gives us full control of per-user scoping. No Supabase Auth / RLS coupling. |
| Password hashing | `@node-rs/argon2` (fallback `bcryptjs`)                            | Strong, standard                                                                                                                                                      |
| Session tokens   | `@oslojs/crypto` + `@oslojs/encoding`                              | SvelteKit-recommended session pattern                                                                                                                                 |
| Validation       | `zod`                                                              | Form + API input validation                                                                                                                                           |
| News (free)      | Google News RSS per account (no key)                               | Works out-of-the-box                                                                                                                                                  |
| News (optional)  | Tavily / NewsAPI / GNews / Bing — pluggable adapters               | Better coverage if keys provided                                                                                                                                      |
| Enrichment       | **OpenRouter** (OpenAI-compatible), model configurable             | Summaries + signal/impact/sentiment classification. Key provided by user.                                                                                             |
| Market data      | _Deferred_ — widget slot kept, adapter added later                 | "Client Stock Watch" lands in a later pass                                                                                                                            |
| Scheduling       | Cron (Vercel Cron / Supabase pg_cron / node-cron) + manual refresh | Keeps feed live                                                                                                                                                       |
| Styling          | Bespoke CSS design system (`src/lib/watch/watch.css`), no Tailwind | Self-contained `.watch` token layer; zero UI deps                                                                                                                     |

All authorization is **application-level** (every query is scoped by the logged-in
user). We do **not** rely on Postgres RLS, since the app connects as the Postgres
owner via the direct connection string.

---

## 4. Data model (Drizzle schema)

`src/lib/watch/server/db/schema.ts`

```
users
  id (uuid pk) · email (unique) · password_hash · full_name · role (enum: admin|member)
  pod (text, nullable) · is_active (bool) · created_at · updated_at

sessions                       -- server session store
  id (text pk, hashed token) · user_id (fk users) · expires_at

accounts                       -- the customers being watched
  id (uuid pk) · name · legal_name · segment (enum: mining|energy|infra|water|
  natural_resources|government|...) · country · website · domain · logo_url
  ticker · exchange · description · pod (text) · is_active · created_at · updated_at

user_accounts                  -- who can see what (many-to-many)
  user_id (fk) · account_id (fk)  · PRIMARY KEY (user_id, account_id)

news_items                     -- the feed + the signals table
  id (uuid pk) · account_id (fk) · title · summary · url (unique per account via hash)
  url_hash · source · author · image_url · published_at · fetched_at
  -- enrichment (nullable until enriched):
  signal_type (enum: expansion|regulatory|earnings|partnership|budget_cut|
  leadership|m_and_a|product|financial|other)
  impact_label (text)          -- e.g. "Upsell Opportunity", "Compliance Risk"
  impact_kind (enum: opportunity|risk|neutral)
  sentiment (enum: bullish|neutral|bearish) · sentiment_score (real -1..1)
  trend_pct (real, nullable)   -- optional movement figure shown in table
  is_priority (bool)           -- surfaces into Priority Alerts
  raw (jsonb)                  -- original payload
  created_at

ingestion_runs                 -- observability for the agents
  id (uuid pk) · account_id (fk, nullable) · source · status (queued|running|
  success|error) · items_found · items_new · error · started_at · finished_at

market_quotes                  -- Client Stock Watch (optional)
  id · account_id (fk) · price · change_pct · currency · as_of · created_at

sector_sentiment               -- right-rail widget (derived/aggregated)
  segment (pk) · score (0..100) · as_of
```

Indexes: `news_items(account_id, published_at desc)`, `news_items(url_hash)` unique
per account, `user_accounts(user_id)`, `accounts(segment)`.

---

## 5. Authentication & authorization

- **Login** at `/watch` — email + password. On success, create a `sessions` row and
  set an httpOnly, secure, sameSite cookie holding the session token.
- **`hooks.server.ts`** resolves the session cookie → `event.locals.user` (or null)
  on every request. Sliding expiry (refresh when close to expiry).
- **Route guards**: a `/watch` layout `load` redirects unauthenticated users to login;
  `/watch/admin` requires `role = admin`.
- **Isolation (the core requirement)**: every account/news query is filtered through
  `user_accounts` for `locals.user.id`. A member physically cannot load an account or
  news item they aren't assigned to — enforced in a single `requireAccountAccess()`
  helper used by all data loaders and API routes. Admins bypass the filter.
- **Seeding creds**: a script reads the account list, creates one `users` row per
  person with a generated strong temporary password (hashed), maps them to their POD's
  accounts via `user_accounts`, and outputs a **credentials sheet** (CSV) for handoff.
  Users are prompted to change password on first login.

---

## 6. Data ingestion — research & search agents

This is the engine behind the feed. Designed as a **pluggable pipeline** so it works
with zero paid keys (Google News RSS) and gets better as keys are added.

```
src/lib/watch/server/agents/
  sources/
    google-news-rss.ts     -- free; per-account query → article list
    tavily.ts              -- optional (TAVILY_API_KEY)
    newsapi.ts             -- optional (NEWSAPI_KEY)
    rss-feeds.ts           -- curated official/IR feeds per account
    market/stooq.ts        -- optional stock quotes
  enrich/
    classify.ts            -- Claude: summary + signal_type + impact + sentiment
    heuristics.ts          -- keyword fallback when no LLM key
  orchestrator.ts          -- per-account: run sources → dedupe → enrich → persist
  scheduler.ts             -- cycle over all active accounts on an interval
```

**Per-account cycle**

1. **Search/fetch** — each enabled source runs the account's query (name + aliases +
   ticker + segment terms), returns normalized `RawArticle[]`.
2. **Dedupe** — hash `url` (and title+date) → skip items already in `news_items`.
3. **Enrich** — for each new item, call the classifier:
   - With `OPENROUTER_API_KEY`: an LLM (via OpenRouter, OpenAI-compatible) returns
     `{summary, signal_type, impact_label, impact_kind, sentiment, sentiment_score,
is_priority}` as strict JSON.
   - Without a key: keyword heuristics assign best-effort values.
4. **Persist** — insert `news_items`; flip `is_priority` items into Priority Alerts;
   recompute `sector_sentiment` aggregates.
5. **Log** — write an `ingestion_runs` row (counts, timing, errors).

**Triggering**

- **Manual**: an admin "Refresh" button and `POST /watch/api/ingest` (all or one
  account) for on-demand runs.
- **Scheduled**: a cron endpoint `POST /watch/api/cron/ingest` (protected by a secret)
  called by Vercel Cron / GitHub Action / Supabase pg_cron every N minutes. Falls back
  to `node-cron` in a long-running (adapter-node) deployment.
- **Rate/robots**: RSS + official APIs only by default; polite intervals; per-source
  concurrency caps. No aggressive scraping of sites that forbid it.

**Build-time seeding**: during implementation I'll use my own web research/search
tools to pull a first batch of _real_ recent items per account so the dashboard is
populated immediately, then hand the ongoing job to the in-app pipeline.

---

## 7. UI / routes (rebuild of the reference, systematized)

**Dashboard** (`/watch/dashboard`) — the reference screen, cleaned up:

- Left: **Customer Segments** sidebar (counts per segment, filter).
- Top: **KPI cards** — Total Customers Tracked, Active Signals Today, Portfolio
  Sentiment, Revenue at Risk (config/derived).
- Center: **Key Customer Signals** table — account, signal type (chip), detail,
  impact (chip), trend. Rows link to the account page. Driven by `news_items`.
- Right rail: **Priority Alerts** (is_priority items), **Sector Sentiment** bars,
  **Client Stock Watch** (market_quotes).
- Footer status bar: engine status, sources monitored, last sync.

**Feed** (`/watch/feed`) — reverse-chronological cards across all the user's accounts,
filterable by account / segment / signal type / sentiment; infinite scroll.

**Account detail** (`/watch/accounts/[id]`) — company header (logo, segment, ticker),
KPIs, full news feed, signals timeline, quote sparkline.

**Admin** (`/watch/admin`) — users CRUD + reset password, accounts CRUD, POD/account
assignment matrix, ingestion runs monitor + manual refresh.

**Design system**: a `watch` token set (spacing, radius, elevation, segment colors,
signal/impact chip colors, sentiment scale) so chips/cards/tables are consistent.
Light, data-dense, accessible. Bespoke CSS (`src/lib/watch/watch.css`), no Tailwind.

---

## 8. Security & secrets

- The Supabase password was shared in chat — **rotate it** after setup (Supabase →
  Database → Reset password). It only ever lives in git-ignored `.env`.
- `.env` keys: `DATABASE_URL`, `SESSION_SECRET`/cookie config, `CRON_SECRET`,
  optional `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `NEWSAPI_KEY`, market keys.
- **`.env` gotcha**: the password contains `$` (`Lucario$2812`). Vite/dotenv can try
  to expand `$…`; we URL-encode it in `DATABASE_URL` (`%242812`) or escape it, and
  verify the connection at setup. Supabase requires **SSL** (`sslmode=require`).
- Passwords hashed (argon2/bcrypt), never stored or logged in plaintext. Sessions are
  httpOnly + secure + sameSite. Admin/cron endpoints require a secret or admin role.
- Connection: use the **pooler** host for serverless deploys (Vercel), the direct
  `db.<ref>.supabase.co:5432` for a persistent node server; `prepare:false` on pooler.

---

## 9. Environment variables (to add)

```
DATABASE_URL=postgresql://postgres:Lucario%242812@db.xkfsyyiuambybfocqwvw.supabase.co:5432/postgres?sslmode=require
CRON_SECRET=<random 32-byte hex>
# enrichment (user-provided):
OPENROUTER_API_KEY=
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet   # any OpenRouter model id
# optional paid news adapters (left unset — free RSS is the default):
TAVILY_API_KEY=
NEWSAPI_KEY=
```

`.env.example` updated to document these (without values).

---

## 10. Phased implementation

**Phase 0 — Foundations**

- [ ] Add deps (drizzle-orm, drizzle-kit, postgres, argon2/bcrypt, oslo, zod).
- [ ] `DATABASE_URL` in `.env`; drizzle config; verify Supabase connectivity.
- [ ] Schema + first migration; push to Supabase.

**Phase 1 — Data load**

- [ ] Ingest the POD account list (once the `.xlsx` is accessible in-repo): accounts,
      users, POD → account assignments.
- [ ] Seed users with generated passwords; emit credentials CSV.

**Phase 2 — Auth**

- [ ] Sessions, `hooks.server.ts`, login/logout, route guards, password change.
- [ ] `requireAccountAccess()` scoping helper.

**Phase 3 — Ingestion agents**

- [ ] Source adapters (Google News RSS first), orchestrator, dedupe, enrichment
      (Claude + heuristic fallback), `ingestion_runs`, manual + cron triggers.
- [ ] Seed a first real batch per account.

**Phase 4 — UI**

- [ ] Watch layout + theme; dashboard; feed; account detail; admin.
- [ ] Wire KPIs, signals table, alerts, sector sentiment, stock watch to live data.

**Phase 5 — Polish & verify**

- [ ] Prettier pass, `svelte-check`, empty/error states, loading, responsive, a11y.
- [ ] End-to-end check: two users see disjoint accounts/news; ingestion populates feed.

---

## 11. Decisions (locked) + remaining input

Locked with the user:

1. **News sources** — **free-first**: Google News RSS + curated feeds now; paid
   adapters (Tavily/NewsAPI) scaffolded and off until keys are added.
2. **Enrichment** — **OpenRouter** (user provides `OPENROUTER_API_KEY`); keyword
   heuristics as the no-key fallback.
3. **Market data** — **deferred**; widget slot kept, wired later.
4. **Hosting** — **Vercel later**; build deploy-portable and local-first now (works
   with the direct Supabase connection in dev; pooler config for Vercel added at deploy).

Still needed from the user:

- Move the account `.xlsx` into `data/accounts.xlsx` (Desktop is OS-locked to me).
- Provide the `OPENROUTER_API_KEY` when ready (build proceeds with heuristics until then).

---

_This plan is the source of truth; checklists above track progress._
