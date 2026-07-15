import { redirect } from '@sveltejs/kit';
import { listAccounts } from '$lib/server/watch/data/accounts';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, `/watch?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}
	const view = effectiveUser(locals);
	const accounts = await listAccounts(view);
	return {
		user: view, // whose data is shown (impersonation target or self)
		realUser: locals.user, // the actually-authenticated user
		viewingAs: locals.viewAs, // non-null while an admin is impersonating
		accounts
	};
};
