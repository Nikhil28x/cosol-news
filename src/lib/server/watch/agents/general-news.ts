/**
 * General industry news — recent AI / tech stories, not tied to any customer account.
 * Fetched from Google News RSS (global/en-US), deduped, image-resolved, and shown to
 * everyone (no per-user scoping).
 */
import { desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { generalNews, type NewGeneralNews } from '../db/schema';
import { urlHash } from '../auth/crypto';
import { resolveArticleImage } from './images';
import { searchGoogleNews } from './sources/google-news-rss';

const TOPICS: { topic: string; query: string }[] = [
	{ topic: 'AI', query: '"artificial intelligence" OR "generative AI" when:7d' },
	{ topic: 'AI', query: '"OpenAI" OR "Anthropic" OR "Google DeepMind" OR "Gemini AI" when:7d' },
	{ topic: 'AI', query: 'AI startup OR "AI funding" OR "AI model" OR "AI chip" when:7d' },
	{ topic: 'Tech', query: '"machine learning" OR "LLM" OR "AI agents" OR "AI regulation" when:7d' }
];

const US_LOCALE = 'hl=en-US&gl=US&ceid=US:en';

export interface GeneralNewsResult {
	found: number;
	fresh: number;
	images: number;
}

export async function ingestGeneralNews(
	opts: { imageCap?: number } = {}
): Promise<GeneralNewsResult> {
	// 1) Fetch across topics (best-effort per topic).
	const collected: {
		article: Awaited<ReturnType<typeof searchGoogleNews>>[number];
		topic: string;
	}[] = [];
	for (const t of TOPICS) {
		try {
			const arts = await searchGoogleNews(t.query, { locale: US_LOCALE });
			for (const a of arts) collected.push({ article: a, topic: t.topic });
		} catch {
			/* skip this topic */
		}
	}

	// 2) Dedupe within the batch by canonical url hash.
	const seen = new Set<string>();
	const batch = collected
		.map((c) => ({ ...c, hash: urlHash(c.article.url) }))
		.filter((c) => (seen.has(c.hash) ? false : (seen.add(c.hash), true)));

	// 3) Drop already-stored items.
	let fresh = batch;
	if (batch.length) {
		const existing = await db
			.select({ h: generalNews.urlHash })
			.from(generalNews)
			.where(
				inArray(
					generalNews.urlHash,
					batch.map((b) => b.hash)
				)
			);
		const have = new Set(existing.map((e) => e.h));
		fresh = batch.filter((b) => !have.has(b.hash));
	}

	// 4) Insert.
	if (fresh.length) {
		const rows: NewGeneralNews[] = fresh.map((b) => ({
			title: b.article.title,
			url: b.article.url,
			urlHash: b.hash,
			imageUrl: b.article.imageUrl,
			source: b.article.source,
			summary: b.article.summary,
			topic: b.topic,
			publishedAt: b.article.publishedAt
		}));
		await db.insert(generalNews).values(rows).onConflictDoNothing();
	}

	// 5) Resolve real images for recent items lacking one (capped, guarded).
	let images = 0;
	const cap = opts.imageCap ?? 40;
	const noImg = await db
		.select({ id: generalNews.id, url: generalNews.url })
		.from(generalNews)
		.where(isNull(generalNews.imageUrl))
		.orderBy(desc(sql`coalesce(${generalNews.publishedAt}, ${generalNews.fetchedAt})`))
		.limit(cap);
	let cursor = 0;
	async function worker() {
		while (cursor < noImg.length) {
			const r = noImg[cursor++];
			try {
				const img = await resolveArticleImage(r.url);
				if (img) {
					await db.update(generalNews).set({ imageUrl: img }).where(eq(generalNews.id, r.id));
					images++;
				}
			} catch {
				/* skip */
			}
		}
	}
	await Promise.all(Array.from({ length: 5 }, worker));

	return { found: collected.length, fresh: fresh.length, images };
}
