import { getDashboardCounts, getDashboardDigest } from '$lib/server/watch/data/digest';
import { getFeed } from '$lib/server/watch/data/news';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = effectiveUser(locals);
	// Counts + the news tiles render immediately; the Gemini briefing streams in.
	const [counts, news] = await Promise.all([
		getDashboardCounts(user),
		getFeed(user, { limit: 13, sinceDays: 45 })
	]);
	return { counts, news, digest: getDashboardDigest(user) };
};
