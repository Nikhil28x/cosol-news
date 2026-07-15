/** Quick check: generate + print a dashboard digest for one user. */
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/server/watch/db';
import { users } from '../src/lib/server/watch/db/schema';
import { getDashboardDigest } from '../src/lib/server/watch/data/digest';

const email = process.argv[2] || 'ashwini@cosol.in';
const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!u) {
	console.error('no user', email);
	process.exit(1);
}
const user = {
	id: u.id,
	email: u.email,
	fullName: u.fullName,
	role: u.role,
	pod: u.pod,
	title: u.title,
	mustChangePassword: u.mustChangePassword
};
console.log(`Generating dashboard digest for ${email}…\n`);
const d = await getDashboardDigest(user, { regenerate: true });
if (!d) {
	console.log('No digest (no news or LLM failed).');
	process.exit(0);
}
console.log('PORTFOLIO:', d.portfolioSentiment.toUpperCase());
console.log(d.portfolioSummary, '\n');
for (const s of d.sectors) {
	console.log(
		`\n── ${s.label}  [${s.sentiment}]  (${s.accountCount} accounts, ${s.itemCount} articles)`
	);
	console.log('   ' + s.summary);
	for (const g of s.signals) console.log(`   • (${g.kind}) ${g.account}: ${g.headline}`);
}
console.log(`\nmodel=${d.model} items=${d.itemCount}`);
process.exit(0);
