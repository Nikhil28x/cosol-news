import { and, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { AuthUser, FeedItem, ImpactKind, Sentiment, SignalType } from '$lib/watch/types';
import { db } from '../db';
import { accounts, newsItems, newsSignalMatches } from '../db/schema';
import { accessibleAccountIds } from './access';
import { clusterStories } from '$lib/watch/cluster';

const feedColumns = {
	id: newsItems.id,
	title: newsItems.title,
	detail: newsItems.detail,
	summary: newsItems.summary,
	url: newsItems.url,
	imageUrl: newsItems.imageUrl,
	source: newsItems.source,
	publishedAt: newsItems.publishedAt,
	fetchedAt: newsItems.fetchedAt,
	signalType: newsItems.signalType,
	impactLabel: newsItems.impactLabel,
	impactKind: newsItems.impactKind,
	sentiment: newsItems.sentiment,
	trendPct: newsItems.trendPct,
	isPriority: newsItems.isPriority,
	accId: accounts.id,
	accName: accounts.name,
	accSlug: accounts.slug,
	accSegment: accounts.segment,
	accTicker: accounts.ticker,
	accLogo: accounts.logoUrl
};

interface FeedRow {
	id: string;
	title: string;
	detail: string | null;
	summary: string | null;
	url: string;
	imageUrl: string | null;
	source: string | null;
	publishedAt: Date | null;
	fetchedAt: Date;
	signalType: SignalType | null;
	impactLabel: string | null;
	impactKind: ImpactKind | null;
	sentiment: Sentiment | null;
	trendPct: number | null;
	isPriority: boolean;
	accId: string;
	accName: string;
	accSlug: string;
	accSegment: string | null;
	accTicker: string | null;
	accLogo: string | null;
}

function shape(r: FeedRow): FeedItem {
	return {
		id: r.id,
		title: r.title,
		detail: r.detail,
		summary: r.summary,
		url: r.url,
		imageUrl: r.imageUrl,
		source: r.source,
		publishedAt: r.publishedAt,
		fetchedAt: r.fetchedAt,
		signalType: r.signalType,
		impactLabel: r.impactLabel,
		impactKind: r.impactKind,
		sentiment: r.sentiment,
		trendPct: r.trendPct,
		isPriority: r.isPriority,
		account: {
			id: r.accId,
			name: r.accName,
			slug: r.accSlug,
			segment: r.accSegment,
			ticker: r.accTicker,
			logoUrl: r.accLogo
		}
	};
}

export interface FeedOpts {
	accountId?: string;
	/** further restrict to this set of account ids (already within the user's scope) */
	accountIds?: string[];
	segment?: string;
	signalType?: string;
	sentiment?: string;
	priorityOnly?: boolean;
	/** Restrict to stories matched by one admin-configured account watch signal. */
	watchSignalId?: string;
	/** Strict business-news gate. Defaults to true for every product feed. */
	businessOnly?: boolean;
	sinceDays?: number;
	limit?: number;
	offset?: number;
	/** priority-first ordering for the dashboard "key signals" table */
	priorityFirst?: boolean;
	/** collapse same-event coverage into one lead + moreSources (default true) */
	cluster?: boolean;
}

const publishedOrFetched = sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`;

export async function getFeed(user: AuthUser, opts: FeedOpts = {}): Promise<FeedItem[]> {
	const ids = await accessibleAccountIds(user);
	if (ids !== 'all' && ids.length === 0) return [];

	const conds: SQL[] = [eq(accounts.isActive, true)];
	if (opts.businessOnly !== false) conds.push(eq(newsItems.businessRelevant, true));
	if (ids !== 'all') conds.push(inArray(newsItems.accountId, ids));
	if (opts.accountIds) {
		if (opts.accountIds.length === 0) return [];
		conds.push(inArray(newsItems.accountId, opts.accountIds));
	}
	if (opts.accountId) conds.push(eq(newsItems.accountId, opts.accountId));
	if (opts.segment) conds.push(eq(accounts.segment, opts.segment));
	if (opts.signalType) conds.push(eq(newsItems.signalType, opts.signalType as SignalType));
	if (opts.sentiment) conds.push(eq(newsItems.sentiment, opts.sentiment as Sentiment));
	if (opts.priorityOnly) conds.push(eq(newsItems.isPriority, true));
	if (opts.watchSignalId) {
		conds.push(
			inArray(
				newsItems.id,
				db
					.select({ id: newsSignalMatches.newsItemId })
					.from(newsSignalMatches)
					.where(eq(newsSignalMatches.accountSignalId, opts.watchSignalId))
			)
		);
	}
	if (opts.sinceDays) {
		const since = new Date(Date.now() - opts.sinceDays * 86_400_000);
		conds.push(gte(newsItems.fetchedAt, since));
	}

	// The same article legitimately exists under several accounts (news_items is unique
	// per (account, url_hash), not globally), so the combined feed would otherwise show
	// it more than once. Dedup in SQL: `winners` picks one news_item id per url_hash —
	// the best copy (priority-first, then most recent) — via DISTINCT ON; the main query
	// joins to that set and applies the feed's own ranking + pagination. Doing this in
	// SQL (rather than trimming an over-fetched page in JS) means limit/offset always
	// operate on already-unique rows, so a page can never come back short just because
	// duplicates crowded the window. `winners` selects only the id, so wrapping it in a
	// subquery can't collide with accounts.id.
	const winners = db
		.selectDistinctOn([newsItems.urlHash], { id: newsItems.id })
		.from(newsItems)
		.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
		.where(conds.length ? and(...conds) : undefined)
		.orderBy(newsItems.urlHash, desc(newsItems.isPriority), desc(publishedOrFetched))
		.as('winners');

	const order = opts.priorityFirst
		? [desc(newsItems.isPriority), desc(publishedOrFetched)]
		: [desc(publishedOrFetched)];

	const limit = opts.limit ?? 40;
	// Story clustering (default on) collapses same-event coverage from different publishers
	// into one lead after this query, which shrinks the count — so over-fetch a little, then
	// slice back to `limit` clusters. Callers needing raw article rows pass cluster:false.
	const doCluster = opts.cluster !== false;
	const take = doCluster ? Math.min(limit * 2, 200) : limit;

	const rows = await db
		.select(feedColumns)
		.from(newsItems)
		.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
		.innerJoin(winners, eq(newsItems.id, winners.id))
		.orderBy(...order)
		.limit(take)
		.offset(opts.offset ?? 0);

	const items = rows.map((r) => shape(r as FeedRow));
	return doCluster ? clusterStories(items).slice(0, limit) : items;
}
