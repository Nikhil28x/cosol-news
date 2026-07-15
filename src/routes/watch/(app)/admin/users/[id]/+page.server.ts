import { error, fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/watch/db';
import { accounts, newsSummaries, userAccounts, users } from '$lib/server/watch/db/schema';
import { generateTempPassword, hashPassword } from '$lib/server/watch/auth/password';
import { invalidateUserSessions } from '$lib/server/watch/auth/session';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user || locals.user.role !== 'admin') error(403, 'Admins only.');
}

// Their scope changed → drop cached dashboard digests so they rebuild for the new set.
async function invalidateUserDigests(userId: string) {
	await db
		.delete(newsSummaries)
		.where(and(eq(newsSummaries.kind, 'dashboard'), eq(newsSummaries.scopeKey, userId)));
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requireAdmin(locals);
	const [u] = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
	if (!u) error(404, 'User not found.');

	const allAccounts = await db
		.select({
			id: accounts.id,
			name: accounts.name,
			slug: accounts.slug,
			segment: accounts.segment,
			pod: accounts.pod
		})
		.from(accounts)
		.where(eq(accounts.isActive, true))
		.orderBy(asc(accounts.name));

	const assignedRows = await db
		.select({ accountId: userAccounts.accountId })
		.from(userAccounts)
		.where(eq(userAccounts.userId, u.id));

	return {
		u: {
			id: u.id,
			email: u.email,
			fullName: u.fullName,
			role: u.role,
			pod: u.pod,
			isActive: u.isActive,
			mustChangePassword: u.mustChangePassword
		},
		accounts: allAccounts,
		assigned: assignedRows.map((r) => r.accountId)
	};
};

export const actions: Actions = {
	// Replace this user's account assignments with the exact checked set.
	save: async ({ locals, request, params }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const ids = form.getAll('account').map(String).filter(Boolean);

		await db.delete(userAccounts).where(eq(userAccounts.userId, params.id));
		if (ids.length) {
			await db
				.insert(userAccounts)
				.values(ids.map((accountId) => ({ userId: params.id, accountId })))
				.onConflictDoNothing();
		}
		await invalidateUserDigests(params.id);
		return { saved: ids.length };
	},

	toggleActive: async ({ locals, params }) => {
		requireAdmin(locals);
		if (params.id === locals.user!.id)
			return fail(400, { error: "You can't deactivate yourself." });
		const [u] = await db
			.select({ isActive: users.isActive })
			.from(users)
			.where(eq(users.id, params.id))
			.limit(1);
		if (!u) return fail(400, { error: 'User not found.' });
		const next = !u.isActive;
		await db
			.update(users)
			.set({ isActive: next, updatedAt: new Date() })
			.where(eq(users.id, params.id));
		if (!next) await invalidateUserSessions(params.id);
		return { toggledActive: next };
	},

	resetPassword: async ({ locals, params }) => {
		requireAdmin(locals);
		const [u] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, params.id))
			.limit(1);
		if (!u) return fail(400, { error: 'User not found.' });
		const tempPassword = generateTempPassword();
		await db
			.update(users)
			.set({
				passwordHash: await hashPassword(tempPassword),
				mustChangePassword: true,
				updatedAt: new Date()
			})
			.where(eq(users.id, params.id));
		await invalidateUserSessions(params.id);
		return { reset: { email: u.email, tempPassword } };
	}
};
