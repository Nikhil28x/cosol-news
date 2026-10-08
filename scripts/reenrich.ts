/**
 * Re-classify already-stored news with the current LLM (Gemini via OpenRouter),
 * upgrading rows that were enriched by the heuristic fallback.
 *   npx tsx scripts/reenrich.ts
 *
 * Idempotent + resumable: only touches rows whose enrich_model != the active model,
 * so re-running picks up anything that failed/was skipped. Never downgrades (a failed
 * LLM call leaves the existing classification intact).
 *
 * Env: REENRICH_CONCURRENCY (default 5), REENRICH_LIMIT (default: all).
 */
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { db } from '../src/lib/server/watch/db';
import { accounts, newsItems } from '../src/lib/server/watch/db/schema';
import type { Account } from '../src/lib/server/watch/db/schema';
import type { RawArticle } from '../src/lib/server/watch/agents/types';
import { openRouterEnricher } from '../src/lib/server/watch/agents/enrich/openrouter';

const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
const CONCURRENCY = Number(process.env.REENRICH_CONCURRENCY ?? 5);
const LIMIT = process.env.REENRICH_LIMIT ? Number(process.env.REENRICH_LIMIT) : undefined;

async function main() {
	if (!process.env.OPENROUTER_API_KEY) {
		console.error('OPENROUTER_API_KEY is not set — nothing to upgrade to.');
		process.exit(1);
	}

	const rows = await db
		.select({
			id: newsItems.id,
			title: newsItems.title,
			summary: newsItems.summary,
			publishedAt: newsItems.publishedAt,
			accName: accounts.name,
			accLegal: accounts.legalName,
			accSegment: accounts.segment,
			accIndustry: accounts.industry,
			accCountry: accounts.country
		})
		.from(newsItems)
		.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
		.where(
			and(
				eq(newsItems.businessRelevant, true),
				or(isNull(newsItems.enrichModel), ne(newsItems.enrichModel, MODEL))
			)
		)
		.limit(LIMIT ?? 1_000_000);

	console.log(`Re-enriching ${rows.length} items with ${MODEL} (concurrency ${CONCURRENCY})…\n`);

	let done = 0;
	let upgraded = 0;
	let failed = 0;
	let cursor = 0;

	async function worker() {
		while (cursor < rows.length) {
			const r = rows[cursor++];
			const account = {
				name: r.accName,
				legalName: r.accLegal,
				segment: r.accSegment,
				industry: r.accIndustry,
				country: r.accCountry
			} as Account;
			const article: RawArticle = {
				title: r.title,
				summary: r.summary,
				publishedAt: r.publishedAt,
				url: '',
				source: null,
				author: null,
				imageUrl: null
			};

			try {
				const e = await openRouterEnricher.enrich(account, article);
				if (e.model === MODEL) {
					await db
						.update(newsItems)
						.set({
							detail: e.detail,
							summary: e.summary,
							signalType: e.signalType,
							impactLabel: e.impactLabel,
							impactKind: e.impactKind,
							sentiment: e.sentiment,
							sentimentScore: e.sentimentScore,
							isPriority: e.isPriority,
							enrichedAt: new Date(),
							enrichModel: e.model
						})
						.where(eq(newsItems.id, r.id));
					upgraded++;
				} else {
					failed++; // LLM fell back to heuristics — leave row as-is
				}
			} catch {
				failed++;
			}
			if (++done % 50 === 0)
				console.log(`  ${done}/${rows.length}  (upgraded ${upgraded}, failed ${failed})`);
		}
	}

	await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
	console.log(`\n✅ Done. Upgraded ${upgraded}, failed/skipped ${failed}, total ${rows.length}.`);
	process.exit(0);
}

main().catch((err) => {
	console.error('Re-enrich failed:', err);
	process.exit(1);
});
