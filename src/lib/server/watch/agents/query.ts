import type { Account } from '../db/schema';
import { disambiguationFor } from './disambiguation';

/**
 * Build the search query for an account: its name + any aliases, OR'd and quoted,
 * scoped to recent news. searchTerms can add disambiguating context (e.g. a country)
 * for accounts with common names; when the account carries none, the curated
 * `disambiguation.ts` entry supplies context and exclusions so ambiguous names
 * ("Bayer", "Varian") don't return football/racing coverage.
 */
export function buildQuery(account: Account, opts: { windowDays?: number } = {}): string {
	const d = disambiguationFor(account);

	const names = [account.name, ...(account.aliases ?? []), ...(d.aliases ?? [])]
		.map((n) => n.trim())
		.filter(Boolean)
		.map((n) => `"${n}"`);
	const unique = [...new Set(names)];
	const nameClause =
		unique.length > 1 ? `(${unique.join(' OR ')})` : unique[0] || `"${account.name}"`;

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
