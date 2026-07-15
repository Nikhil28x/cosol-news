import type { ImpactKind, Sentiment, SignalType } from '$lib/watch/types';
import type { Account } from '../db/schema';

/** A normalised article as returned by any source adapter. */
export interface RawArticle {
	title: string;
	url: string;
	source: string | null;
	author: string | null;
	publishedAt: Date | null;
	summary: string | null;
	imageUrl: string | null;
}

/** The classification an enricher produces for one article. */
export interface EnrichResult {
	detail: string;
	summary: string;
	signalType: SignalType;
	impactLabel: string;
	impactKind: ImpactKind;
	sentiment: Sentiment;
	sentimentScore: number; // -1..1
	isPriority: boolean;
	model: string;
}

export interface Enricher {
	name: string;
	enrich(account: Account, article: RawArticle): Promise<EnrichResult>;
}

export interface Source {
	name: string;
	fetch(account: Account): Promise<RawArticle[]>;
}
