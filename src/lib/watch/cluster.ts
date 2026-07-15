import type { FeedItem, StorySource } from './types';

/**
 * Story-level clustering: collapse near-duplicate coverage of the same event — the same
 * story reported by several publishers under different URLs (and reworded headlines) —
 * into a single "lead" article, with the rest attached as `moreSources`.
 *
 * Exact-URL duplicates are already removed upstream (getFeed dedups by url_hash); this is
 * the fuzzy layer on top. It is deliberately lexical (no embeddings): two items merge when
 * they share the same account, publish within a short window, and their salient title
 * tokens overlap strongly. That reliably catches close-worded coverage; genuinely
 * different phrasings of the same event may still slip through — this trims the obvious
 * repeats, it is not semantic deduplication.
 */

// Too generic to signal a shared story: English stopwords + news filler + finance/entity
// boilerplate. What remains after removing these (and the account's own name) is salient.
const STOP = new Set([
	'the',
	'a',
	'an',
	'and',
	'or',
	'but',
	'of',
	'to',
	'in',
	'on',
	'for',
	'with',
	'at',
	'by',
	'from',
	'as',
	'is',
	'are',
	'be',
	'was',
	'were',
	'it',
	'its',
	'this',
	'that',
	'these',
	'those',
	'into',
	'over',
	'under',
	'after',
	'before',
	'amid',
	'says',
	'say',
	'said',
	'sees',
	'see',
	'seen',
	'set',
	'new',
	'now',
	'up',
	'down',
	'out',
	'off',
	'not',
	'no',
	'may',
	'will',
	'can',
	'could',
	'would',
	'should',
	'has',
	'have',
	'had',
	'get',
	'gets',
	'got',
	'more',
	'than',
	'vs',
	'via',
	'per',
	'how',
	'why',
	'what',
	'who',
	'when',
	'plans',
	'plan',
	'eyes',
	'bets',
	'bet',
	'top',
	'key',
	'big',
	// news / finance filler that co-occurs everywhere and shouldn't bind two stories together
	'india',
	'indian',
	'report',
	'reports',
	'update',
	'news',
	'stock',
	'stocks',
	'shares',
	'share',
	'market',
	'markets',
	'pct',
	'percent',
	'yoy',
	'crore',
	'lakh',
	'billion',
	'million',
	'mn',
	'bn',
	'rs',
	'inr',
	'usd',
	'capital',
	'group',
	'ltd',
	'limited',
	'inc',
	'corp',
	'co',
	'company',
	'pvt',
	'securities',
	'q1',
	'q2',
	'q3',
	'q4',
	// event-notice boilerplate — "X schedules Q4 earnings call on <month>" templates share
	// all of these, so they must not bind two different companies' notices together
	'schedule',
	'schedules',
	'scheduled',
	'earnings',
	'call',
	'calls',
	'conference',
	'meet',
	'meeting',
	'investor',
	'investors',
	'result',
	'results',
	'agm',
	'egm',
	'board',
	'webcast',
	'presentation',
	'analyst',
	'briefing',
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december',
	'jan',
	'feb',
	'mar',
	'apr',
	'jun',
	'jul',
	'aug',
	'sep',
	'sept',
	'oct',
	'nov',
	'dec'
]);

function tokenize(s: string): string[] {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9 ]+/g, ' ')
		.split(/\s+/)
		.filter(Boolean);
}

function salientTokens(title: string, accountName: string): Set<string> {
	const nameTokens = new Set(tokenize(accountName));
	const out = new Set<string>();
	for (const t of tokenize(title)) {
		if (t.length < 3) continue; // drop short/common fragments and 1–2 digit numbers
		if (/^\d+$/.test(t)) continue; // bare numbers (years, %, counts) aren't story-distinctive
		if (STOP.has(t)) continue;
		if (nameTokens.has(t)) continue; // the entity name is shared by all its news
		out.add(t);
	}
	return out;
}

/** Count of tokens shared by two salient-token sets. */
function sharedCount(a: Set<string>, b: Set<string>): number {
	const [small, big] = a.size <= b.size ? [a, b] : [b, a];
	let n = 0;
	for (const t of small) if (big.has(t)) n++;
	return n;
}

export interface ClusterOpts {
	/** Min overlap coefficient |A∩B| / min(|A|,|B|) to merge (default 0.5). */
	threshold?: number;
	/** Min absolute shared salient tokens to merge — guards against thin ticker/name-only merges (default 3). */
	minShared?: number;
	/** Max publish-time gap, in hours, to treat two items as the same event (default 96). */
	windowHours?: number;
}

/**
 * Cluster a pre-ranked feed (best item first) into stories. The first item of each cluster
 * is kept as the lead; later matches become entries in the lead's `moreSources`. Order of
 * leads is preserved, so the returned list is still in the input's ranking order.
 */
export function clusterStories(items: FeedItem[], opts: ClusterOpts = {}): FeedItem[] {
	const threshold = opts.threshold ?? 0.5;
	const minShared = opts.minShared ?? 3;
	const windowMs = (opts.windowHours ?? 96) * 3_600_000;

	const clusters: { lead: FeedItem; sig: Set<string>; t: number; extra: StorySource[] }[] = [];

	for (const item of items) {
		const sig = salientTokens(item.title, item.account.name);
		const t = (item.publishedAt ?? item.fetchedAt).getTime();

		let merged = false;
		if (sig.size >= minShared) {
			for (const c of clusters) {
				if (c.lead.account.id !== item.account.id) continue;
				if (Math.abs(c.t - t) > windowMs) continue;
				const shared = sharedCount(sig, c.sig);
				if (shared >= minShared && shared / Math.min(sig.size, c.sig.size) >= threshold) {
					c.extra.push({ id: item.id, source: item.source, url: item.url, title: item.title });
					merged = true;
					break;
				}
			}
		}
		if (!merged) clusters.push({ lead: item, sig, t, extra: [] });
	}

	return clusters.map((c) => (c.extra.length ? { ...c.lead, moreSources: c.extra } : c.lead));
}
