import { getGeneralNews } from '$lib/server/watch/data/general';
import type { PageServerLoad } from './$types';

// General AI/tech news — the same for every user (not account-scoped).
export const load: PageServerLoad = async () => {
	return { news: await getGeneralNews(25) };
};
