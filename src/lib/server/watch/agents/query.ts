import type { Account } from '../db/schema';

/**
 * Build the search query for an account: its name + any aliases, OR'd and quoted,
 * scoped to recent news. searchTerms can add disambiguating context (e.g. a country)
 * for accounts with common names.
 */
export function buildQuery(account: Account, opts: { windowDays?: number } = {}): string {
	const names = [account.name, ...(account.aliases ?? [])]
		.map((n) => n.trim())
		.filter(Boolean)
		.map((n) => `"${n}"`);
	const nameClause = names.length > 1 ? `(${names.join(' OR ')})` : names[0] || `"${account.name}"`;

	const context = (account.searchTerms ?? []).filter(Boolean);
	const contextClause = context.length ? ` (${context.map((t) => `"${t}"`).join(' OR ')})` : '';

	const windowDays = opts.windowDays ?? 30;
	return `${nameClause}${contextClause} when:${windowDays}d`;
}
