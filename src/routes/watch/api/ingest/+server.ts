import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/watch/db';
import { accounts } from '$lib/server/watch/db/schema';
import { ingestAccount, ingestAllAccounts } from '$lib/server/watch/agents/orchestrator';
import type { RequestHandler } from './$types';

// Admin-only manual trigger. POST /watch/api/ingest        → ingest all accounts
//                            POST /watch/api/ingest?accountId=… → one account
export const POST: RequestHandler = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') error(403, 'Admins only');

	const accountId = url.searchParams.get('accountId');
	if (accountId) {
		const [acc] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
		if (!acc) error(404, 'Account not found');
		return json(await ingestAccount(acc));
	}

	const results = await ingestAllAccounts({ concurrency: 3 });
	return json({
		accounts: results.length,
		newItems: results.reduce((n, r) => n + r.fresh, 0),
		errors: results.filter((r) => r.status === 'error').length,
		results
	});
};
