import { eq } from 'drizzle-orm';
import type { AuthUser } from '$lib/watch/types';
import { db } from '../db';
import { userAccounts } from '../db/schema';

/**
 * The set of account ids a user may see. Admins get the sentinel 'all' (no filter);
 * members get exactly the ids assigned in user_accounts. This is the single source
 * of truth for isolation — every data query funnels through it.
 */
export async function accessibleAccountIds(user: AuthUser): Promise<string[] | 'all'> {
	if (user.role === 'admin') return 'all';
	const rows = await db
		.select({ id: userAccounts.accountId })
		.from(userAccounts)
		.where(eq(userAccounts.userId, user.id));
	return rows.map((r) => r.id);
}

export function hasAccess(ids: string[] | 'all', accountId: string): boolean {
	return ids === 'all' || ids.includes(accountId);
}
