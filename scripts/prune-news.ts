/**
 * Remove already-stored articles that don't belong to their account.
 *
 * Ingestion applies both guardrails at fetch time (`agents/relevance.ts`): the article
 * must name the customer, and it must read as business news. Rows collected before those
 * gates existed — sector chatter that never names the account, the Bayer Leverkusen
 * transfer round-up in Pharma & Healthcare, the Blum obituaries in Manufacturing — are
 * still in `news_items` and still feed the Gemini digests. This sweeps them.
 *
 *   npx tsx scripts/prune-news.ts            # dry run: report only, changes nothing
 *   npx tsx scripts/prune-news.ts --apply    # delete them, then drop today's digests
 *   npx tsx scripts/prune-news.ts --segment pharma_healthcare [--apply]
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '../src/lib/server/watch/db';
import { accounts, newsItems } from '../src/lib/server/watch/db/schema';
import { invalidateTodaySummaries } from '../src/lib/server/watch/data/digest';
import { isOffTopic, mentionsAccount } from '../src/lib/server/watch/agents/relevance';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const segIdx = args.indexOf('--segment');
const segment = segIdx >= 0 ? args[segIdx + 1] : null;

async function main() {
	const rows = await db
		.select({
			id: newsItems.id,
			title: newsItems.title,
			summary: newsItems.summary,
			account: accounts.name,
			slug: accounts.slug,
			legalName: accounts.legalName,
			ticker: accounts.ticker,
			aliases: accounts.aliases,
			segment: accounts.segment
		})
		.from(newsItems)
		.innerJoin(accounts, eq(accounts.id, newsItems.accountId));

	const scoped = segment ? rows.filter((r) => r.segment === segment) : rows;
	const flagged = scoped
		.map((r) => ({
			row: r,
			reason: !mentionsAccount({ ...r, name: r.account }, r)
				? ('unrelated' as const)
				: isOffTopic(r, r)
					? ('off-topic' as const)
					: null
		}))
		.filter((f) => f.reason);

	const byAccount = new Map<string, { unrelated: number; offTopic: number }>();
	for (const f of flagged) {
		const e = byAccount.get(f.row.account) ?? { unrelated: 0, offTopic: 0 };
		if (f.reason === 'unrelated') e.unrelated++;
		else e.offTopic++;
		byAccount.set(f.row.account, e);
	}

	const unrelated = flagged.filter((f) => f.reason === 'unrelated').length;
	console.log(
		`Scanned ${scoped.length} article(s)${segment ? ` in ${segment}` : ''} — ${flagged.length} to remove ` +
			`(${unrelated} don't name the account, ${flagged.length - unrelated} off-topic).\n`
	);
	console.log('   removed  (unrelated / off-topic)  account');
	for (const [name, e] of [...byAccount].sort(
		(a, b) => b[1].unrelated + b[1].offTopic - (a[1].unrelated + a[1].offTopic)
	)) {
		const total = e.unrelated + e.offTopic;
		console.log(
			`  ${String(total).padStart(6)}  (${String(e.unrelated).padStart(4)} / ${String(e.offTopic).padStart(4)})      ${name}`
		);
	}
	console.log('\nExamples:');
	for (const f of flagged.slice(0, 15)) {
		console.log(`  [${f.row.account}] (${f.reason}) ${f.row.title}`);
	}

	if (!flagged.length) return;
	const offTopic = flagged.map((f) => f.row);
	if (!apply) {
		console.log('\nDry run — nothing deleted. Re-run with --apply to remove them.');
		return;
	}

	// Chunked: the id list can run into thousands.
	const ids = offTopic.map((r) => r.id);
	let deleted = 0;
	for (let i = 0; i < ids.length; i += 500) {
		const chunk = ids.slice(i, i + 500);
		await db.delete(newsItems).where(inArray(newsItems.id, chunk));
		deleted += chunk.length;
	}
	// Cached digests were written over the old, noisy news — drop them so they rebuild.
	await invalidateTodaySummaries();
	console.log(`\nDeleted ${deleted} article(s); today's cached digests dropped.`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Prune failed:', err);
		process.exit(1);
	});
