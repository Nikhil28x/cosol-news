import { error } from '@sveltejs/kit';
import { getAccountBySlugForUser } from '$lib/server/watch/data/accounts';
import { getFeed } from '$lib/server/watch/data/news';
import { getAccountDigest } from '$lib/server/watch/data/digest';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const view = effectiveUser(locals);
	const account = await getAccountBySlugForUser(view, params.slug);
	if (!account) error(404, 'Account not found or not in your portfolio.');

	const items = await getFeed(view, { accountId: account.id, limit: 100 });
	// Digest streams in (Gemini); the raw feed renders immediately.
	return {
		account,
		items,
		digest: getAccountDigest({ id: account.id, name: account.name, segment: account.segment })
	};
};
