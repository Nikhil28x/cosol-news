import { error, json } from '@sveltejs/kit';
import { refreshAll } from '$lib/server/watch/agents/refresh';
import type { RequestHandler } from './$types';

// Scheduled ingestion. Authenticate via a request HEADER (never a query string —
// query strings leak into access logs, referrers and proxies):
//   Authorization: Bearer <CRON_SECRET>   (Vercel Cron sends this automatically)
//   x-cron-secret: <CRON_SECRET>
function authorized(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	if (request.headers.get('authorization') === `Bearer ${secret}`) return true;
	if (request.headers.get('x-cron-secret') === secret) return true;
	return false;
}

// Serverless functions cap execution time. On Vercel Pro this allows a full daily
// sweep; on Hobby (10s) run in batches via ?limit=N and schedule the cron more often.
export const config = { maxDuration: 300 };

const handler: RequestHandler = async ({ request, url }) => {
	if (!authorized(request)) error(401, 'Unauthorized');
	const limitParam = Number(url.searchParams.get('limit'));
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;

	const r = await refreshAll({ concurrency: 2, limit });
	return json({
		ok: true,
		accounts: r.accounts,
		newItems: r.newItems,
		digests: r.digests,
		errors: r.errors
	});
};

export const GET = handler;
export const POST = handler;
