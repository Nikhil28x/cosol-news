import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	setSessionCookie,
	validateSessionToken
} from '$lib/server/watch/auth/session';
import { VIEW_AS_COOKIE, resolveViewAs } from '$lib/server/watch/auth/view-as';

/**
 * Resolves the Customer Watch session + optional admin "view as" on every request
 * (a cheap no-op for marketing-site traffic with no session cookie). Route guards
 * live in the /watch (app) layout; this only populates event.locals.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;
	event.locals.viewAs = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (!token) return resolve(event);

	const { user, session } = await validateSessionToken(token);
	if (!session) {
		deleteSessionCookie(event.cookies);
		return resolve(event);
	}

	setSessionCookie(event.cookies, token, session.expiresAt); // sliding expiry
	event.locals.user = user;
	event.locals.session = session;

	// Admin impersonation: only honoured when the real user is an admin.
	if (user && user.role === 'admin') {
		const target = event.cookies.get(VIEW_AS_COOKIE);
		if (target && target !== user.id) {
			const viewAs = await resolveViewAs(target);
			if (viewAs) event.locals.viewAs = viewAs;
			else event.cookies.delete(VIEW_AS_COOKIE, { path: '/' });
		}
	}

	return resolve(event);
};
