import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { sessions, users } from '../db/schema';
import type { AuthUser } from '$lib/watch/types';
import { randomToken, sha256hex } from './crypto';

export const SESSION_COOKIE = 'watch_session';
const DAY_MS = 1000 * 60 * 60 * 24;
export const SESSION_TTL_MS = 30 * DAY_MS;
const RENEW_WITHIN_MS = 15 * DAY_MS; // slide expiry when < 15 days remain

export function generateSessionToken(): string {
	return randomToken();
}

export async function createSession(token: string, userId: string) {
	const id = sha256hex(token);
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	await db.insert(sessions).values({ id, userId, expiresAt });
	return { id, userId, expiresAt };
}

export interface SessionValidation {
	user: AuthUser | null;
	session: { id: string; expiresAt: Date } | null;
}

export async function validateSessionToken(token: string): Promise<SessionValidation> {
	const id = sha256hex(token);
	const rows = await db
		.select({
			sessionId: sessions.id,
			expiresAt: sessions.expiresAt,
			id: users.id,
			email: users.email,
			fullName: users.fullName,
			role: users.role,
			pod: users.pod,
			title: users.title,
			mustChangePassword: users.mustChangePassword,
			isActive: users.isActive
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.limit(1);

	const row = rows[0];
	if (!row) return { user: null, session: null };

	// Expired, or the user was deactivated → kill the session.
	if (Date.now() >= row.expiresAt.getTime() || !row.isActive) {
		await db.delete(sessions).where(eq(sessions.id, id));
		return { user: null, session: null };
	}

	let expiresAt = row.expiresAt;
	if (row.expiresAt.getTime() - Date.now() < RENEW_WITHIN_MS) {
		expiresAt = new Date(Date.now() + SESSION_TTL_MS);
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
	}

	const user: AuthUser = {
		id: row.id,
		email: row.email,
		fullName: row.fullName,
		role: row.role,
		pod: row.pod,
		title: row.title,
		mustChangePassword: row.mustChangePassword
	};
	return { user, session: { id: row.sessionId, expiresAt } };
}

export async function invalidateSession(sessionId: string) {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateUserSessions(userId: string) {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
