import { XMLParser } from 'fast-xml-parser';
import type { Account } from '../../db/schema';
import { buildQuery } from '../query';
import type { RawArticle, Source } from '../types';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

const ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'",
	'&nbsp;': ' '
};

function decode(s: string): string {
	return s
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function stripHtml(s: string | undefined | null): string | null {
	if (!s) return null;
	const text = decode(String(s).replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
	return text || null;
}

/**
 * Fetch and fully read the body under one AbortController budget. The timer must
 * stay armed until after `res.text()` completes — clearing it right after headers
 * arrive (as a naive helper would) leaves the body download uncapped.
 */
async function fetchTextWithTimeout(
	url: string,
	ms = 15_000
): Promise<{ ok: boolean; status: number; text: string }> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		const res = await fetch(url, {
			signal: ctrl.signal,
			headers: {
				'user-agent':
					'Mozilla/5.0 (compatible; COSOLCustomerWatch/1.0; +https://cosol.in) news-aggregator',
				accept: 'application/rss+xml, application/xml, text/xml'
			}
		});
		const text = res.ok ? await res.text() : '';
		return { ok: res.ok, status: res.status, text };
	} finally {
		clearTimeout(timer);
	}
}

function toDate(v: unknown): Date | null {
	if (!v) return null;
	const d = new Date(String(v));
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Google News RSS — free, no key. India locale (COSOL's accounts are Indian). The
 * item link is a Google redirect URL (kept as the canonical url); `source` holds the
 * originating publisher, and Google appends " - Publisher" to titles which we trim.
 */
/** Best-effort image from RSS media tags / an <img> in the description (often none). */
function pickImage(it: Record<string, unknown>): string | null {
	const media = (it['media:content'] ?? it['media:thumbnail'] ?? it['enclosure']) as
		Record<string, unknown> | Record<string, unknown>[] | undefined;
	const m = Array.isArray(media) ? media[0] : media;
	const mUrl = m?.['@_url'];
	if (typeof mUrl === 'string' && mUrl) return mUrl;
	const desc = typeof it.description === 'string' ? it.description : '';
	const img = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
	return img ? img[1] : null;
}

/** Run a raw Google News RSS query (the query string should already carry any when: filter). */
export async function searchGoogleNews(
	query: string,
	opts: { locale?: string } = {}
): Promise<RawArticle[]> {
	const locale = opts.locale ?? 'hl=en-IN&gl=IN&ceid=IN:en';
	const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;

	const { ok, status, text } = await fetchTextWithTimeout(url);
	if (!ok) throw new Error(`Google News RSS ${status} for "${query}"`);
	const data = parser.parse(text);

	const rawItems = data?.rss?.channel?.item ?? [];
	const items = Array.isArray(rawItems) ? rawItems : [rawItems];

	const out: RawArticle[] = [];
	for (const it of items) {
		if (!it || !it.link || !it.title) continue;
		const sourceName = (typeof it.source === 'object' ? it.source?.['#text'] : it.source) ?? null;
		let title = decode(String(it.title)).trim();
		if (sourceName && title.endsWith(` - ${sourceName}`)) {
			title = title.slice(0, -` - ${sourceName}`.length).trim();
		}
		out.push({
			title,
			url: String(it.link),
			source: sourceName ? String(sourceName) : null,
			author: null,
			publishedAt: toDate(it.pubDate),
			summary: stripHtml(it.description),
			imageUrl: pickImage(it)
		});
	}
	return out;
}

export const googleNewsRss: Source = {
	name: 'google-news-rss',
	fetch(account: Account): Promise<RawArticle[]> {
		return searchGoogleNews(buildQuery(account, { windowDays: 30 }));
	}
};
