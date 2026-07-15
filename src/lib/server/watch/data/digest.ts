import { and, count, countDistinct, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type {
	AccountDigest,
	AuthUser,
	DashboardCounts,
	DashboardDigest,
	SegmentCount
} from '$lib/watch/types';
import { SEGMENTS, segmentDef } from '$lib/watch/segments';
import { db } from '../db';
import { accounts, newsItems, newsSummaries } from '../db/schema';
import { accessibleAccountIds } from './access';
import { summariseAccount, summariseDashboard, type SectorInput } from '../agents/summarise';

const A = (...xs: (SQL | undefined)[]) => {
	const f = xs.filter((x): x is SQL => Boolean(x));
	return f.length ? and(...f) : undefined;
};
const todayUTC = () => new Date().toISOString().slice(0, 10);
const startOfTodayUTC = () => {
	const d = new Date();
	d.setUTCHours(0, 0, 0, 0);
	return d;
};
const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

// ---------------------------------------------------------------------------
// AI-free counts (fast, every request)
// ---------------------------------------------------------------------------
export async function getDashboardCounts(user: AuthUser): Promise<DashboardCounts> {
	const ids = await accessibleAccountIds(user);
	const empty: DashboardCounts = {
		totalCustomers: 0,
		newThisMonth: 0,
		newsToday: 0,
		totalNews: 0,
		sourcesMonitored: 0,
		lastSyncAt: null,
		segments: []
	};
	if (ids !== 'all' && ids.length === 0) return empty;

	const scoped = ids !== 'all';
	const accScope = scoped ? inArray(accounts.id, ids) : undefined;
	const newsScope = scoped ? inArray(newsItems.accountId, ids) : undefined;
	const days30 = new Date(Date.now() - 30 * 86_400_000);

	const [segRows, newRow, todayRow, totalRow, srcRow, lastRow] = await Promise.all([
		db
			.select({ segment: accounts.segment, c: count() })
			.from(accounts)
			.where(A(eq(accounts.isActive, true), accScope))
			.groupBy(accounts.segment),
		db
			.select({ c: count() })
			.from(accounts)
			.where(A(eq(accounts.isActive, true), accScope, gte(accounts.createdAt, days30))),
		db
			.select({ c: count() })
			.from(newsItems)
			.where(A(newsScope, gte(newsItems.fetchedAt, startOfTodayUTC()))),
		db.select({ c: count() }).from(newsItems).where(A(newsScope)),
		db.select({ c: countDistinct(newsItems.source) }).from(newsItems).where(A(newsScope)),
		db
			.select({ last: sql<Date | null>`max(${newsItems.fetchedAt})` })
			.from(newsItems)
			.where(A(newsScope))
	]);

	const segCount = new Map<string, number>();
	for (const r of segRows) segCount.set(r.segment ?? 'other', (segCount.get(r.segment ?? 'other') ?? 0) + Number(r.c));
	const segments: SegmentCount[] = SEGMENTS.map((s) => ({
		key: s.key,
		label: s.label,
		icon: s.icon,
		accent: s.accent,
		count: segCount.get(s.key) ?? 0
	})).filter((s) => s.count > 0);

	return {
		totalCustomers: [...segCount.values()].reduce((a, b) => a + b, 0),
		newThisMonth: Number(newRow[0]?.c ?? 0),
		newsToday: Number(todayRow[0]?.c ?? 0),
		totalNews: Number(totalRow[0]?.c ?? 0),
		sourcesMonitored: Number(srcRow[0]?.c ?? 0),
		lastSyncAt: lastRow[0]?.last ?? null,
		segments
	};
}

// ---------------------------------------------------------------------------
// Dashboard digest (Gemini) — cached once per user per day
// ---------------------------------------------------------------------------
export async function getDashboardDigest(
	user: AuthUser,
	opts: { regenerate?: boolean } = {}
): Promise<DashboardDigest | null> {
	const day = todayUTC();
	if (!opts.regenerate) {
		const [cached] = await db
			.select()
			.from(newsSummaries)
			.where(
				and(
					eq(newsSummaries.kind, 'dashboard'),
					eq(newsSummaries.scopeKey, user.id),
					eq(newsSummaries.day, day)
				)
			)
			.limit(1);
		if (cached) return cached.payload as DashboardDigest;
	}

	const ids = await accessibleAccountIds(user);
	if (ids !== 'all' && ids.length === 0) return null;
	const since = new Date(Date.now() - 14 * 86_400_000);

	const rows = await db
		.select({
			segment: accounts.segment,
			account: accounts.name,
			title: newsItems.title,
			publishedAt: newsItems.publishedAt,
			fetchedAt: newsItems.fetchedAt
		})
		.from(newsItems)
		.innerJoin(accounts, eq(newsItems.accountId, accounts.id))
		.where(
			A(
				ids !== 'all' ? inArray(newsItems.accountId, ids) : undefined,
				eq(accounts.isActive, true),
				gte(newsItems.fetchedAt, since)
			)
		)
		.orderBy(desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`))
		.limit(700);
	if (!rows.length) return null;

	const groups = new Map<string, SectorInput['items']>();
	const sectorAccounts = new Map<string, Set<string>>();
	const sectorCount = new Map<string, number>();
	for (const r of rows) {
		const key = r.segment ?? 'other';
		sectorCount.set(key, (sectorCount.get(key) ?? 0) + 1);
		let set = sectorAccounts.get(key);
		if (!set) {
			set = new Set();
			sectorAccounts.set(key, set);
		}
		set.add(r.account);
		const arr = groups.get(key) ?? [];
		if (arr.length < 25) arr.push({ account: r.account, title: r.title, date: isoDay(r.publishedAt ?? r.fetchedAt) });
		groups.set(key, arr);
	}
	const sectorsInput: SectorInput[] = [...groups.entries()].map(([key, items]) => ({
		key,
		label: segmentDef(key).label,
		items
	}));

	let res;
	try {
		res = await summariseDashboard(sectorsInput);
	} catch (err) {
		console.warn(`[digest] dashboard summarise failed: ${(err as Error).message}`);
		return null;
	}

	const digest: DashboardDigest = {
		portfolioSummary: res.portfolioSummary,
		portfolioSentiment: res.portfolioSentiment,
		itemCount: rows.length,
		generatedAt: new Date().toISOString(),
		model: res.model,
		sectors: res.sectors.map((s) => ({
			...s,
			accountCount: sectorAccounts.get(s.key)?.size ?? 0,
			itemCount: sectorCount.get(s.key) ?? 0
		}))
	};

	await db
		.insert(newsSummaries)
		.values({ kind: 'dashboard', scopeKey: user.id, day, payload: digest, model: res.model, itemCount: rows.length })
		.onConflictDoUpdate({
			target: [newsSummaries.kind, newsSummaries.scopeKey, newsSummaries.day],
			set: { payload: digest, model: res.model, itemCount: rows.length, createdAt: new Date() }
		});
	return digest;
}

// ---------------------------------------------------------------------------
// Account digest (Gemini) — cached once per account per day
// ---------------------------------------------------------------------------
export async function getAccountDigest(
	account: { id: string; name: string; segment: string | null },
	opts: { regenerate?: boolean } = {}
): Promise<AccountDigest | null> {
	const day = todayUTC();
	if (!opts.regenerate) {
		const [cached] = await db
			.select()
			.from(newsSummaries)
			.where(
				and(
					eq(newsSummaries.kind, 'account'),
					eq(newsSummaries.scopeKey, account.id),
					eq(newsSummaries.day, day)
				)
			)
			.limit(1);
		if (cached) return cached.payload as AccountDigest;
	}

	const since = new Date(Date.now() - 21 * 86_400_000);
	const rows = await db
		.select({
			title: newsItems.title,
			source: newsItems.source,
			publishedAt: newsItems.publishedAt,
			fetchedAt: newsItems.fetchedAt
		})
		.from(newsItems)
		.where(and(eq(newsItems.accountId, account.id), gte(newsItems.fetchedAt, since)))
		.orderBy(desc(sql`coalesce(${newsItems.publishedAt}, ${newsItems.fetchedAt})`))
		.limit(40);
	if (!rows.length) return null;

	let res;
	try {
		res = await summariseAccount({
			name: account.name,
			segment: segmentDef(account.segment).label,
			items: rows.map((r) => ({ title: r.title, source: r.source, date: isoDay(r.publishedAt ?? r.fetchedAt) }))
		});
	} catch (err) {
		console.warn(`[digest] account summarise failed: ${(err as Error).message}`);
		return null;
	}

	const digest: AccountDigest = {
		summary: res.summary,
		sentiment: res.sentiment,
		sentimentScore: res.sentimentScore,
		signals: res.signals,
		itemCount: rows.length,
		generatedAt: new Date().toISOString(),
		model: res.model
	};

	await db
		.insert(newsSummaries)
		.values({ kind: 'account', scopeKey: account.id, day, payload: digest, model: res.model, itemCount: rows.length })
		.onConflictDoUpdate({
			target: [newsSummaries.kind, newsSummaries.scopeKey, newsSummaries.day],
			set: { payload: digest, model: res.model, itemCount: rows.length, createdAt: new Date() }
		});
	return digest;
}

/** Drop today's cached digests so they regenerate against freshly-fetched news. */
export async function invalidateTodaySummaries(): Promise<void> {
	await db.delete(newsSummaries).where(eq(newsSummaries.day, todayUTC()));
}
