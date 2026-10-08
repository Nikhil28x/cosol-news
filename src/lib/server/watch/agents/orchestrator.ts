import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
	accountSignals,
	accounts,
	ingestionRuns,
	newsItems,
	newsSignalMatches
} from '../db/schema';
import type { Account, NewNewsItem } from '../db/schema';
import { urlHash } from '../auth/crypto';
import { getEnricher } from './enrich';
import { filterRelevant } from './relevance';
import { matchAccountSignals, type SignalProfile } from './signal-matching';
import { googleNewsRss } from './sources/google-news-rss';

export interface IngestResult {
	accountId: string;
	accountName: string;
	found: number;
	/** Articles the relevance guard rejected as off-topic (sport/showbiz/obituaries). */
	dropped: number;
	fresh: number;
	enriched: number;
	status: 'success' | 'error';
	error?: string;
}

const source = googleNewsRss; // free source; more can be composed here later
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch → dedupe → enrich → persist for a single account, logging an ingestion run. */
export async function ingestAccount(
	account: Account,
	opts: { enrich?: boolean } = {}
): Promise<IngestResult> {
	const [run] = await db
		.insert(ingestionRuns)
		.values({ accountId: account.id, source: source.name, status: 'running' })
		.returning({ id: ingestionRuns.id });

	try {
		const signalRows = await db
			.select()
			.from(accountSignals)
			.where(and(eq(accountSignals.accountId, account.id), eq(accountSignals.isActive, true)));
		const signals: SignalProfile[] = signalRows.map((signal) => ({
			id: signal.id,
			name: signal.name,
			kind: signal.kind,
			signalType: signal.signalType,
			terms: signal.terms,
			excludeTerms: signal.excludeTerms,
			isPriority: signal.isPriority,
			isActive: signal.isActive
		}));

		// 1. fetch, then drop off-topic hits (name collisions: "Bayer" the football club,
		//    "Varian" the racehorse trainer, "Blum" the obituary listings). The positive
		//    business gate also requires corporate language or a configured signal match.
		const fetched = await source.fetch(account, signals);
		const articles = filterRelevant(account, fetched, signals);
		const dropped = fetched.length - articles.length;

		// 2. dedupe within the batch by canonical url hash
		const seen = new Set<string>();
		const batch: { article: (typeof articles)[number]; hash: string }[] = [];
		for (const article of articles) {
			const hash = urlHash(article.url);
			if (seen.has(hash)) continue;
			seen.add(hash);
			batch.push({ article, hash });
		}

		// 3. drop items already stored for this account
		let fresh = batch;
		if (batch.length) {
			const existing = await db
				.select({ h: newsItems.urlHash })
				.from(newsItems)
				.where(
					and(
						eq(newsItems.accountId, account.id),
						inArray(
							newsItems.urlHash,
							batch.map((b) => b.hash)
						)
					)
				);
			const have = new Set(existing.map((e) => e.h));
			fresh = batch.filter((b) => !have.has(b.hash));
		}

		// 4. enrich + build rows
		const enricher = getEnricher();
		const doEnrich = opts.enrich !== false;
		let enriched = 0;
		const rows: NewNewsItem[] = [];
		const matchesByHash = new Map<string, { accountSignalId: string; matchedTerms: string[] }[]>();
		for (const { article, hash } of fresh) {
			const signalMatches = matchAccountSignals(signals, article);
			const primary = [...signalMatches].sort(
				(a, b) => Number(b.signal.isPriority) - Number(a.signal.isPriority)
			)[0]?.signal;
			let e = null;
			if (doEnrich) {
				try {
					e = await enricher.enrich(account, article);
					enriched++;
				} catch {
					e = null;
				}
			}
			rows.push({
				accountId: account.id,
				title: article.title,
				summary: e?.summary ?? article.summary,
				detail: e?.detail ?? null,
				url: article.url,
				urlHash: hash,
				source: article.source,
				author: article.author,
				imageUrl: article.imageUrl,
				publishedAt: article.publishedAt,
				signalType: e?.signalType ?? primary?.signalType ?? null,
				impactLabel:
					e?.impactLabel ??
					(primary?.kind === 'rfb' ? 'Bid Opportunity' : primary ? 'Watch Match' : null),
				impactKind: e?.impactKind ?? (primary?.kind === 'rfb' ? 'opportunity' : null),
				sentiment: e?.sentiment ?? null,
				sentimentScore: e?.sentimentScore ?? null,
				isPriority: Boolean(e?.isPriority || primary?.isPriority),
				businessRelevant: true,
				enrichedAt: e ? new Date() : null,
				enrichModel: e?.model ?? null,
				raw: article
			});
			matchesByHash.set(
				hash,
				signalMatches.map((match) => ({
					accountSignalId: match.signal.id,
					matchedTerms: match.matchedTerms
				}))
			);
		}

		// 5. persist (unique index on (account_id, url_hash) guards races)
		if (rows.length) {
			const inserted = await db
				.insert(newsItems)
				.values(rows)
				.onConflictDoNothing()
				.returning({ id: newsItems.id, urlHash: newsItems.urlHash });
			const matchRows = inserted.flatMap((item) =>
				(matchesByHash.get(item.urlHash) ?? []).map((match) => ({
					newsItemId: item.id,
					accountSignalId: match.accountSignalId,
					matchedTerms: match.matchedTerms
				}))
			);
			if (matchRows.length) {
				await db.insert(newsSignalMatches).values(matchRows).onConflictDoNothing();
			}
		}

		// 6. finalise the run
		await db
			.update(ingestionRuns)
			.set({
				status: 'success',
				itemsFound: articles.length,
				itemsNew: fresh.length,
				itemsEnriched: enriched,
				finishedAt: new Date()
			})
			.where(eq(ingestionRuns.id, run.id));

		return {
			accountId: account.id,
			accountName: account.name,
			found: articles.length,
			dropped,
			fresh: fresh.length,
			enriched,
			status: 'success'
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await db
			.update(ingestionRuns)
			.set({ status: 'error', error: msg.slice(0, 500), finishedAt: new Date() })
			.where(eq(ingestionRuns.id, run.id));
		return {
			accountId: account.id,
			accountName: account.name,
			found: 0,
			dropped: 0,
			fresh: 0,
			enriched: 0,
			status: 'error',
			error: msg
		};
	}
}

/** Ingest every active account with bounded concurrency and a polite delay. */
export async function ingestAllAccounts(
	opts: { enrich?: boolean; concurrency?: number; limit?: number } = {}
): Promise<IngestResult[]> {
	const active = await db.select().from(accounts).where(eq(accounts.isActive, true));
	const list = opts.limit ? active.slice(0, opts.limit) : active;
	const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, list.length || 1));
	const results: IngestResult[] = [];
	let cursor = 0;

	async function worker() {
		while (cursor < list.length) {
			const idx = cursor++;
			results[idx] = await ingestAccount(list[idx], opts);
			await sleep(400); // gentle on the free RSS endpoint
		}
	}

	await Promise.all(Array.from({ length: concurrency }, worker));
	return results;
}
