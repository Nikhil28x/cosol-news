import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type {
	AccountActionView,
	AccountSignalRef,
	AccountSignalView,
	ActionKind,
	ActionPriority,
	ActionStatus,
	SignalType
} from '$lib/watch/types';
import { db } from '../db';
import {
	accountActions,
	accountSignals,
	accounts,
	newsItems,
	newsSignalMatches,
	users
} from '../db/schema';
import { matchSignalText, type SignalProfile } from '../agents/signal-matching';
import { isRelevantForAccount } from '../agents/relevance';

export async function listAccountSignals(accountId: string): Promise<AccountSignalView[]> {
	const [signals, counts] = await Promise.all([
		db
			.select()
			.from(accountSignals)
			.where(eq(accountSignals.accountId, accountId))
			.orderBy(desc(accountSignals.isPriority), asc(accountSignals.name)),
		db
			.select({ signalId: newsSignalMatches.accountSignalId, value: count() })
			.from(newsSignalMatches)
			.innerJoin(accountSignals, eq(newsSignalMatches.accountSignalId, accountSignals.id))
			.where(eq(accountSignals.accountId, accountId))
			.groupBy(newsSignalMatches.accountSignalId)
	]);
	const countById = new Map(counts.map((row) => [row.signalId, Number(row.value)]));
	return signals.map((signal) => ({
		id: signal.id,
		name: signal.name,
		kind: signal.kind,
		signalType: signal.signalType,
		terms: signal.terms,
		excludeTerms: signal.excludeTerms,
		isPriority: signal.isPriority,
		isActive: signal.isActive,
		matchCount: countById.get(signal.id) ?? 0,
		createdAt: signal.createdAt
	}));
}

export async function createAccountSignal(input: {
	accountId: string;
	name: string;
	kind: 'watch' | 'rfb';
	signalType: SignalType;
	terms: string[];
	excludeTerms: string[];
	isPriority: boolean;
	createdBy: string;
}) {
	const [created] = await db.insert(accountSignals).values(input).returning();
	await backfillSignalMatches(created);
	return created;
}

/** Match a newly-created signal against the existing account knowledge base. */
async function backfillSignalMatches(signal: typeof accountSignals.$inferSelect): Promise<number> {
	const profile: SignalProfile = {
		id: signal.id,
		name: signal.name,
		kind: signal.kind,
		signalType: signal.signalType,
		terms: signal.terms,
		excludeTerms: signal.excludeTerms,
		isPriority: signal.isPriority,
		isActive: signal.isActive
	};
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, signal.accountId))
		.limit(1);
	if (!account) return 0;
	const rows = await db
		.select({ id: newsItems.id, title: newsItems.title, summary: newsItems.summary })
		.from(newsItems)
		.where(eq(newsItems.accountId, signal.accountId));
	const matches = rows
		.map((item) => ({ item, terms: matchSignalText(profile, item) }))
		.filter(
			(match) => match.terms.length > 0 && isRelevantForAccount(account, match.item, [profile])
		);
	if (!matches.length) return 0;

	await db
		.insert(newsSignalMatches)
		.values(
			matches.map((match) => ({
				newsItemId: match.item.id,
				accountSignalId: signal.id,
				matchedTerms: match.terms
			}))
		)
		.onConflictDoNothing();
	await db
		.update(newsItems)
		.set({ businessRelevant: true })
		.where(
			inArray(
				newsItems.id,
				matches.map((match) => match.item.id)
			)
		);
	return matches.length;
}

export async function setAccountSignalActive(accountId: string, signalId: string, active: boolean) {
	return db
		.update(accountSignals)
		.set({ isActive: active, updatedAt: new Date() })
		.where(and(eq(accountSignals.id, signalId), eq(accountSignals.accountId, accountId)));
}

export async function deleteAccountSignal(accountId: string, signalId: string) {
	return db
		.delete(accountSignals)
		.where(and(eq(accountSignals.id, signalId), eq(accountSignals.accountId, accountId)));
}

export async function getNewsSignalRefs(
	newsItemIds: string[]
): Promise<Map<string, AccountSignalRef[]>> {
	const map = new Map<string, AccountSignalRef[]>();
	if (!newsItemIds.length) return map;
	const rows = await db
		.select({
			newsItemId: newsSignalMatches.newsItemId,
			id: accountSignals.id,
			name: accountSignals.name,
			kind: accountSignals.kind,
			signalType: accountSignals.signalType,
			isPriority: accountSignals.isPriority,
			matchedTerms: newsSignalMatches.matchedTerms
		})
		.from(newsSignalMatches)
		.innerJoin(accountSignals, eq(newsSignalMatches.accountSignalId, accountSignals.id))
		.where(inArray(newsSignalMatches.newsItemId, newsItemIds))
		.orderBy(desc(accountSignals.isPriority), asc(accountSignals.name));
	for (const row of rows) {
		const list = map.get(row.newsItemId) ?? [];
		list.push({
			id: row.id,
			name: row.name,
			kind: row.kind,
			signalType: row.signalType,
			isPriority: row.isPriority,
			matchedTerms: row.matchedTerms
		});
		map.set(row.newsItemId, list);
	}
	return map;
}

export async function listAccountActions(accountId: string): Promise<AccountActionView[]> {
	const rows = await db
		.select({
			id: accountActions.id,
			kind: accountActions.kind,
			status: accountActions.status,
			priority: accountActions.priority,
			title: accountActions.title,
			notes: accountActions.notes,
			dueAt: accountActions.dueAt,
			createdAt: accountActions.createdAt,
			updatedAt: accountActions.updatedAt,
			newsItemId: accountActions.newsItemId,
			newsTitle: newsItems.title,
			newsUrl: newsItems.url,
			signalId: accountActions.accountSignalId,
			signalName: accountSignals.name,
			assigneeName: users.fullName
		})
		.from(accountActions)
		.leftJoin(newsItems, eq(accountActions.newsItemId, newsItems.id))
		.leftJoin(accountSignals, eq(accountActions.accountSignalId, accountSignals.id))
		.leftJoin(users, eq(accountActions.assignedTo, users.id))
		.where(eq(accountActions.accountId, accountId))
		.orderBy(
			desc(accountActions.priority),
			asc(accountActions.dueAt),
			desc(accountActions.createdAt)
		);
	return rows;
}

export async function createAccountAction(input: {
	accountId: string;
	newsItemId?: string | null;
	accountSignalId?: string | null;
	kind: ActionKind;
	priority: ActionPriority;
	title: string;
	notes?: string | null;
	dueAt?: Date | null;
	createdBy: string;
	assignedTo?: string | null;
}) {
	if (input.newsItemId) {
		const [news] = await db
			.select({ id: newsItems.id })
			.from(newsItems)
			.where(and(eq(newsItems.id, input.newsItemId), eq(newsItems.accountId, input.accountId)))
			.limit(1);
		if (!news) throw new Error('News item does not belong to this account.');
	}
	if (input.accountSignalId) {
		const [signal] = await db
			.select({ id: accountSignals.id })
			.from(accountSignals)
			.where(
				and(
					eq(accountSignals.id, input.accountSignalId),
					eq(accountSignals.accountId, input.accountId)
				)
			)
			.limit(1);
		if (!signal) throw new Error('Signal does not belong to this account.');
	}
	const [created] = await db
		.insert(accountActions)
		.values({ ...input, status: 'open' })
		.returning();
	return created;
}

export async function updateAccountAction(
	accountId: string,
	actionId: string,
	input: {
		status: ActionStatus;
		priority: ActionPriority;
		dueAt: Date | null;
	}
) {
	return db
		.update(accountActions)
		.set({ ...input, updatedAt: new Date() })
		.where(and(eq(accountActions.id, actionId), eq(accountActions.accountId, accountId)));
}

export async function deleteAccountAction(accountId: string, actionId: string) {
	return db
		.delete(accountActions)
		.where(and(eq(accountActions.id, actionId), eq(accountActions.accountId, accountId)));
}
