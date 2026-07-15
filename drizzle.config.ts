import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Vite, so load .env ourselves (Node 20.6+ builtin).
try {
	process.loadEnvFile();
} catch {
	// no .env (CI/prod) — rely on the real environment
}

export default defineConfig({
	schema: './src/lib/server/watch/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? ''
	},
	strict: true,
	verbose: true
});
