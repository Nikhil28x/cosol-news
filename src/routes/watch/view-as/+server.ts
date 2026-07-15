import { error, redirect } from '@sveltejs/kit';
import { clearViewAs, setViewAs } from '$lib/server/watch/auth/view-as';
import type { RequestHandler } from './$types';

// Admin-only: set/clear the "view as" target. POST userId to impersonate, or POST
// with no userId (or your own id) to exit back to your admin view.
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.user || locals.user.role !== 'admin') error(403, 'Admins only');
	const form = await request.formData();
	const userId = String(form.get('userId') ?? '');
	if (userId && userId !== locals.user.id) setViewAs(cookies, userId);
	else clearViewAs(cookies);
	redirect(303, '/watch/dashboard');
};
