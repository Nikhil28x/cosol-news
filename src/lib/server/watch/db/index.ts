/**
 * Drizzle client for the Customer Watch database (Supabase Postgres via pooler).
 *
 * Server-only: lives under $lib/server so SvelteKit forbids importing it into the
 * browser bundle. Reads DATABASE_URL from the environment; loads .env in dev/CLI.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

try {
	process.loadEnvFile();
} catch {
	// no .env (e.g. Vercel) — use the real environment
}

const url = process.env.DATABASE_URL;
if (!url) {
	throw new Error('DATABASE_URL is not set — see .env.example');
}

// prepare:false is required for Supabase transaction-pooler (6543) and harmless on
// session mode (5432). ssl:'require' matches Supabase. Small pool for dev/serverless.
const client = postgres(url, {
	prepare: false,
	ssl: 'require',
	max: Number(process.env.DB_POOL_MAX ?? 5)
});

export const db = drizzle(client, { schema });
export { schema };
export type Db = typeof db;
