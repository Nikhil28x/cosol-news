import { desc, sql } from 'drizzle-orm';
import type { FeedItem } from '$lib/watch/types';
import { db } from '../db';
import { generalNews, type GeneralNewsItem } from '../db/schema';

/** General AI/tech news as FeedItems so it reuses NewsTile. Not account-scoped. */
function toFeedItem(r: GeneralNewsItem): FeedItem {
	return {
		id: r.id,
		title: r.title,
		detail: null,
		summary: r.summary,
		url: r.url,
		imageUrl: r.imageUrl,
		// Publisher lives in account.name for general news; null here avoids the tile
		// meta printing it twice (📍 {account.name} · {when} · {source}).
		source: null,
		publishedAt: r.publishedAt,
		fetchedAt: r.fetchedAt,
		signalType: null,
		impactLabel: null,
		impactKind: null,
		sentiment: null,
		trendPct: null,
		isPriority: false,
		account: {
			id: '',
			name: r.source ?? 'AI & Tech',
			slug: '',
			segment: 'technology',
			ticker: null,
			logoUrl: null
		}
	};
}

export async function getGeneralNews(limit = 24): Promise<FeedItem[]> {
	const rows = await db
		.select()
		.from(generalNews)
		.orderBy(desc(sql`coalesce(${generalNews.publishedAt}, ${generalNews.fetchedAt})`))
		.limit(limit);
	return rows.map(toFeedItem);
}
