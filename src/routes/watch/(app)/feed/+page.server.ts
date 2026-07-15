import { eq } from 'drizzle-orm';
import { getFeed } from '$lib/server/watch/data/news';
import { listAccounts } from '$lib/server/watch/data/accounts';
import { resolveUserAccountIds } from '$lib/server/watch/data/knowledge';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import { SEGMENTS } from '$lib/watch/segments';
import { db } from '$lib/server/watch/db';
import { users } from '$lib/server/watch/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer = effectiveUser(locals);
	const isAdmin = viewer.role === 'admin';

	const segment = url.searchParams.get('segment') ?? undefined;
	const signalType = url.searchParams.get('signal') ?? undefined;
	const sentiment = url.searchParams.get('sentiment') ?? undefined;
	const priorityOnly = url.searchParams.get('priority') === '1';

	// Admin can view any user's news by picking them from a dropdown (read-only
	// visibility — it just scopes the feed to that user's accounts).
	let asUserId = isAdmin ? url.searchParams.get('user') || '' : '';
	let asUserName: string | null = null;
	let accountIds: string[] | undefined;
	if (isAdmin && asUserId) {
		const [u] = await db
			.select({ id: users.id, name: users.fullName })
			.from(users)
			.where(eq(users.id, asUserId))
			.limit(1);
		if (u) {
			asUserName = u.name;
			accountIds = await resolveUserAccountIds(u.id);
		} else {
			asUserId = '';
		}
	}

	const items = await getFeed(viewer, {
		segment,
		signalType,
		sentiment,
		priorityOnly,
		accountIds,
		limit: 80
	});

	const userList = isAdmin
		? await db
				.select({ id: users.id, name: users.fullName, pod: users.pod })
				.from(users)
				.where(eq(users.isActive, true))
				.orderBy(users.fullName)
		: [];

	// Industry filter options = segments present in the (scoped) portfolio.
	const scopeAccounts = await listAccounts(viewer);
	const present = new Set(scopeAccounts.map((a) => a.segment ?? 'other'));
	const segments = SEGMENTS.filter((s) => present.has(s.key)).map((s) => ({
		key: s.key,
		label: s.label
	}));

	return {
		items,
		filters: { segment, signalType, sentiment, priorityOnly },
		isAdmin,
		users: userList,
		asUserId,
		asUserName,
		segments
	};
};
