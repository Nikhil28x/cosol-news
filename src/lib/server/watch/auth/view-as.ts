import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '$lib/watch/types';
import { db } from '../db';
import { users } from '../db/schema';

/**
 * Admin "view as" impersonation. An admin can view any user's exact scoped view.
 * The target user id lives in a cookie but is ONLY honoured when the real session
 * user is an admin (enforced in hooks.server.ts), so members can't forge it.
 */
export const VIEW_AS_COOKIE = 'watch_view_as';

export function setViewAs(cookies: Cookies, userId: string) {
	cookies.set(VIEW_AS_COOKIE, userId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 8
	});
}

export function clearViewAs(cookies: Cookies) {
	cookies.delete(VIEW_AS_COOKIE, { path: '/' });
}

export async function resolveViewAs(userId: string): Promise<AuthUser | null> {
	const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!u || !u.isActive) return null;
	return {
		id: u.id,
		email: u.email,
		fullName: u.fullName,
		role: u.role,
		pod: u.pod,
		title: u.title,
		mustChangePassword: u.mustChangePassword
	};
}

/** The user whose data is shown: an admin's impersonation target, else the real user. */
export function effectiveUser(locals: App.Locals): AuthUser {
	return (locals.viewAs ?? locals.user)!;
}
