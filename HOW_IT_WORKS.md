# How COSOL Customer Watch works — RSS ingestion + Gemini digests

Two clean stages: **(A)** a daily RSS fetch builds a news knowledge base (no AI per
article), and **(B)** Gemini reads that knowledge base to write the dashboard's
per-sector summaries + signals and each account's briefing.

```
STAGE A — daily RSS refresh (no AI)                STAGE B — Gemini summarisation (on read)
────────────────────────────────────              ──────────────────────────────────────────
 accounts (131)                                     news_items  ──►  group by sector (per user)
    │  buildQuery("BHP" OR "BHP Group" when:30d)         (knowledge      │
    ▼                                                      base)         ▼
 Google News RSS ──► dedupe (url hash) ──► news_items              Gemini 2.5 Flash (1 call/user/day)
 (free, no key)      skip already-stored                                 │
                                                                         ▼
                                                        DashboardDigest { portfolio summary,
                                                          per-sector {summary, signals, sentiment} }
                                                        cached in news_summaries (per user, per day)
```

The two stages are decoupled: ingestion is fast/cheap and runs for everyone; the AI runs
once per user per day and only reads already-stored news.

---

## Stage A — the daily RSS refresh (no per-item AI)

Entry point: `refreshAll()` (`agents/refresh.ts`), run by the cron, the CLI
(`npm run watch:ingest`), and the Admin "Run ingestion" button.

For **every active account**, `agents/orchestrator.ts → ingestAccount(account, {enrich:false})`:

1. **Query** (`agents/query.ts`): `("Fortescue" OR "Fortescue Metals" OR "FMG") when:30d`
   — the account name + aliases, OR'd and quoted, plus optional `searchTerms`, last 30 days.
   Names that collide with something more newsworthy get a curated entry in
   `agents/disambiguation.ts` — extra aliases, an AND'd context group and `-term`
   exclusions — so "Bayer" returns Roundup litigation, not Bundesliga transfers, and
   "Varian" returns radiotherapy, not the racehorse trainer.
2. **Fetch** (`agents/sources/google-news-rss.ts`): Google News RSS (free, no key, India/AU
   locale) → parsed into `{title, url, publisher, publishedAt, snippet}` (title cleaned, HTML
   stripped, 15s timeout). This is the pluggable "source" — Tavily/NewsAPI can be added here.
3. **Guardrails** (`agents/relevance.ts`) — two gates, both must pass:
   - **Mention gate:** the article must actually name the customer. Google News answers a
     query with whatever it deems related, so without this an account collects sector
     chatter that never names it ("AIIMS seat allocation" under NIMHANS). Matching covers
     the account name, aliases, curated variants, parenthetical abbreviations
     ("… (NPCIL)"), split names ("TATA ELECTRONICS//PEGATRON"), squashed forms
     (`SUNPHARMA` = "Sun Pharma"), diacritics ("Mondelēz") and the ticker in upper case.
   - **Off-topic gate:** the article must read as business news. Decisive markers
     (Leverkusen, jockey, midfielder) reject outright; softer ones (cricket, box office,
     "arrested") reject only when the text carries no business marker, so a bank's IPL
     sponsorship or a media house's box-office story stays.

   When the press calls an account something else — TKM is "Toyota Kirloskar Motor",
   Vantiv is "Worldpay" — add the alias in `agents/disambiguation.ts`; it feeds both the
   query and the mention gate.

4. **Dedupe**: canonical URL hash (`auth/crypto.ts` — strips `utm_*`/`gclid`, SHA-256).
   Skips anything already stored for that account; a unique `(account_id, url_hash)` index is
   the final guard.
5. **Persist**: new rows inserted into `news_items`. **No LLM is called here.** An
   `ingestion_runs` row logs found/new counts.

Then `refreshAll()` **drops today's cached digests** (`invalidateTodaySummaries()`) so they
rebuild against the fresh news, and **pre-generates each active user's dashboard digest**.

## Stage B — Gemini summarisation (the AI layer)

The knowledge base is `news_items`. Gemini turns it into digests. Config in `.env`:

```
OPENROUTER_API_KEY=sk-or-v1-…
OPENROUTER_MODEL=google/gemini-2.5-flash
```

### Dashboard digest — `data/digest.ts → getDashboardDigest(user)`

- Gathers the **last 14 days** of the user's accounts' news, **grouped by sector**
  (≤25 items/sector to bound tokens).
- **One** Gemini call (`agents/summarise.ts → summariseDashboard`) with a system prompt to act
  as a COSOL analyst and return strict JSON: a **portfolio summary + sentiment**, and for
  **each sector** a `summary`, `sentiment` and up to 5 **signals**
  `{headline, account, kind: opportunity|risk|neutral}` grounded in the real headlines.
- Result is normalised (enums clamped) and **cached in `news_summaries`** as one row keyed by
  `(kind='dashboard', scope_key=userId, day)` — so it's computed at most **once per user per day**.

### Account digest — `getAccountDigest(account)`

- Gathers that account's **last 21 days** (≤40 items) → one Gemini call
  (`summariseAccount`) → `{summary, sentiment, signals}`, cached per `(account, day)`.

### Why per-user (isolation)

Each digest is generated from **only the viewer's own accounts** and cached under their id.
A member's briefing never mentions accounts outside their POD — the same isolation rule as
the raw feed (`data/access.ts → accessibleAccountIds`). Admins see all; with **View as**, an
admin gets that user's exact scoped digest.

## Serving

- **Dashboard** (`/watch/dashboard`): KPI counts render instantly (`getDashboardCounts`, no
  AI); the digest is returned as a **promise and streamed** — the page shows a spinner, then
  the portfolio briefing + per-sector cards (summary + signals) appear. Cached after first view.
- **Account page** (`/watch/accounts/[slug]`): the raw daily news list renders immediately;
  the Gemini briefing streams in above it.
- **Feed** (`/watch/feed`): the raw, filterable article stream (the knowledge base itself).

## Daily automation — runs every day at 6:00 AM

Three ways to run the daily `refreshAll`, pick per environment:

- **Deployed (Vercel):** `vercel.json` cron hits `POST /watch/api/cron/ingest` at
  **`30 0 * * *` = 00:30 UTC = 06:00 IST**. Protected by `CRON_SECRET` (Vercel sends
  `Authorization: Bearer $CRON_SECRET` automatically). `maxDuration: 300`; on Hobby use
  `?limit=N` batches + a more frequent schedule. (Change the UTC time if you're not in IST.)
- **Local / self-hosted:** `npm run watch:scheduler` — a long-running process that fires
  `refreshAll` every day at `REFRESH_HOUR` (default **6**) in the machine's local time zone.
  Keep it alive under pm2 / launchd / a container. Add `--now` to also run immediately.
- **OS cron alternative:** a crontab line — `0 6 * * * cd /path/to/cosol-news && npm run watch:ingest`.
- **Manual:** `npm run watch:ingest`, or the Admin "Run ingestion" button.
- **Housekeeping:** `npm run watch:prune` reports off-topic articles already stored (rows
  ingested before the relevance guard existed); `npm run watch:prune -- --apply` deletes
  them and drops today's digests so they rebuild. `--segment pharma_healthcare` scopes it.

**Freshness:** `refreshAll` deletes today's digests after fetching, so the next view
regenerates them from the new news. New day → new fetch → new digest.

## Admin — users & their accounts

`/watch/admin` lists every user (role, POD, account count, last login) with **Manage / View
as / Reset pw / Enable-Disable**. **Manage** (`/watch/admin/users/[id]`) shows all accounts
with a checkbox per account — search, "select POD", save — to **assign/unassign which
accounts each user can see**. Saving replaces that user's assignments and drops their cached
digest so it rebuilds for the new scope.

## What happens on a new day

The RSS query re-runs (`when:30d`), dedupe keeps only genuinely new URLs, they're stored, and
the day's digest is regenerated over the refreshed knowledge base. Ingestion never re-scrapes
old items; digests are recomputed daily (one Gemini call per user), so they always reflect the
latest news.

## Cost & latency

Ingestion is free (RSS) and calls no LLM. The AI cost is **one Gemini 2.5 Flash call per user
per day** for the dashboard (plus one per account when its page is first viewed that day) —
cents/day at this scale. First dashboard view of the day waits a few seconds for the stream;
subsequent views are instant from cache.

## File map

```
agents/query.ts                     per-account Google News query
agents/disambiguation.ts            curated aliases/context/exclusions for ambiguous names
agents/relevance.ts                 post-fetch off-topic guard (sport/showbiz/obituaries)
agents/sources/google-news-rss.ts   fetch + parse RSS (the search agent)
agents/orchestrator.ts              fetch → filter → dedupe → persist (enrich:false)
agents/refresh.ts                   refreshAll: daily RSS + rebuild digests
agents/summarise.ts                 Gemini calls → dashboard & account digests
data/digest.ts                      get-or-generate + daily cache + counts + isolation
data/access.ts                      per-user isolation
routes/watch/(app)/dashboard        KPIs + streamed portfolio & sector digests
routes/watch/(app)/accounts/[slug]  account briefing + raw feed
routes/watch/api/cron/ingest        daily scheduled refresh
db/schema.ts                        news_items (knowledge base) + news_summaries (digest cache)
```
