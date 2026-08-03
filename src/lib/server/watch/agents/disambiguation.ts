/**
 * Per-account query disambiguation.
 *
 * Several customer names are shared with something far more newsworthy than the
 * customer: "Bayer" is a Bundesliga club, "Varian" a racehorse trainer, "Baxter" a
 * footballer's surname. A bare `"Bayer" when:30d` RSS query therefore returns mostly
 * football, which then poisons the Pharma & Healthcare sector digest.
 *
 * Each entry sharpens that account's Google News query:
 *   - `aliases` — extra name variants OR'd into the name clause (widens real coverage)
 *   - `context` — an AND'd group; at least one term must appear (narrows to the company)
 *   - `exclude` — terms Google News must NOT match (`-term`)
 *
 * Keyed by account slug or name (matched case-insensitively, non-alphanumerics ignored),
 * so it applies to seeded rows without a migration. An account that carries its own
 * `searchTerms` in the DB wins over `context` here.
 *
 * A second, source-agnostic guard runs after the fetch — see `agents/relevance.ts`.
 */

export interface Disambiguation {
	aliases?: string[];
	context?: string[];
	exclude?: string[];
}

/** Football/racing terms that swamp several of the accounts below. */
// Phrases, not bare words: `-"transfer"` would also bury legitimate "technology
// transfer" pharma news.
const FOOTBALL = [
	'Leverkusen',
	'Bundesliga',
	'Premier League',
	'transfer window',
	'transfer fee',
	'midfielder',
	'striker',
	'goalkeeper',
	'FC'
];
const HORSE_RACING = ['jockey', 'racecourse', 'racehorse', 'gelding', 'filly', 'maiden stakes'];

export const DISAMBIGUATION: Record<string, Disambiguation> = {
	// ---- Pharma & Healthcare ----
	bayer: {
		aliases: ['Bayer AG', 'Bayer CropScience', 'Bayer Pharmaceuticals'],
		context: [
			'pharma',
			'pharmaceutical',
			'crop science',
			'agriculture',
			'Monsanto',
			'Roundup',
			'glyphosate',
			'drug',
			'shares',
			'earnings'
		],
		exclude: [...FOOTBALL, 'Bayer 04', 'Werkself', 'Champions League', 'Xabi Alonso']
	},
	baxter: {
		aliases: ['Baxter International', 'Baxter Healthcare'],
		context: [
			'Baxter International',
			'healthcare',
			'medical',
			'dialysis',
			'infusion',
			'hospital',
			'shares',
			'earnings',
			'FDA'
		],
		exclude: [...FOOTBALL, 'Rangers']
	},
	varian: {
		aliases: ['Varian Medical Systems', 'Varian Medical'],
		context: [
			'Varian Medical',
			'oncology',
			'radiotherapy',
			'radiation therapy',
			'cancer',
			'Siemens Healthineers',
			'linear accelerator'
		],
		exclude: [...HORSE_RACING, 'Roger Varian', 'horse racing', 'Goodwood']
	},
	merck: {
		aliases: ['Merck & Co', 'Merck KGaA', 'MSD'],
		context: [
			'pharma',
			'pharmaceutical',
			'drug',
			'vaccine',
			'FDA',
			'clinical',
			'Keytruda',
			'shares',
			'earnings'
		]
	},
	sunpharma: {
		// The seeded name is one word; nobody writes it that way.
		aliases: ['Sun Pharma', 'Sun Pharmaceutical', 'Sun Pharmaceutical Industries']
	},
	apotex: {
		aliases: ['Apotex Inc'],
		context: ['generic', 'drug', 'pharma', 'pharmaceutical', 'health', 'FDA', 'Health Canada']
	},
	nimhans: {
		aliases: ['National Institute of Mental Health and Neurosciences']
	},
	cipla: {
		aliases: ['Cipla Ltd', 'Cipla Health']
	},

	// ---- Accounts the press calls something else ----
	// Without these the mention gate (agents/relevance.ts) correctly rejects real
	// coverage, because the seeded name never appears in it.
	tkm: {
		aliases: ['Toyota Kirloskar Motor', 'Toyota Kirloskar'],
		context: ['Toyota', 'Kirloskar', 'Bidadi', 'car', 'plant'],
		exclude: ['TKM Grupp', 'Turkmenistan', 'TKM College', 'Thangal Kunju Musaliar', 'KEAM']
	},
	vantiv: {
		// Vantiv → Worldpay after the merger; nothing is published under "Vantiv".
		aliases: ['Worldpay', 'Worldpay from FIS'],
		context: ['payments', 'merchant', 'acquiring', 'card', 'fintech']
	},
	iftas: {
		// The bare acronym pulls the Irish Film & Television Awards.
		aliases: ['Indian Financial Technology and Allied Services', 'IFTAS India'],
		context: ['Reserve Bank', 'RBI', 'banking', 'financial', 'India'],
		exclude: ['Irish', 'IFTA', 'Netflix', 'film awards']
	},
	yuzhan: {
		aliases: ['Yuzhan Technology', 'Foxconn India', 'Foxconn Hon Hai'],
		context: ['Foxconn', 'India', 'manufacturing', 'plant', 'iPhone']
	},
	apnic: {
		aliases: ['Asia Pacific Network Information Centre', 'APNIC Foundation']
	},
	iimahmedabad: {
		aliases: ['IIMA', 'IIM-A', 'Indian Institute of Management Ahmedabad']
	},
	nuclearpowercorporationnpcil: {
		aliases: ['NPCIL', 'Nuclear Power Corporation of India']
	},
	sardarvallabhaipatelhospital: {
		// Seeded spelling drops a "bh" — the press uses the full form.
		aliases: ['Sardar Vallabhbhai Patel Hospital', 'SVP Hospital'],
		context: ['hospital', 'Ahmedabad', 'patients', 'health']
	},
	transunioncibil: {
		aliases: ['TransUnion CIBIL', 'CIBIL']
	},
	pwc: {
		// Three-letter names are matched case-sensitively; the house style is "PwC".
		aliases: ['PwC', 'PricewaterhouseCoopers']
	},
	ey: {
		aliases: ['EY', 'Ernst & Young', 'Ernst and Young']
	},
	nuvamaedelweiss: {
		aliases: ['Nuvama Wealth', 'Edelweiss Financial Services']
	},

	// ---- Other segments with the same name-collision problem ----
	blum: {
		aliases: ['Julius Blum', 'Blum Inc'],
		context: ['furniture', 'fittings', 'hinge', 'cabinet', 'manufactur', 'factory', 'plant'],
		exclude: ['obituary', 'arrested', 'Jason Blum', 'Blumhouse']
	},
	tatagroup: {
		aliases: ['Tata Sons'],
		exclude: ['Jamshedpur FC', 'ISL', 'Indian Super League', ...FOOTBALL]
	}
};

/** Normalised lookup key: lower-case, alphanumerics only ("TATA GROUP" → "tatagroup"). */
function key(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BY_KEY = new Map(Object.entries(DISAMBIGUATION).map(([k, v]) => [key(k), v]));

/** Curated query tweaks for an account, matched on its slug or name. */
export function disambiguationFor(account: { name: string; slug?: string | null }): Disambiguation {
	return (account.slug && BY_KEY.get(key(account.slug))) || BY_KEY.get(key(account.name)) || {};
}
