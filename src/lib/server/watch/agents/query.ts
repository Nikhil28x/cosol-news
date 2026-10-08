import type { Account } from '../db/schema';
import { disambiguationFor } from './disambiguation';
import type { SignalProfile } from './signal-matching';

function quoteTerm(term: string): string {
	return `"${term.replaceAll('"', '').trim()}"`;
}

function accountNameClause(account: Account): string {
	const d = disambiguationFor(account);
	const names = [account.name, ...(account.aliases ?? []), ...(d.aliases ?? [])]
		.map((n) => n.trim())
		.filter(Boolean)
		.map(quoteTerm);
	const unique = [...new Set(names)];
	return unique.length > 1 ? `(${unique.join(' OR ')})` : unique[0] || quoteTerm(account.name);
}

/**
 * Build the search query for an account: its name + any aliases, OR'd and quoted,
 * scoped to recent news. searchTerms can add disambiguating context (e.g. a country)
 * for accounts with common names; when the account carries none, the curated
 * `disambiguation.ts` entry supplies context and exclusions so ambiguous names
 * ("Bayer", "Varian") don't return football/racing coverage.
 */
export function buildQuery(account: Account, opts: { windowDays?: number } = {}): string {
	const d = disambiguationFor(account);
	const nameClause = accountNameClause(account);

	// The account's own searchTerms win; otherwise fall back to the curated context.
	const context = (account.searchTerms ?? []).filter(Boolean);
	const contextTerms = context.length ? context : (d.context ?? []);
	const contextClause = contextTerms.length
		? ` (${contextTerms.map((t) => `"${t}"`).join(' OR ')})`
		: '';

	// Google News honours `-term` exclusions; phrases need the quotes inside the minus.
	const excludeClause = (d.exclude ?? [])
		.filter(Boolean)
		.map((t) => ` -"${t.trim()}"`)
		.join('');

	const windowDays = opts.windowDays ?? 30;
	return `${nameClause}${contextClause}${excludeClause} when:${windowDays}d`;
}

/**
 * A focused supplementary query for one admin-configured signal. The normal account
 * query still runs; these queries improve recall for high-value, account-specific
 * phrases such as an ERP programme, a named subsidiary, or an RFB/tender.
 */
export function buildSignalQuery(
	account: Account,
	signal: Pick<SignalProfile, 'terms' | 'excludeTerms'>,
	opts: { windowDays?: number } = {}
): string {
	const terms = [...new Set(signal.terms.map((term) => term.trim()).filter(Boolean))].slice(0, 10);
	if (!terms.length) return buildQuery(account, opts);
	const signalClause = ` (${terms.map(quoteTerm).join(' OR ')})`;
	const excludes = signal.excludeTerms
		.map((term) => term.trim())
		.filter(Boolean)
		.slice(0, 8)
		.map((term) => ` -${quoteTerm(term)}`)
		.join('');
	return `${accountNameClause(account)}${signalClause}${excludes} when:${opts.windowDays ?? 30}d`;
}
