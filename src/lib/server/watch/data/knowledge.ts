/**
 * Knowledge base for the admin AI assistant: full-text retrieval over news_items
 * plus compact account/user metadata. No embeddings — Postgres FTS is plenty at this
 * scale and keeps everything in one query path.
 */
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { accounts, newsItems, userAccounts, users } from '../db/schema';
import { segmentDef } from '$lib/watch/segments';

export interface RetrievedArticle {
	id: string;
	title: string;
	account: string;
	accountSlug: string;
	segment: string | null;
	source: string | null;
	date: string | null;
	url: string;
	summary: string | null;
}

export interface KnowledgeContext {
	articles: RetrievedArticle[];
	accounts: { name: string; segment: string; pod: string | null; ticker: string | null }[];
	users: { name: string; pod: string | null; role: string; accountCount: number }[];
	matchedAccounts: string[];
	matchedSegments: string[];
	/** How many articles the full-text search actually matched for the query (excludes
	 *  the recency back-fill) — 0 means the portfolio doesn't cover the question. */
	matchedNews: number;
	totals: { accounts: number; articles: number; users: number };
}

/** Account ids a given user can see (via user_accounts). Admins are seeded with all. */
export async function resolveUserAccountIds(userId: string): Promise<string[]> {
	const rows = await db
		.select({ id: userAccounts.accountId })
		.from(userAccounts)
		.where(eq(userAccounts.userId, userId));
	return rows.map((r) => r.id);
}

const doc = sql`to_tsvector('english', ${newsItems.title} || ' ' || coalesce(${newsItems.summary}, ''))`;
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const ARTICLE_COLS = {
	id: newsItems.id,
	title: newsItems.title,
	summary: newsItems.summary,
	url: newsItems.url,
	source: newsItems.source,
	publishedAt: newsItems.publishedAt,
	fetchedAt: newsItems.fetchedAt,
	accName: accounts.name,
	accSlug: accounts.slug,
	accSegment: accounts.segment
};

type ArticleRow = {
	id: string;
	title: string;
	summary: string | null;
	url: string;
	source: string | null;
	publishedAt: Date | null;
	fetchedAt: Date;
	accName: string;
	accSlug: string;
	accSegment: string | null;
};

function toArticle(r: ArticleRow): RetrievedArticle {
	return {
		id: r.id,
		title: r.title,
		account: r.accName,
		accountSlug: r.accSlug,
		segment: r.accSegment,
		source: r.source,
		date: isoDay(r.publishedAt ?? r.fetchedAt),
		url: r.url,
		summary: r.summary ? r.summary.slice(0, 240) : null
	};
}

export async function retrieveContext(
	query: string,
	opts: { limit?: number } = {}
): Promise<KnowledgeContext> {
	const limit = opts.limit ?? 40;
	const q = query.trim();
	const ql = q.toLowerCase();

	// Metadata (compact — the whole portfolio fits easily).
	const accountRows = await db
		.select({
			id: accounts.id,
			name: accounts.name,
			segment: accounts.segment,
			pod: accounts.pod,
			ticker: accounts.ticker,
			aliases: accounts.aliases
		})
		.from(accounts)
		.where(eq(accounts.isActive, true))
		.orderBy(accounts.name);

	// Detect accounts / segments named in the query — WHOLE-WORD matching against the
	// query's tokens (substring matching gave false positives like "brother"→"Other").
	const tokens = new Set(ql.split(/[^a-z0-9]+/).filter(Boolean));
	const wordsOf = (s: string, min: number) =>
		s
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter((w) => w.length >= min);

	const matchedAccountIds: string[] = [];
	const matchedAccounts: string[] = [];
	for (const a of accountRows) {
		const names = [a.name, ...(a.aliases ?? [])];
		const hit = names.some((n) => {
			const words = wordsOf(n, 2);
			return words.length > 0 && words.every((w) => tokens.has(w));
		});
		if (hit) {
			matchedAccountIds.push(a.id);
			matchedAccounts.push(a.name);
		}
	}
	const SEGMENT_KEYS = [...new Set(accountRows.map((a) => a.segment).filter(Boolean))] as string[];
	const matchedSegments = SEGMENT_KEYS.filter(
		(k) => k !== 'other' && wordsOf(segmentDef(k).label, 5).some((w) => tokens.has(w))
	);

	// 1) Full-text search for the query.
	const ftsRows: ArticleRow[] = q
		? await db
				.select(ARTICLE_COLS)
				.from(newsItems)
				.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
				.where(and(eq(accounts.isActive, true), sql`${doc} @@ websearch_to_tsquery('english', ${q})`))
				.orderBy(desc(sql`ts_rank(${doc}, websearch_to_tsquery('english', ${q}))`), desc(newsItems.fetchedAt))
				.limit(limit)
		: [];

	// 2) Recent news for accounts explicitly named (ensures they're covered).
	const namedRows: ArticleRow[] = matchedAccountIds.length
		? await db
				.select(ARTICLE_COLS)
				.from(newsItems)
				.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
				.where(and(eq(accounts.isActive, true), inArray(newsItems.accountId, matchedAccountIds)))
				.orderBy(desc(newsItems.fetchedAt))
				.limit(limit)
		: [];

	// 3) Fallback: if nothing matched, use the most recent priority news.
	let fallbackRows: ArticleRow[] = [];
	if (!ftsRows.length && !namedRows.length) {
		fallbackRows = await db
			.select(ARTICLE_COLS)
			.from(newsItems)
			.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
			.where(
				and(
					eq(accounts.isActive, true),
					matchedSegments.length ? inArray(accounts.segment, matchedSegments) : undefined
				)
			)
			.orderBy(desc(newsItems.fetchedAt))
			.limit(limit);
	}

	// Merge + dedupe by id, cap. Reserve up to half the slots for explicitly-named
	// accounts, then let FTS relevance fill the rest (so recency doesn't starve it).
	const seen = new Set<string>();
	const merged: RetrievedArticle[] = [];
	const half = Math.ceil(limit / 2);
	const ordered = [...namedRows.slice(0, half), ...ftsRows, ...namedRows.slice(half), ...fallbackRows];
	for (const r of ordered) {
		if (seen.has(r.id)) continue;
		seen.add(r.id);
		merged.push(toArticle(r));
		if (merged.length >= limit) break;
	}

	// Users + their account counts.
	const userRows = await db
		.select({ id: users.id, name: users.fullName, pod: users.pod, role: users.role })
		.from(users)
		.where(eq(users.isActive, true))
		.orderBy(users.fullName);
	const countRows = await db
		.select({ userId: userAccounts.userId, c: count() })
		.from(userAccounts)
		.groupBy(userAccounts.userId);
	const countMap = new Map(countRows.map((c) => [c.userId, Number(c.c)]));

	return {
		articles: merged,
		accounts: accountRows.map((a) => ({
			name: a.name,
			segment: segmentDef(a.segment).label,
			pod: a.pod,
			ticker: a.ticker
		})),
		users: userRows.map((u) => ({
			name: u.name,
			pod: u.pod,
			role: u.role,
			accountCount: countMap.get(u.id) ?? 0
		})),
		matchedAccounts,
		matchedSegments: matchedSegments.map((k) => segmentDef(k).label),
		matchedNews: ftsRows.length,
		totals: { accounts: accountRows.length, articles: merged.length, users: userRows.length }
	};
}
