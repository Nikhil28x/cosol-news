/**
 * Customer Watch database schema (Drizzle ORM, Postgres/Supabase).
 *
 * Controlled vocabularies (role, signal type, impact, sentiment, run status) are
 * stored as text with a TypeScript `$type<>()` cast rather than pg enums: this keeps
 * migrations painless and tolerates LLM-generated values, which we normalise in code.
 */
import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// ---- Controlled vocabularies (see src/lib/watch/types.ts for the shared copies) ----
export type UserRole = 'admin' | 'member';
export type SignalType =
	| 'expansion'
	| 'regulatory'
	| 'earnings'
	| 'partnership'
	| 'leadership'
	| 'm_and_a'
	| 'product'
	| 'financial'
	| 'legal'
	| 'esg'
	| 'contract'
	| 'budget_cut'
	| 'other';
export type ImpactKind = 'opportunity' | 'risk' | 'neutral';
export type Sentiment = 'bullish' | 'neutral' | 'bearish';
export type RunStatus = 'queued' | 'running' | 'success' | 'error';

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
};

// ---------------------------------------------------------------------------
// Users & sessions
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	fullName: text('full_name').notNull(),
	role: text('role').$type<UserRole>().notNull().default('member'),
	pod: text('pod'),
	title: text('title'),
	isActive: boolean('is_active').notNull().default(true),
	mustChangePassword: boolean('must_change_password').notNull().default(true),
	lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
	...timestamps
});

export const sessions = pgTable(
	'sessions',
	{
		// id = sha256(session token) as hex; the raw token lives only in the cookie.
		id: text('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('sessions_user_id_idx').on(t.userId)]
);

// ---------------------------------------------------------------------------
// Accounts (the customers being watched) + per-user access
// ---------------------------------------------------------------------------
export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),
		legalName: text('legal_name'),
		slug: text('slug').notNull().unique(),
		segment: text('segment'), // canonical key: mining_metals, energy_utilities, ...
		industry: text('industry'), // raw label from the source list
		country: text('country'),
		region: text('region'),
		website: text('website'),
		domain: text('domain'),
		logoUrl: text('logo_url'),
		ticker: text('ticker'),
		exchange: text('exchange'),
		description: text('description'),
		pod: text('pod'),
		// extra query terms fed to the search agents (name variants, subsidiaries, etc.)
		aliases: jsonb('aliases')
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		searchTerms: jsonb('search_terms')
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps
	},
	(t) => [index('accounts_segment_idx').on(t.segment), index('accounts_pod_idx').on(t.pod)]
);

export const userAccounts = pgTable(
	'user_accounts',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.accountId] }),
		index('user_accounts_user_idx').on(t.userId),
		index('user_accounts_account_idx').on(t.accountId)
	]
);

// ---------------------------------------------------------------------------
// News / signals feed
// ---------------------------------------------------------------------------
export const newsItems = pgTable(
	'news_items',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		summary: text('summary'),
		detail: text('detail'), // one-liner shown in the Key Signals table
		url: text('url').notNull(),
		urlHash: text('url_hash').notNull(), // sha256(canonical url), for dedupe
		source: text('source'),
		author: text('author'),
		imageUrl: text('image_url'),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),

		// enrichment (null until an enricher runs)
		signalType: text('signal_type').$type<SignalType>(),
		impactLabel: text('impact_label'), // e.g. "Upsell Opportunity"
		impactKind: text('impact_kind').$type<ImpactKind>(),
		sentiment: text('sentiment').$type<Sentiment>(),
		sentimentScore: real('sentiment_score'), // -1..1
		trendPct: real('trend_pct'), // optional movement figure for the table
		isPriority: boolean('is_priority').notNull().default(false),
		enrichedAt: timestamp('enriched_at', { withTimezone: true }),
		enrichModel: text('enrich_model'),

		raw: jsonb('raw'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('news_account_urlhash_uniq').on(t.accountId, t.urlHash),
		index('news_account_published_idx').on(t.accountId, t.publishedAt),
		index('news_priority_idx').on(t.isPriority),
		index('news_signal_type_idx').on(t.signalType)
	]
);

// ---------------------------------------------------------------------------
// Ingestion observability
// ---------------------------------------------------------------------------
export const ingestionRuns = pgTable(
	'ingestion_runs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
		source: text('source').notNull(),
		status: text('status').$type<RunStatus>().notNull().default('queued'),
		itemsFound: integer('items_found').notNull().default(0),
		itemsNew: integer('items_new').notNull().default(0),
		itemsEnriched: integer('items_enriched').notNull().default(0),
		error: text('error'),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
		finishedAt: timestamp('finished_at', { withTimezone: true })
	},
	(t) => [index('ingestion_runs_started_idx').on(t.startedAt)]
);

// ---------------------------------------------------------------------------
// Right-rail widgets
// ---------------------------------------------------------------------------
export const sectorSentiment = pgTable('sector_sentiment', {
	segment: text('segment').primaryKey(),
	score: real('score').notNull(), // 0..100
	label: text('label'),
	asOf: timestamp('as_of', { withTimezone: true }).notNull().defaultNow()
});

// Deferred feature (Client Stock Watch) — table kept so the slot exists.
export const marketQuotes = pgTable(
	'market_quotes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		price: real('price').notNull(),
		changePct: real('change_pct'),
		currency: text('currency').notNull().default('AUD'),
		asOf: timestamp('as_of', { withTimezone: true }).notNull().defaultNow(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [index('market_quotes_account_idx').on(t.accountId, t.asOf)]
);

// ---------------------------------------------------------------------------
// AI digest cache — Gemini summaries computed over the news knowledge base.
//   kind='dashboard' → scopeKey = user id (per-user, sector digests + portfolio)
//   kind='account'   → scopeKey = account id
// One row per (kind, scopeKey, day); regenerated after each daily fetch.
// ---------------------------------------------------------------------------
export const newsSummaries = pgTable(
	'news_summaries',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		kind: text('kind').$type<'dashboard' | 'account'>().notNull(),
		scopeKey: text('scope_key').notNull(),
		day: date('day').notNull(),
		payload: jsonb('payload').notNull(),
		model: text('model'),
		itemCount: integer('item_count').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [uniqueIndex('news_summaries_uniq').on(t.kind, t.scopeKey, t.day)]
);

// ---------------------------------------------------------------------------
// Relations (for Drizzle relational queries)
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	userAccounts: many(userAccounts)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
	userAccounts: many(userAccounts),
	newsItems: many(newsItems),
	quotes: many(marketQuotes)
}));

export const userAccountsRelations = relations(userAccounts, ({ one }) => ({
	user: one(users, { fields: [userAccounts.userId], references: [users.id] }),
	account: one(accounts, { fields: [userAccounts.accountId], references: [accounts.id] })
}));

export const newsItemsRelations = relations(newsItems, ({ one }) => ({
	account: one(accounts, { fields: [newsItems.accountId], references: [accounts.id] })
}));

// ---- Inferred row types ----
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type NewsSummary = typeof newsSummaries.$inferSelect;
