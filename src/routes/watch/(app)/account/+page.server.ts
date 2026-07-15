import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/watch/db';
import { users } from '$lib/server/watch/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/watch/auth/password';
import {
	createSession,
	generateSessionToken,
	invalidateUserSessions,
	setSessionCookie
} from '$lib/server/watch/auth/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({ me: locals.user! });

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (next.length < 8) return fail(400, { error: 'New password must be at least 8 characters.' });
		if (next !== confirm) return fail(400, { error: 'The new passwords do not match.' });

		const [u] = await db.select().from(users).where(eq(users.id, locals.user!.id)).limit(1);
		if (!u || !(await verifyPassword(current, u.passwordHash))) {
			return fail(400, { error: 'Your current password is incorrect.' });
		}

		await db
			.update(users)
			.set({
				passwordHash: await hashPassword(next),
				mustChangePassword: false,
				updatedAt: new Date()
			})
			.where(eq(users.id, u.id));

		// Rotate every session, then re-issue one for this browser.
		await invalidateUserSessions(u.id);
		const token = generateSessionToken();
		const session = await createSession(token, u.id);
		setSessionCookie(cookies, token, session.expiresAt);

		return { success: true };
	}
};
