import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getAccountBySlugForUser } from '$lib/server/watch/data/accounts';
import { getFeed } from '$lib/server/watch/data/news';
import { getAccountDigest, invalidateTodaySummaries } from '$lib/server/watch/data/digest';
import { effectiveUser } from '$lib/server/watch/auth/view-as';
import { db } from '$lib/server/watch/db';
import { accounts } from '$lib/server/watch/db/schema';
import {
	createAccountAction,
	createAccountSignal,
	deleteAccountAction,
	deleteAccountSignal,
	getNewsSignalRefs,
	listAccountActions,
	listAccountSignals,
	setAccountSignalActive,
	updateAccountAction
} from '$lib/server/watch/data/account-intelligence';
import { SIGNAL_TYPES, type ActionStatus, type SignalType } from '$lib/watch/types';
import type { Actions, PageServerLoad } from './$types';

const ACTION_STATUSES = new Set<ActionStatus>([
	'open',
	'in_progress',
	'waiting',
	'submitted',
	'won',
	'lost',
	'done'
]);

function requireAdmin(locals: App.Locals) {
	if (!locals.user || locals.user.role !== 'admin') error(403, 'Admins only.');
}

async function adminAccount(locals: App.Locals, slug: string) {
	requireAdmin(locals);
	const [account] = await db.select().from(accounts).where(eq(accounts.slug, slug)).limit(1);
	if (!account) error(404, 'Account not found.');
	return account;
}

function text(form: FormData, key: string, max = 500): string {
	return String(form.get(key) ?? '')
		.trim()
		.slice(0, max);
}

function terms(value: string): string[] {
	return [
		...new Set(
			value
				.split(/[\n,;]+/)
				.map((term) => term.trim())
				.filter((term) => term.length >= 2)
				.map((term) => term.slice(0, 80))
		)
	].slice(0, 20);
}

function dueDate(value: string): Date | null {
	if (!value) return null;
	const due = new Date(`${value}T17:00:00`);
	return Number.isNaN(due.getTime()) ? null : due;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const view = effectiveUser(locals);
	const account = await getAccountBySlugForUser(view, params.slug);
	if (!account) error(404, 'Account not found or not in your portfolio.');

	const isAdmin = locals.user?.role === 'admin';
	const signals = isAdmin ? await listAccountSignals(account.id) : [];
	const requestedSignal = isAdmin ? (url.searchParams.get('signal') ?? '') : '';
	const selectedSignalId = signals.some((signal) => signal.id === requestedSignal)
		? requestedSignal
		: '';
	const items = await getFeed(view, {
		accountId: account.id,
		watchSignalId: selectedSignalId || undefined,
		limit: 100
	});
	const matchMap = isAdmin ? await getNewsSignalRefs(items.map((item) => item.id)) : new Map();
	const actions = isAdmin ? await listAccountActions(account.id) : [];

	// Digest streams in (Gemini); the raw feed and admin workflow render immediately.
	return {
		account,
		items: items.map((item) => ({ ...item, watchSignals: matchMap.get(item.id) ?? [] })),
		digest: getAccountDigest({ id: account.id, name: account.name, segment: account.segment }),
		isAdmin,
		signals,
		actions,
		selectedSignalId
	};
};

export const actions: Actions = {
	addSignal: async ({ locals, params, request }) => {
		const account = await adminAccount(locals, params.slug);
		const form = await request.formData();
		const name = text(form, 'name', 80);
		const includeTerms = terms(text(form, 'terms', 1200));
		const excludeTerms = terms(text(form, 'excludeTerms', 800));
		const kind = text(form, 'kind') === 'rfb' ? 'rfb' : 'watch';
		const rawSignalType = text(form, 'signalType') as SignalType;
		const signalType =
			rawSignalType in SIGNAL_TYPES ? rawSignalType : kind === 'rfb' ? 'contract' : 'other';
		if (!name || !includeTerms.length) {
			return fail(400, { error: 'A signal name and at least one search term are required.' });
		}
		try {
			await createAccountSignal({
				accountId: account.id,
				name,
				kind,
				signalType,
				terms: includeTerms,
				excludeTerms,
				isPriority: form.get('isPriority') === '1',
				createdBy: locals.user!.id
			});
			await invalidateTodaySummaries();
			return { signalSaved: name };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return fail(400, {
				error: message.includes('account_signals_account_name_uniq')
					? 'This account already has a signal with that name.'
					: 'The signal could not be saved.'
			});
		}
	},

	addRfbSignal: async ({ locals, params }) => {
		const account = await adminAccount(locals, params.slug);
		try {
			await createAccountSignal({
				accountId: account.id,
				name: 'RFB & bid opportunities',
				kind: 'rfb',
				signalType: 'contract',
				terms: [
					'RFB',
					'request for bid',
					'invitation to bid',
					'tender',
					'procurement notice',
					'RFP',
					'request for proposal',
					'EOI'
				],
				excludeTerms: [],
				isPriority: true,
				createdBy: locals.user!.id
			});
			await invalidateTodaySummaries();
			return { signalSaved: 'RFB & bid opportunities' };
		} catch {
			return fail(400, { error: 'The RFB watch already exists or could not be added.' });
		}
	},

	toggleSignal: async ({ locals, params, request }) => {
		const account = await adminAccount(locals, params.slug);
		const form = await request.formData();
		await setAccountSignalActive(
			account.id,
			text(form, 'signalId', 80),
			text(form, 'active') === '1'
		);
		return { signalUpdated: true };
	},

	deleteSignal: async ({ locals, params, request }) => {
		const account = await adminAccount(locals, params.slug);
		const form = await request.formData();
		await deleteAccountSignal(account.id, text(form, 'signalId', 80));
		return { signalDeleted: true };
	},

	createAction: async ({ locals, params, request }) => {
		const account = await adminAccount(locals, params.slug);
		const form = await request.formData();
		const kind = text(form, 'kind') === 'rfb' ? 'rfb' : 'follow_up';
		const title = text(form, 'title', 220);
		if (!title) return fail(400, { error: 'A follow-up title is required.' });
		try {
			await createAccountAction({
				accountId: account.id,
				newsItemId: text(form, 'newsItemId', 80) || null,
				accountSignalId: text(form, 'signalId', 80) || null,
				kind,
				priority: form.get('priority') === 'high' || kind === 'rfb' ? 'high' : 'normal',
				title,
				notes: text(form, 'notes', 2000) || null,
				dueAt: dueDate(text(form, 'dueAt', 20)),
				createdBy: locals.user!.id,
				assignedTo: locals.user!.id
			});
			return { actionSaved: kind };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'The follow-up could not be saved.'
			});
		}
	},

	updateAction: async ({ locals, params, request }) => {
		const account = await adminAccount(locals, params.slug);
		const form = await request.formData();
		const rawStatus = text(form, 'status') as ActionStatus;
		const status = ACTION_STATUSES.has(rawStatus) ? rawStatus : 'open';
		await updateAccountAction(account.id, text(form, 'actionId', 80), {
			status,
			priority: form.get('priority') === 'high' ? 'high' : 'normal',
			dueAt: dueDate(text(form, 'dueAt', 20))
		});
		return { actionUpdated: true };
	},

	deleteAction: async ({ locals, params, request }) => {
		const account = await adminAccount(locals, params.slug);
		const form = await request.formData();
		await deleteAccountAction(account.id, text(form, 'actionId', 80));
		return { actionDeleted: true };
	}
};
