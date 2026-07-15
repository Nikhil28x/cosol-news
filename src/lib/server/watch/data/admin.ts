import { count, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { accounts, ingestionRuns, newsItems, userAccounts, users } from '../db/schema';

export async function adminOverview() {
	const [u, a, n, r] = await Promise.all([
		db.select({ c: count() }).from(users),
		db.select({ c: count() }).from(accounts),
		db.select({ c: count() }).from(newsItems),
		db.select({ c: count() }).from(ingestionRuns)
	]);
	return {
		users: Number(u[0]?.c ?? 0),
		accounts: Number(a[0]?.c ?? 0),
		news: Number(n[0]?.c ?? 0),
		runs: Number(r[0]?.c ?? 0)
	};
}

export async function listUsersAdmin() {
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			fullName: users.fullName,
			role: users.role,
			pod: users.pod,
			isActive: users.isActive,
			mustChangePassword: users.mustChangePassword,
			lastLoginAt: users.lastLoginAt
		})
		.from(users)
		.orderBy(users.fullName);

	const counts = await db
		.select({ userId: userAccounts.userId, c: count() })
		.from(userAccounts)
		.groupBy(userAccounts.userId);
	const map = new Map(counts.map((c) => [c.userId, Number(c.c)]));

	return rows.map((r) => ({ ...r, accountCount: map.get(r.id) ?? 0 }));
}

export async function listAccountsAdmin() {
	const rows = await db
		.select({
			id: accounts.id,
			name: accounts.name,
			slug: accounts.slug,
			segment: accounts.segment,
			pod: accounts.pod,
			isActive: accounts.isActive
		})
		.from(accounts)
		.orderBy(accounts.name);

	const counts = await db
		.select({ accountId: newsItems.accountId, c: count() })
		.from(newsItems)
		.groupBy(newsItems.accountId);
	const map = new Map(counts.map((c) => [c.accountId, Number(c.c)]));

	return rows.map((r) => ({ ...r, newsCount: map.get(r.id) ?? 0 }));
}

export async function recentRuns(limit = 12) {
	return db
		.select({
			id: ingestionRuns.id,
			accountName: accounts.name,
			source: ingestionRuns.source,
			status: ingestionRuns.status,
			itemsFound: ingestionRuns.itemsFound,
			itemsNew: ingestionRuns.itemsNew,
			itemsEnriched: ingestionRuns.itemsEnriched,
			error: ingestionRuns.error,
			startedAt: ingestionRuns.startedAt,
			finishedAt: ingestionRuns.finishedAt
		})
		.from(ingestionRuns)
		.leftJoin(accounts, eq(ingestionRuns.accountId, accounts.id))
		.orderBy(desc(ingestionRuns.startedAt))
		.limit(limit);
}
