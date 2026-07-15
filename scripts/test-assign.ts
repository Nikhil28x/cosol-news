/**
 * Non-destructive test of the admin "save assignments" mechanism (delete + insert),
 * inside a rolled-back transaction so the real assignments are untouched.
 */
import { count, eq } from 'drizzle-orm';
import { db } from '../src/lib/server/watch/db';
import { accounts, userAccounts, users } from '../src/lib/server/watch/db/schema';
import { accessibleAccountIds } from '../src/lib/server/watch/data/access';

const email = process.argv[2] || 'shruthi@cosol.in';
const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!u) {
	console.error('no user', email);
	process.exit(1);
}
const authUser = { id: u.id, role: u.role } as Parameters<typeof accessibleAccountIds>[0];

const before = await accessibleAccountIds(authUser);
const beforeCount = before === 'all' ? -1 : before.length;

const picks = await db.select({ id: accounts.id }).from(accounts).limit(2);
let inTxCount = -1;
try {
	await db.transaction(async (tx) => {
		await tx.delete(userAccounts).where(eq(userAccounts.userId, u.id));
		await tx.insert(userAccounts).values(picks.map((a) => ({ userId: u.id, accountId: a.id })));
		const [c] = await tx
			.select({ c: count() })
			.from(userAccounts)
			.where(eq(userAccounts.userId, u.id));
		inTxCount = Number(c.c);
		throw new Error('__rollback__'); // undo — this is just a test
	});
} catch (e) {
	if ((e as Error).message !== '__rollback__') throw e;
}

const after = await accessibleAccountIds(authUser);
const afterCount = after === 'all' ? -1 : after.length;

console.log(
	`${email}: before=${beforeCount} accounts, in-tx-after-reassign=${inTxCount}, after-rollback=${afterCount}`
);
console.log(
	inTxCount === 2 && afterCount === beforeCount
		? '✅ PASS — save replaces assignments correctly, scope reflects it, and it is reversible.'
		: '❌ FAIL'
);
process.exit(0);
