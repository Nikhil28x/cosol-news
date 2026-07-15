/**
 * Seed accounts, users, and per-user account assignments.
 *   npx tsx scripts/seed.ts
 *
 * Dataset source: data/seed.json if present (generated from the POD Excel), else
 * the bootstrap set. Idempotent: accounts upsert by slug, users upsert by email
 * (existing users keep their password). Newly created users get a temp password,
 * written to data/credentials.csv and printed once.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { and, eq, ne, notInArray } from 'drizzle-orm';
import { db } from '../src/lib/server/watch/db';
import { accounts, userAccounts, users } from '../src/lib/server/watch/db/schema';
import { generateTempPassword, hashPassword } from '../src/lib/server/watch/auth/password';
import { BOOTSTRAP, type SeedData } from './bootstrap-data';

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function loadDataset(): { data: SeedData; source: string } {
	const path = 'data/seed.json';
	if (existsSync(path)) {
		return { data: JSON.parse(readFileSync(path, 'utf8')) as SeedData, source: path };
	}
	return { data: BOOTSTRAP, source: 'bootstrap-data.ts' };
}

async function main() {
	const { data, source } = loadDataset();
	console.log(
		`Seeding from ${source}: ${data.accounts.length} accounts, ${data.users.length} users\n`
	);

	// --- Accounts (upsert by slug) ---
	for (const a of data.accounts) {
		const slug = slugify(a.name);
		await db
			.insert(accounts)
			.values({
				name: a.name,
				slug,
				segment: a.segment,
				industry: a.industry ?? null,
				country: a.country ?? null,
				ticker: a.ticker ?? null,
				exchange: a.exchange ?? null,
				website: a.website ?? null,
				description: a.description ?? null,
				pod: a.pod ?? null,
				aliases: a.aliases ?? [],
				searchTerms: a.searchTerms ?? []
			})
			.onConflictDoUpdate({
				target: accounts.slug,
				set: {
					name: a.name,
					segment: a.segment,
					industry: a.industry ?? null,
					country: a.country ?? null,
					ticker: a.ticker ?? null,
					exchange: a.exchange ?? null,
					website: a.website ?? null,
					description: a.description ?? null,
					pod: a.pod ?? null,
					aliases: a.aliases ?? [],
					searchTerms: a.searchTerms ?? [],
					updatedAt: new Date()
				}
			});
	}

	// Prune accounts no longer in the dataset (SEED_PRUNE=1). Cascades to news_items,
	// user_accounts, ingestion_runs, market_quotes via FK onDelete.
	const datasetSlugs = data.accounts.map((a) => slugify(a.name));
	if (process.env.SEED_PRUNE === '1' && datasetSlugs.length) {
		const removed = await db
			.delete(accounts)
			.where(notInArray(accounts.slug, datasetSlugs))
			.returning({ slug: accounts.slug });
		if (removed.length) console.log(`Pruned ${removed.length} account(s) not in the dataset.`);
	}

	// slug/pod → id maps
	const allAccounts = await db
		.select({ id: accounts.id, slug: accounts.slug, pod: accounts.pod })
		.from(accounts);
	const bySlug = new Map(allAccounts.map((a) => [a.slug, a.id]));
	const byPod = new Map<string, string[]>();
	for (const a of allAccounts) {
		if (!a.pod) continue;
		byPod.set(a.pod, [...(byPod.get(a.pod) ?? []), a.id]);
	}

	// --- Users (upsert by email; only new users get a temp password) ---
	const creds: { email: string; name: string; password: string }[] = [];
	for (const u of data.users) {
		const email = u.email.trim().toLowerCase();
		const [existing] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		let userId: string;
		if (existing) {
			userId = existing.id;
			await db
				.update(users)
				.set({
					fullName: u.fullName,
					role: u.role ?? 'member',
					pod: u.pod ?? null,
					title: u.title ?? null,
					updatedAt: new Date()
				})
				.where(eq(users.id, userId));
		} else {
			const tempPassword = generateTempPassword();
			const [created] = await db
				.insert(users)
				.values({
					email,
					fullName: u.fullName,
					role: u.role ?? 'member',
					pod: u.pod ?? null,
					title: u.title ?? null,
					passwordHash: await hashPassword(tempPassword),
					mustChangePassword: true
				})
				.returning({ id: users.id });
			userId = created.id;
			creds.push({ email, name: u.fullName, password: tempPassword });
		}

		// Assignments: admins get every account; members get explicit slugs or their POD.
		let ids: string[];
		if ((u.role ?? 'member') === 'admin') {
			ids = allAccounts.map((a) => a.id);
		} else if (u.accountSlugs?.length) {
			ids = u.accountSlugs
				.map((s) => bySlug.get(slugify(s)))
				.filter((x): x is string => Boolean(x));
		} else if (u.pod) {
			ids = byPod.get(u.pod) ?? [];
		} else {
			ids = [];
		}
		if (ids.length) {
			await db
				.insert(userAccounts)
				.values(ids.map((accountId) => ({ userId, accountId })))
				.onConflictDoNothing();
		}
		console.log(`  ${existing ? 'updated' : 'created'} ${email} (${ids.length} accounts)`);
	}

	// Prune non-admin users no longer in the dataset (SEED_PRUNE=1). Admins are kept.
	if (process.env.SEED_PRUNE === '1') {
		const keepEmails = data.users.map((u) => u.email.trim().toLowerCase());
		const removedUsers = await db
			.delete(users)
			.where(and(ne(users.role, 'admin'), notInArray(users.email, keepEmails)))
			.returning({ email: users.email });
		if (removedUsers.length) console.log(`Pruned ${removedUsers.length} member user(s).`);
	}

	// --- Credentials handoff ---
	if (creds.length) {
		const csv =
			'email,name,temp_password\n' +
			creds.map((c) => `${c.email},"${c.name}",${c.password}`).join('\n') +
			'\n';
		writeFileSync('data/credentials.csv', csv);
		console.log(`\n🔑 ${creds.length} new credential(s) → data/credentials.csv (git-ignored):`);
		for (const c of creds) console.log(`   ${c.email}  ${c.password}`);
	} else {
		console.log('\nNo new users created (all already existed).');
	}

	console.log('\n✅ Seed complete.');
	process.exit(0);
}

main().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
