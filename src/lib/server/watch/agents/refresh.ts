/**
 * The daily refresh: fetch RSS for every account (NO per-item AI), then rebuild the
 * Gemini digests that power the dashboard. This is what the cron / CLI runs each day.
 */
import { eq } from 'drizzle-orm';
import type { AuthUser } from '$lib/watch/types';
import { db } from '../db';
import { users } from '../db/schema';
import type { User } from '../db/schema';
import { getDashboardDigest, invalidateTodaySummaries } from '../data/digest';
import { ingestAllAccounts, type IngestResult } from './orchestrator';

function toAuthUser(u: User): AuthUser {
	return {
		id: u.id,
		email: u.email,
		fullName: u.fullName,
		role: u.role,
		pod: u.pod,
		title: u.title,
		mustChangePassword: u.mustChangePassword
	};
}

export interface RefreshResult {
	accounts: number;
	newItems: number;
	digests: number;
	errors: number;
	ingest: IngestResult[];
}

export async function refreshAll(
	opts: { concurrency?: number; limit?: number } = {}
): Promise<RefreshResult> {
	// 1) Daily RSS fetch — plain, fast, no LLM per item.
	const ingest = await ingestAllAccounts({
		enrich: false,
		concurrency: opts.concurrency ?? 3,
		limit: opts.limit
	});

	// 2) Drop today's cached digests so they reflect the freshly-fetched news.
	await invalidateTodaySummaries();

	// 3) Warm the cache: regenerate each active user's dashboard digest (one Gemini
	//    call per user, scoped to their own accounts). Account digests regen lazily.
	const activeUsers = await db.select().from(users).where(eq(users.isActive, true));
	let digests = 0;
	for (const u of activeUsers) {
		try {
			if (await getDashboardDigest(toAuthUser(u))) digests++;
		} catch {
			/* leave uncached; it will lazily regenerate on view */
		}
	}

	return {
		accounts: ingest.length,
		newItems: ingest.reduce((n, r) => n + r.fresh, 0),
		errors: ingest.filter((r) => r.status === 'error').length,
		digests,
		ingest
	};
}
