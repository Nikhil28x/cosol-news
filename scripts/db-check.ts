/**
 * Connectivity smoke test for the Customer Watch database.
 * Run: npx tsx scripts/db-check.ts
 *
 * Confirms the Supabase URL + SSL + URL-encoded password all parse and connect,
 * and lists any existing tables so we never clobber pre-existing data.
 */
import postgres from 'postgres';

try {
	process.loadEnvFile();
} catch {
	// no .env file (e.g. CI/prod) — rely on the real environment
}

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set');
	process.exit(1);
}

const sql = postgres(url, { prepare: false, ssl: 'require', connect_timeout: 15 });

try {
	const [{ version }] = await sql`select version()`;
	console.log('Connected OK →', version.split(',')[0]);

	const tables = await sql<{ table_name: string }[]>`
		select table_name from information_schema.tables
		where table_schema = 'public'
		order by table_name
	`;
	console.log(`\nExisting public tables (${tables.length}):`);
	if (tables.length === 0) console.log('  (none — clean database)');
	for (const t of tables) console.log('  -', t.table_name);
} catch (err) {
	console.error('Connection FAILED:', err instanceof Error ? err.message : err);
	process.exitCode = 1;
} finally {
	await sql.end();
}
