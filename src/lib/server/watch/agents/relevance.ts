/**
 * Guardrails for fetched articles. Two independent gates, both must pass:
 *
 * 1. MENTION GATE (`mentionsAccount`) — the article must actually name the customer.
 *    Google News answers a query with whatever it considers related, so an account's
 *    feed fills up with sector chatter that never names the company ("AIIMS seat
 *    allocation result" under NIMHANS). We only keep articles whose title or snippet
 *    contains the account's name, an alias, the curated variants, or its ticker.
 *
 * 2. OFF-TOPIC GATE (`isOffTopic`) — the article must read as business news. Names that
 *    collide with a football club or a racehorse trainer ("Bayer", "Baxter", "Blum")
 *    pass the mention gate but are still sport. Two tiers, because transfer copy is full
 *    of business-sounding words ("€30m deal", "signing", "record fee"):
 *      - decisive markers (club football, horse racing) drop the item outright;
 *      - soft markers (other sport, showbiz, obituaries/police notices) drop it only
 *        when the text carries no business marker at all — so a bank's cricket
 *        sponsorship or a media house's box-office story still survives.
 */
import type { Account } from '../db/schema';
import { disambiguationFor } from './disambiguation';
import type { RawArticle } from './types';

/** Club football and horse racing — never how a customer's corporate news reads. */
const DECISIVE =
	/\b(leverkusen|bundesliga|la ?liga|serie a|ligue 1|eredivisie|(?<!women's )premier league|champions league|europa league|uefa|fifa|afc\b|indian super league|i-league|matchday|match ?preview|kick-?off|half-?time|full-?time|midfielder|goalkeeper|striker|winger|centre-?back|full-?back|transfer window|transfer fee|transfer update|on loan|loan spell|penalty shoot-?out|clean sheet|jockey|racecourse|racehorse|gelding|filly|maiden stakes|handicap chase|big race|caulfield cup|derby winner|goodwood|ascot|cheltenham|epsom|racing post|pre-?season friendly|friendly win|highlights ?& ?goals)\b/i;

/** Club shorthand next to a fixture/transfer verb ("Mainz 05 vs Bayer Leverkusen"). */
const CLUB_FIXTURE =
	/\b(fc|sc|cf|united|rovers|rangers|city)\b[^.]{0,40}\b(vs\.?|beats?|beat|draw|thrash|host|face|sign(s|ed|ing)?|preview|highlights)\b|\b(vs\.?|beats?|draw with|host)\b[^.]{0,40}\b(fc|sc|cf|united|rovers|rangers)\b/i;

/** A scoreline next to a match verb ("Bayer 04 beats RW Essen 3-0"). Soft: `2-1` also
 *  shows up in date ranges and rulings, so it only counts absent any business marker. */
const SCORELINE =
	/\b\d{1,2}-\d{1,2}\b[^.]{0,30}\b(beat|beats|win|wins|draw|highlights|goals)\b|\b(beat|beats|win|wins|draw|thrash)\b[^.]{0,30}\b\d{1,2}-\d{1,2}\b/i;

/** Other sport — soft, because sponsorships are legitimate corporate news. */
const SPORT =
	/\b(test match|odi\b|t20|ipl\b|wicket|batsman|batter|bowler|innings|all-?rounder|nba\b|nfl\b|mlb\b|nhl\b|wwe\b|grand slam|olympic|world cup|football|soccer|cricket|tournament|semi-?final|squad)\b/i;

const ENTERTAINMENT =
	/\b(box office|teaser|trailer|first look|web series|reality show|bollywood|tollywood|kollywood|actor|actress|film ?star|singer|rapper|album|concert|red carpet|celebrity)\b/i;

/** Obituaries, police blotter and classifieds that match a surname account. */
const PERSONAL =
	/\b(obituary|obituaries|funeral|passed away|celebration of life|in loving memory|arrested|charged with|pleaded guilty|sentenced to|drug raid|for sale in)\b/i;

/** Anything that makes an item legitimate corporate/sector news. */
const BUSINESS =
	/\b(revenue|earnings|profit|quarter(ly)?|q[1-4] (results|earnings|fy)|fy\d|results|guidance|dividend|ebitda|shares?|stock|share price|market cap|investor|analyst|ipo|valuation|acquisition|acquire[sd]?|merger|takeover|divest|funding|contract|tender|order book|partnership|joint venture|customer|client|product|platform|patent|trademark|lawsuit|litigation|settlement|regulator|regulatory|compliance|probe|tariff|export|import|supply chain|manufactur\w*|factory|plant|facility|capacity|expansion|layoffs?|workforce|union contract|ceo|cfo|coo|chairman|chairperson|managing director|board|clinical|trial|fda|usfda|\bema\b|drug|medicine|vaccine|therapy|therapeutic|oncology|patients?|hospital|healthcare|diagnostic|pharma\w*|generic|recall|approval|approved|bank(ing)?|deposits?|loans?|\bnpa\b|\brbi\b|\bsebi\b|sponsor(s|ed|ship)?|title rights|whistleblower|employees?|staff|workplace|harassment|fraud|scam|bribery|money laundering|data breach)\b/i;

function haystack(article: Pick<RawArticle, 'title' | 'summary'>): string {
	return `${article.title}. ${article.summary ?? ''}`;
}

// ---------------------------------------------------------------------------
// Mention gate — is this article actually about the customer?
// ---------------------------------------------------------------------------

/** Legal/structural words that can't identify a company on their own. */
const GENERIC = new Set([
	'and',
	'the',
	'of',
	'group',
	'groups',
	'subsidiaries',
	'subsidiary',
	'ltd',
	'limited',
	'inc',
	'llc',
	'plc',
	'corp',
	'corporation',
	'company',
	'co',
	'holdings',
	'india',
	'indian',
	'international',
	'industries',
	'services',
	'solutions',
	'technologies',
	'systems',
	'bank'
]);

/** Strip diacritics so "Mondelēz" matches "Mondelez" (publishers use both). */
function fold(s: string): string {
	return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** Lower-case, alphanumerics only — "Sun Pharma" and "SUNPHARMA" collapse to one form. */
function squash(s: string): string {
	return fold(s)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/** "TATA ELECTRONICS//PEGATRON" and "AXIS BANK AND SUBSIDIARIES" name several entities. */
function splitEntities(name: string): string[] {
	const parts = name
		.split(/\s*(?:\/\/|\/|&|\+|,| and )\s*/i)
		.map((p) => p.trim())
		.filter((p) => p.length > 1);
	if (parts.length < 2) return parts; // "BANK OF INDIA" is all-generic but is the name
	// Drop the trailing boilerplate a split leaves behind ("…AND SUBSIDIARIES").
	return parts.filter((p) => p.split(/\s+/).some((w) => !GENERIC.has(w.toLowerCase())));
}

export interface MentionTarget {
	name: string;
	slug?: string | null;
	legalName?: string | null;
	ticker?: string | null;
	aliases?: string[] | null;
}

/** "Nuclear Power Corporation (NPCIL)" carries its own abbreviation — keep both. */
function splitParenthetical(name: string): string[] {
	const inner = [...name.matchAll(/\(([^)]{2,})\)/g)].map((m) => m[1].trim());
	const outer = name.replace(/\([^)]*\)/g, ' ').trim();
	return [outer, ...inner].filter(Boolean);
}

/** Every string that counts as naming this account. */
function mentionTerms(account: MentionTarget): string[] {
	const d = disambiguationFor(account);
	const raw = [
		account.name,
		account.legalName ?? '',
		...(account.aliases ?? []),
		...(d.aliases ?? [])
	].filter(Boolean);
	const terms = new Set<string>();
	for (const r of raw)
		for (const p of splitParenthetical(r)) for (const e of splitEntities(p)) terms.add(e);
	return [...terms];
}

/**
 * Institutional words that head a lot of unrelated organisations — "Ministry of…",
 * "General…" — so they can't stand in for the whole name the way "Publicis" can.
 */
const BROAD = new Set([
	'ministry',
	'department',
	'general',
	'national',
	'international',
	'university',
	'institute',
	'authority',
	'commission',
	'federal',
	'central',
	'reserve',
	'council',
	'foundation',
	'hospital',
	'insurance',
	'telecom',
	'motors',
	'energy',
	'power',
	'projects',
	'electronics',
	'financial',
	'finance',
	'capital',
	'securities'
]);

function matchesTerm(term: string, text: string, squashed: string): boolean {
	const words = term.split(/\s+/).filter(Boolean);

	if (words.length > 1) {
		// a) joined form — "SUNPHARMA" finds "Sun Pharma"
		if (squashed.includes(squash(term))) return true;

		// b) the words in order, tolerating punctuation ("Bank of India", "Bank-of-India")
		const phrase = words.map(escapeRegExp).join('[^a-z0-9]{0,3}');
		if (new RegExp(`\\b${phrase}`, 'i').test(text)) return true;

		// c) every distinctive word present somewhere ("SBI" + "Life" for SBI Life
		//    Insurance). Institutional suffixes are dropped first, but only while at
		//    least two identifying words remain — "Ministry of Defence" must not come
		//    down to "defence".
		const named = words.filter((w) => w.length > 2 && !GENERIC.has(w.toLowerCase()));
		const lean = named.filter((w) => !BROAD.has(w.toLowerCase()));
		const distinctive = lean.length >= 2 ? lean : named;
		const has = (w: string) => new RegExp(`\\b${escapeRegExp(w)}`, 'i').test(text);
		if (distinctive.length >= 2 && distinctive.every(has)) return true;
		// A lone identifying word carries the name when the rest is boilerplate —
		// "Adani" for "ADANI GROUP", "Fino" for "Fino Bank". If the name has other
		// meaningful words, at least one of them must show up too.
		if (distinctive.length === 1 && has(distinctive[0])) {
			const others = words.filter(
				(w) =>
					w.toLowerCase() !== distinctive[0].toLowerCase() &&
					w.length > 2 &&
					!GENERIC.has(w.toLowerCase())
			);
			if (!others.length || others.some(has)) return true;
		}

		// d) a distinctive head word that identifies the company on its own — "Publicis
		//    raises guidance" is Publicis Groupe. Only long, non-institutional heads.
		const head = words[0].toLowerCase();
		const headOk = head.length >= 8 && !GENERIC.has(head) && !BROAD.has(head);
		return headOk && new RegExp(`\\b${escapeRegExp(words[0])}`, 'i').test(text);
	}

	// Single short token (acronyms like RBI, NSE, ANZ): word-boundary only, never a
	// substring — otherwise "anz" matches "bonanza". The negative lookahead skips
	// exchange prefixes ("NSE:XTGLOBAL" names the venue, not the company) while keeping
	// headline separators ("JLL: Retail investment hits a sweet spot"), which have a space.
	const squashedTerm = squash(term);
	if (squashedTerm.length <= 4) {
		const noTicker = '(?!:[a-z0-9])'; // "NSE:INFY" names the venue, not the company
		// Three letters or fewer are matched case-sensitively, so "TCS" isn't satisfied
		// by "TCs" (treatment charges) — both the term as written and its upper-case form
		// count, which is how a curated "PwC" alias matches PwC. Four-letter names
		// ("Sony", "IIFL") are safe case-insensitively and the press mixes their casing.
		if (squashedTerm.length <= 3) {
			const forms = [...new Set([term, term.toUpperCase()])].map(escapeRegExp).join('|');
			return new RegExp(`\\b(?:${forms})\\b${noTicker}`).test(text);
		}
		return new RegExp(`\\b${escapeRegExp(term)}\\b${noTicker}`, 'i').test(text);
	}

	// Longer single token: substring on the squashed text, so "SUNPHARMA" finds
	// "Sun Pharma" and "Cipla's" alike.
	return squashed.includes(squashedTerm);
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when the article names the account — the hard guardrail that keeps each
 * account's feed to news about that company rather than its sector.
 */
export function mentionsAccount(
	account: MentionTarget,
	article: Pick<RawArticle, 'title' | 'summary'>
): boolean {
	// Fold both sides: the regex paths compare plain letters, the squashed path
	// compares letters-and-digits only.
	const text = fold(haystack(article));
	const squashed = squash(text);
	if (mentionTerms(account).some((t) => matchesTerm(fold(t), text, squashed))) return true;

	// Tickers are only meaningful in their upper-case form — "(BAX)", "NSE: SUNPHARMA".
	const ticker = account.ticker?.trim();
	if (ticker && ticker.length >= 2) {
		return new RegExp(`\\b${escapeRegExp(ticker)}\\b`).test(text);
	}
	return false;
}

/**
 * True when the article reads as sport / showbiz / personal-notice noise rather than
 * news about the company. Media & telecom accounts (Sony, Warner) are in the
 * entertainment business, so showbiz coverage is on-topic for them.
 */
export function isOffTopic(
	account: Pick<Account, 'segment'>,
	article: Pick<RawArticle, 'title' | 'summary'>
): boolean {
	const text = haystack(article);

	if (DECISIVE.test(text)) return true;
	if (CLUB_FIXTURE.test(text)) return true;

	if (BUSINESS.test(text)) return false;

	if (SPORT.test(text)) return true;
	if (SCORELINE.test(text)) return true;
	if (PERSONAL.test(text)) return true;
	if (account.segment !== 'telecom_media' && ENTERTAINMENT.test(text)) return true;
	return false;
}

/** Both gates: the article names the account AND reads as business news. */
export function isRelevantForAccount(
	account: MentionTarget & Pick<Account, 'segment'>,
	article: Pick<RawArticle, 'title' | 'summary'>
): boolean {
	return mentionsAccount(account, article) && !isOffTopic(account, article);
}

/** Keep only the articles that are genuinely about this account. */
export function filterRelevant<T extends Pick<RawArticle, 'title' | 'summary'>>(
	account: MentionTarget & Pick<Account, 'segment'>,
	articles: T[]
): T[] {
	return articles.filter((a) => isRelevantForAccount(account, a));
}
