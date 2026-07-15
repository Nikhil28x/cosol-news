/**
 * Discover which Supabase pooler region hosts this project (IPv4 path).
 * Run: npx tsx scripts/find-pooler.ts
 * The direct db.<ref>.supabase.co host is IPv6-only; the Supavisor pooler is
 * IPv4-reachable. We try each region: the correct one authenticates (or gives a
 * password error); wrong regions answer "Tenant or user not found".
 */
import postgres from 'postgres';

const REF = 'xkfsyyiuambybfocqwvw';
const PASSWORD = 'Lucario$2812';
const REGIONS = [
	'ap-southeast-2', // Sydney
	'ap-southeast-1', // Singapore
	'ap-south-1', // Mumbai
	'us-east-1',
	'us-east-2',
	'us-west-1',
	'us-west-2',
	'eu-central-1',
	'eu-central-2',
	'eu-west-1',
	'eu-west-2',
	'eu-west-3',
	'ap-northeast-1',
	'ap-northeast-2',
	'ca-central-1',
	'sa-east-1'
];

async function probe(region: string) {
	const host = `aws-0-${region}.pooler.supabase.com`;
	const sql = postgres({
		host,
		port: 6543,
		username: `postgres.${REF}`,
		password: PASSWORD,
		database: 'postgres',
		ssl: 'require',
		prepare: false,
		connect_timeout: 10,
		max: 1,
		idle_timeout: 1
	});
	try {
		await sql`select 1`;
		return { region, host, status: 'CONNECTED ✅' };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (/password|authentication/i.test(msg))
			return { region, host, status: `RIGHT REGION (auth: ${msg})` };
		if (/tenant or user not found/i.test(msg)) return { region, host, status: 'wrong region' };
		return { region, host, status: `err: ${msg}` };
	} finally {
		await sql.end({ timeout: 2 }).catch(() => {});
	}
}

const results = await Promise.all(REGIONS.map(probe));
for (const r of results) {
	if (r.status === 'wrong region') continue;
	console.log(`${r.region.padEnd(16)} ${r.host.padEnd(42)} ${r.status}`);
}
const hit = results.find(
	(r) => r.status.includes('CONNECTED') || r.status.includes('RIGHT REGION')
);
console.log(
	'\n' +
		(hit
			? `>>> Region: ${hit.region}  Host: ${hit.host}`
			: '>>> No region matched — check password/ref')
);
process.exit(0);
