import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AccountSummary, AuthUser } from '$lib/watch/types';
import { db } from '../db';
import { accounts } from '../db/schema';
import type { Account } from '../db/schema';
import { accessibleAccountIds } from './access';

function toSummary(a: Account): AccountSummary {
	return {
		id: a.id,
		name: a.name,
		slug: a.slug,
		segment: a.segment,
		industry: a.industry,
		ticker: a.ticker,
		exchange: a.exchange,
		logoUrl: a.logoUrl,
		country: a.country,
		pod: a.pod,
		description: a.description,
		website: a.website
	};
}

export async function listAccounts(
	user: AuthUser,
	opts: { segment?: string } = {}
): Promise<AccountSummary[]> {
	const ids = await accessibleAccountIds(user);
	if (ids !== 'all' && ids.length === 0) return [];

	const conds = [eq(accounts.isActive, true)];
	if (ids !== 'all') conds.push(inArray(accounts.id, ids));
	if (opts.segment) conds.push(eq(accounts.segment, opts.segment));

	const rows = await db
		.select()
		.from(accounts)
		.where(and(...conds))
		.orderBy(asc(accounts.name));
	return rows.map(toSummary);
}

export async function getAccountBySlugForUser(
	user: AuthUser,
	slug: string
): Promise<AccountSummary | null> {
	const [row] = await db.select().from(accounts).where(eq(accounts.slug, slug)).limit(1);
	if (!row) return null;
	const ids = await accessibleAccountIds(user);
	if (ids !== 'all' && !ids.includes(row.id)) return null;
	return toSummary(row);
}
