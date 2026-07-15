/**
 * Daily refresh (CLI): fetch RSS for every active account (NO per-item AI), then
 * rebuild the Gemini dashboard digests.
 *   npx tsx scripts/ingest.ts
 * Requires network (run outside the sandbox).
 */
import { refreshAll } from '../src/lib/server/watch/agents/refresh';

async function main() {
	console.log('Refreshing news: RSS fetch (no per-item AI) + Gemini digests…\n');
	const r = await refreshAll({ concurrency: 3 });
	console.log(
		`\nAccounts: ${r.accounts} · new items: ${r.newItems} · errors: ${r.errors} · dashboards built: ${r.digests}`
	);
	process.exit(0);
}

main().catch((err) => {
	console.error('Refresh failed:', err);
	process.exit(1);
});
