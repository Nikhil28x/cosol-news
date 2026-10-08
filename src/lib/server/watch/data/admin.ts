import { count, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
	accountActions,
	accountSignals,
	accounts,
	ingestionRuns,
	newsItems,
	userAccounts,
	users
} from '../db/schema';

export async function adminOverview() {
	const [u, a, n, r, s, f, b] = await Promise.all([
		db.select({ c: count() }).from(users),
		db.select({ c: count() }).from(accounts),
		db.select({ c: count() }).from(newsItems).where(eq(newsItems.businessRelevant, true)),
		db.select({ c: count() }).from(ingestionRuns),
		db.select({ c: count() }).from(accountSignals).where(eq(accountSignals.isActive, true)),
		db.select({ c: count() }).from(accountActions).where(eq(accountActions.kind, 'follow_up')),
		db.select({ c: count() }).from(accountActions).where(eq(accountActions.kind, 'rfb'))
	]);
	return {
		users: Number(u[0]?.c ?? 0),
		accounts: Number(a[0]?.c ?? 0),
		news: Number(n[0]?.c ?? 0),
		runs: Number(r[0]?.c ?? 0),
		signals: Number(s[0]?.c ?? 0),
		followUps: Number(f[0]?.c ?? 0),
		rfbs: Number(b[0]?.c ?? 0)
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
		.where(eq(newsItems.businessRelevant, true))
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
