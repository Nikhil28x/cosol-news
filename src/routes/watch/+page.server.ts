import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/watch/db';
import { users } from '$lib/server/watch/db/schema';
import { verifyPassword } from '$lib/server/watch/auth/password';
import {
	createSession,
	generateSessionToken,
	setSessionCookie
} from '$lib/server/watch/auth/session';
import type { Actions, PageServerLoad } from './$types';

// A real bcrypt hash of a random string. We compare against it when no (active) user
// matches, so the action spends ~the same bcrypt time regardless of whether the email
// exists — closing the timing side-channel that would otherwise enumerate accounts.
const DUMMY_HASH = '$2b$12$14wuI7TLICiK2VeC6X0xeOSQApMF5BfuvA/DuoEH62ZiRt/RmDqBq';

function safeRedirect(target: string | null): string {
	if (target && target.startsWith('/watch') && !target.startsWith('//')) return target;
	return '/watch/dashboard';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirect')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { error: 'Enter your email and password.', email });
		}

		const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
		// Always run bcrypt (against a dummy hash when there's no user) for constant work.
		const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

		if (!user || !user.isActive || !passwordOk) {
			return fail(400, { error: 'Invalid email or password.', email });
		}

		const token = generateSessionToken();
		const session = await createSession(token, user.id);
		setSessionCookie(cookies, token, session.expiresAt);
		await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

		redirect(303, safeRedirect(url.searchParams.get('redirect')));
	}
};
