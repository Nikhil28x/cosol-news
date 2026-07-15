import { getFeed } from '$lib/server/watch/data/news';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const segment = url.searchParams.get('segment') ?? undefined;
	const signalType = url.searchParams.get('signal') ?? undefined;
	const sentiment = url.searchParams.get('sentiment') ?? undefined;
	const priorityOnly = url.searchParams.get('priority') === '1';

	const items = await getFeed(effectiveUser(locals), {
		segment,
		signalType,
		sentiment,
		priorityOnly,
		limit: 80
	});

	return { items, filters: { segment, signalType, sentiment, priorityOnly } };
};
