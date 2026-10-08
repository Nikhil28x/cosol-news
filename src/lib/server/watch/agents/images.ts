/**
 * Real article images for news tiles. Google News RSS links don't carry images and
 * don't redirect to the publisher, so we:
 *   1) decode the link → publisher URL via Google's batchexecute endpoint,
 *   2) fetch the publisher page and read its og:image.
 * Fully guarded and best-effort — any failure returns null and the tile falls back to
 * its accent gradient. Run as a capped background pass after the daily ingest.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { newsItems } from '../db/schema';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124';

async function fetchText(url: string, ms: number): Promise<string | null> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			redirect: 'follow',
			headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' }
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** Google News article link → real publisher URL (via batchexecute), or null. */
export async function resolvePublisherUrl(googleUrl: string): Promise<string | null> {
	if (googleUrl.startsWith('http') && !googleUrl.includes('news.google.')) return googleUrl;
	const id = googleUrl.match(/\/articles\/([^?]+)/)?.[1];
	if (!id) return null;

	const page = await fetchText(googleUrl, 12_000);
	if (!page) return null;
	const sig = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
	const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
	if (!sig || !ts) return null;

	const payload = [
		[
			[
				'Fbv4je',
				JSON.stringify([
					'garturlreq',
					[
						[
							'X',
							'X',
							['X', 'X'],
							null,
							null,
							1,
							1,
							'US:en',
							null,
							1,
							null,
							null,
							null,
							null,
							null,
							0,
							1
						],
						'en-US',
						'US',
						1,
						[2],
						1,
						1,
						null,
						0,
						0,
						null,
						0
					],
					id,
					Number(ts),
					sig
				]),
				null,
				'generic'
			]
		]
	];

	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 12_000);
	try {
		const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
			method: 'POST',
			signal: ctrl.signal,
			headers: {
				'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
				'user-agent': UA
			},
			body: 'f.req=' + encodeURIComponent(JSON.stringify(payload))
		});
		if (!res.ok) return null;
		const text = await res.text();
		const m = text.match(/https?:\/\/[^\\"\s]+/);
		return m ? m[0] : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** Extract a usable og:image / twitter:image from a page's HTML. */
export async function ogImage(pageUrl: string): Promise<string | null> {
	const html = await fetchText(pageUrl, 10_000);
	if (!html) return null;
	const head = html.slice(0, 120_000);
	const img =
		head.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
		head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
		head.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
	if (!img) return null;
	const clean = img.trim().replace(/&amp;/g, '&');
	if (!/^https?:\/\//i.test(clean)) return null;
	// Upgrade http → https so images aren't blocked as mixed content on the https app.
	return clean.replace(/^http:\/\//i, 'https://');
}

/** Google News link → real image URL, or null (best-effort). */
export async function resolveArticleImage(googleUrl: string): Promise<string | null> {
	try {
		const pub = await resolvePublisherUrl(googleUrl);
		if (!pub) return null;
		return await ogImage(pub);
	} catch {
		return null;
	}
}

/**
 * Capped background pass: resolve real images for the most recent items that don't
 * have one yet. Bounded so it never dominates the daily refresh; coverage of recent
 * (visible) news grows over successive runs.
 */
export async function enrichImagesForRecent(
	opts: { cap?: number; concurrency?: number } = {}
): Promise<{ scanned: number; resolved: number }> {
	const cap = opts.cap ?? 150;
	const concurrency = Math.max(1, opts.concurrency ?? 6);

	const rows = await db
		.select({ id: newsItems.id, url: newsItems.url })
		.from(newsItems)
		.where(and(isNull(newsItems.imageUrl), eq(newsItems.businessRelevant, true)))
		.orderBy(desc(newsItems.fetchedAt))
		.limit(cap);

	let resolved = 0;
	let cursor = 0;
	async function worker() {
		while (cursor < rows.length) {
			const r = rows[cursor++];
			try {
				const img = await resolveArticleImage(r.url);
				if (img) {
					await db.update(newsItems).set({ imageUrl: img }).where(eq(newsItems.id, r.id));
					resolved++;
				}
			} catch {
				/* one row's resolve/write failure must not abort the whole pass */
			}
		}
	}
	await Promise.all(Array.from({ length: concurrency }, worker));
	return { scanned: rows.length, resolved };
}
