import { and, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { AuthUser, FeedItem, ImpactKind, Sentiment, SignalType } from '$lib/watch/types';
import { db } from '../db';
import { accounts, newsItems } from '../db/schema';
import { accessibleAccountIds } from './access';

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
	segment?: string;
	signalType?: string;
	sentiment?: string;
	priorityOnly?: boolean;
	sinceDays?: number;
	limit?: number;
	offset?: number;
	/** priority-first ordering for the dashboard "key signals" table */
	priorityFirst?: boolean;
}

const publishedOrFetched = sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`;

export async function getFeed(user: AuthUser, opts: FeedOpts = {}): Promise<FeedItem[]> {
	const ids = await accessibleAccountIds(user);
	if (ids !== 'all' && ids.length === 0) return [];

	const conds: SQL[] = [eq(accounts.isActive, true)];
	if (ids !== 'all') conds.push(inArray(newsItems.accountId, ids));
	if (opts.accountId) conds.push(eq(newsItems.accountId, opts.accountId));
	if (opts.segment) conds.push(eq(accounts.segment, opts.segment));
	if (opts.signalType) conds.push(eq(newsItems.signalType, opts.signalType as SignalType));
	if (opts.sentiment) conds.push(eq(newsItems.sentiment, opts.sentiment as Sentiment));
	if (opts.priorityOnly) conds.push(eq(newsItems.isPriority, true));
	if (opts.sinceDays) {
		const since = new Date(Date.now() - opts.sinceDays * 86_400_000);
		conds.push(gte(newsItems.fetchedAt, since));
	}

	const order = opts.priorityFirst
		? [desc(newsItems.isPriority), desc(publishedOrFetched)]
		: [desc(publishedOrFetched)];

	const rows = await db
		.select(feedColumns)
		.from(newsItems)
		.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
		.where(conds.length ? and(...conds) : undefined)
		.orderBy(...order)
		.limit(opts.limit ?? 40)
		.offset(opts.offset ?? 0);

	return rows.map((r) => shape(r as FeedRow));
}
