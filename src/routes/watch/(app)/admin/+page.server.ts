import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/watch/db';
import { accounts, userAccounts, users } from '$lib/server/watch/db/schema';
import { generateTempPassword, hashPassword } from '$lib/server/watch/auth/password';
import { invalidateUserSessions } from '$lib/server/watch/auth/session';
import {
	adminOverview,
	listAccountsAdmin,
	listUsersAdmin,
	recentRuns
} from '$lib/server/watch/data/admin';
import { ingestAccount } from '$lib/server/watch/agents/orchestrator';
import { refreshAll } from '$lib/server/watch/agents/refresh';
import { getAccountDigest } from '$lib/server/watch/data/digest';
import type { Actions, PageServerLoad } from './$types';

function requireAdmin(locals: App.Locals) {
	if (!locals.user || locals.user.role !== 'admin') error(403, 'Admins only.');
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const [overview, usersList, accountsList, runs] = await Promise.all([
		adminOverview(),
		listUsersAdmin(),
		listAccountsAdmin(),
		recentRuns(15)
	]);
	return { overview, users: usersList, accounts: accountsList, runs, meId: locals.user!.id };
};

export const actions: Actions = {
	ingestAll: async ({ locals }) => {
		requireAdmin(locals);
		const r = await refreshAll({ concurrency: 3 });
		return { ran: { scope: 'all', accounts: r.accounts, news: r.newItems, errors: r.errors } };
	},

	ingestOne: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const accountId = String(form.get('accountId') ?? '');
		const [acc] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
		if (!acc) return fail(400, { error: 'Account not found.' });
		const res = await ingestAccount(acc, { enrich: false }); // RSS only; digest holds the AI
		await getAccountDigest(acc, { regenerate: true }).catch(() => null);
		return {
			ran: { scope: acc.name, accounts: 1, news: res.fresh, errors: res.status === 'error' ? 1 : 0 }
		};
	},

	createUser: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const fullName = String(form.get('fullName') ?? '').trim();
		const pod = String(form.get('pod') ?? '').trim() || null;
		const role = String(form.get('role') ?? 'member') === 'admin' ? 'admin' : 'member';

		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !fullName) {
			return fail(400, { error: 'Valid email and name are required.' });
		}
		const [existing] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		if (existing) return fail(400, { error: 'A user with that email already exists.' });

		const tempPassword = generateTempPassword();
		const [created] = await db
			.insert(users)
			.values({ email, fullName, pod, role, passwordHash: await hashPassword(tempPassword) })
			.returning({ id: users.id });

		// Auto-assign every account in the same POD.
		let assigned = 0;
		if (pod) {
			const podAccounts = await db
				.select({ id: accounts.id })
				.from(accounts)
				.where(eq(accounts.pod, pod));
			if (podAccounts.length) {
				await db
					.insert(userAccounts)
					.values(podAccounts.map((a) => ({ userId: created.id, accountId: a.id })))
					.onConflictDoNothing();
				assigned = podAccounts.length;
			}
		}
		return { created: { email, tempPassword, assigned } };
	},

	resetPassword: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const [u] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, userId))
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
			.where(eq(users.id, userId));
		await invalidateUserSessions(userId);
		return { reset: { email: u.email, tempPassword } };
	},

	toggleUser: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		if (userId === locals.user!.id) return fail(400, { error: "You can't deactivate yourself." });
		const [u] = await db
			.select({ isActive: users.isActive })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);
		if (!u) return fail(400, { error: 'User not found.' });
		const next = !u.isActive;
		await db
			.update(users)
			.set({ isActive: next, updatedAt: new Date() })
			.where(eq(users.id, userId));
		if (!next) await invalidateUserSessions(userId);
		return { toggled: { userId, active: next } };
	}
};
