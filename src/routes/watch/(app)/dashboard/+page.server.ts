import { getDashboardCounts, getDashboardDigest } from '$lib/server/watch/data/digest';
import { getFeed } from '$lib/server/watch/data/news';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import type { PageServerLoad } from './$types';

const STATIC_SUGGESTIONS = [
	'What are the biggest risks across the portfolio right now?',
	'Which accounts have regulatory or compliance news this week?',
	'Any upsell opportunities I should flag?',
	'Summarise what changed across all sectors recently.'
];

export const load: PageServerLoad = async ({ locals }) => {
	const user = effectiveUser(locals);

	// Admin dashboard = AI assistant. (When an admin is "viewing as" a member,
	// effectiveUser is that member → they see the member magazine, as intended.)
	if (user.role === 'admin') {
		const [counts, recent] = await Promise.all([
			getDashboardCounts(user),
			getFeed(user, { limit: 8, sinceDays: 14 })
		]);
		const dynamic: string[] = [];
		const seen = new Set<string>();
		for (const a of recent) {
			if (dynamic.length >= 2) break;
			if (!seen.has(a.account.name)) {
				seen.add(a.account.name);
				dynamic.push(`What's the latest on ${a.account.name}?`);
			}
		}
		return {
			mode: 'ai' as const,
			kb: {
				accounts: counts.totalCustomers,
				articles: counts.totalNews,
				sources: counts.sourcesMonitored
			},
			suggestions: [...dynamic, ...STATIC_SUGGESTIONS].slice(0, 6)
		};
	}

	// Member dashboard = news magazine.
	const [counts, news] = await Promise.all([
		getDashboardCounts(user),
		getFeed(user, { limit: 13, sinceDays: 45 })
	]);
	return { mode: 'magazine' as const, counts, news, digest: getDashboardDigest(user) };
};
