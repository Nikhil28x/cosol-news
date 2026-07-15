import { listAccounts } from '$lib/server/watch/data/accounts';
import { getDashboardDigest } from '$lib/server/watch/data/digest';
import { getFeed } from '$lib/server/watch/data/news';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = effectiveUser(locals);
	const segment = url.searchParams.get('segment') ?? undefined;
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

	let accounts = await listAccounts(user, { segment });
	if (q) {
		accounts = accounts.filter(
			(a) =>
				a.name.toLowerCase().includes(q) ||
				(a.industry ?? '').toLowerCase().includes(q) ||
				(a.ticker ?? '').toLowerCase().includes(q)
		);
	}

	// When viewing a single industry, surface its AI summary (from the cached daily
	// digest — streamed) plus a few recent stories for that sector.
	let sector: ReturnType<typeof sectorDigest> | null = null;
	let sectorNews: Awaited<ReturnType<typeof getFeed>> = [];
	if (segment) {
		sectorNews = await getFeed(user, { segment, limit: 6, sinceDays: 45 });
		sector = sectorDigest(segment);
	}

	function sectorDigest(seg: string) {
		return getDashboardDigest(user).then((d) => d?.sectors.find((s) => s.key === seg) ?? null);
	}

	return { accounts, segment, q, sector, sectorNews };
};
