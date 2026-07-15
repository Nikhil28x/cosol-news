/**
 * Verification: prove per-user isolation across the current data layer.
 *   npx tsx scripts/verify.ts
 */
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/server/watch/db';
import { users } from '../src/lib/server/watch/db/schema';
import { getDashboardCounts } from '../src/lib/server/watch/data/digest';
import { getFeed } from '../src/lib/server/watch/data/news';
import { listAccounts } from '../src/lib/server/watch/data/accounts';

async function forEmail(email: string) {
	const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	if (!u) return console.log(`(no user ${email})`);
	const user = {
		id: u.id,
		email: u.email,
		fullName: u.fullName,
		role: u.role,
		pod: u.pod,
		title: u.title,
		mustChangePassword: u.mustChangePassword
	};

	const accts = await listAccounts(user);
	const feed = await getFeed(user, { limit: 2000 });
	const counts = await getDashboardCounts(user);
	const distinct = [...new Set(feed.map((f) => f.account.name))];

	console.log(`\n════ ${email}  (${user.role}) ════`);
	console.log(
		'accounts visible :',
		accts.length,
		'→',
		accts
			.map((a) => a.name)
			.slice(0, 8)
			.join(', '),
		accts.length > 8 ? '…' : ''
	);
	console.log('feed items       :', feed.length, '| distinct accounts in feed:', distinct.length);
	console.log('counts           :', JSON.stringify(counts).slice(0, 200));
	console.log('segments         :', counts.segments.map((s) => `${s.label}:${s.count}`).join('  '));
}

await forEmail('admin@cosol.in');
await forEmail('ashwini@cosol.in');
await forEmail('ojas@cosol.in');
await forEmail('sowmya1@cosol.in');
process.exit(0);
