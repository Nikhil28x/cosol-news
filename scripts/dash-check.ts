/** Confirms the dashboard loader data path (counts + news tiles + imageUrl). */
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/server/watch/db';
import { users } from '../src/lib/server/watch/db/schema';
import { getDashboardCounts } from '../src/lib/server/watch/data/digest';
import { getFeed } from '../src/lib/server/watch/data/news';

const email = process.argv[2] || 'ashwini@cosol.in';
const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!u) {
	console.error('no user', email);
	process.exit(1);
}
const user = { id: u.id, role: u.role } as Parameters<typeof getDashboardCounts>[0];

const counts = await getDashboardCounts(user);
const news = await getFeed(user, { limit: 13, sinceDays: 45 });

console.log(`${email}:`);
console.log(
	`  counts → ${counts.totalCustomers} customers · ${counts.newsToday} today · ${counts.totalNews} total · ${counts.sourcesMonitored} sources`
);
console.log(`  news tiles → ${news.length}`);
for (const n of news.slice(0, 4)) {
	console.log(
		`   • [${n.account.name}] ${n.title.slice(0, 58)}  (img: ${n.imageUrl ? 'real' : 'fallback'})`
	);
}
process.exit(0);
