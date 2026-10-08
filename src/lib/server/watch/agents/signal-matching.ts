import type { AccountSignalKind, SignalType } from '$lib/watch/types';

/** The subset of an account signal needed by query, relevance and ingestion code. */
export interface SignalProfile {
	id: string;
	name: string;
	kind: AccountSignalKind;
	signalType: SignalType;
	terms: string[];
	excludeTerms: string[];
	isPriority: boolean;
	isActive?: boolean;
}

export interface SignalMatch {
	signal: SignalProfile;
	matchedTerms: string[];
}

function fold(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLocaleLowerCase('en')
		.replace(/[’‘]/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

function contains(text: string, term: string): boolean {
	const needle = fold(term);
	if (!needle) return false;
	// Short acronyms such as RFB/RFP must be whole tokens; longer phrases may match
	// naturally inside punctuation and possessive forms.
	if (/^[a-z0-9]{2,4}$/.test(needle)) {
		const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
	}
	return text.includes(needle);
}

export function matchSignalText(
	signal: SignalProfile,
	article: { title: string; summary?: string | null }
): string[] {
	const text = fold(`${article.title}. ${article.summary ?? ''}`);
	if ((signal.excludeTerms ?? []).some((term) => contains(text, term))) return [];
	return [...new Set((signal.terms ?? []).filter((term) => contains(text, term)))];
}

export function matchAccountSignals(
	signals: SignalProfile[],
	article: { title: string; summary?: string | null }
): SignalMatch[] {
	return signals
		.filter((signal) => signal.isActive !== false)
		.map((signal) => ({ signal, matchedTerms: matchSignalText(signal, article) }))
		.filter((match) => match.matchedTerms.length > 0);
}
