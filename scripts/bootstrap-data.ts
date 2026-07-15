/**
 * Bootstrap dataset — used by scripts/seed.ts when data/seed.json is absent.
 *
 * These are the sample accounts from the reference dashboard (real ASX-listed
 * Australian companies) so live news ingestion can be validated end-to-end. The
 * real POD account list (from data/accounts.xlsx → data/seed.json) replaces this.
 *
 * The admin user is vishal@cosol.in so the owner can sign in immediately.
 */
export interface SeedAccount {
	name: string;
	segment: string;
	industry?: string;
	country?: string;
	ticker?: string;
	exchange?: string;
	website?: string;
	description?: string;
	pod?: string;
	aliases?: string[];
	searchTerms?: string[];
}

export interface SeedUser {
	email: string;
	fullName: string;
	role?: 'admin' | 'member';
	pod?: string;
	title?: string;
	accountSlugs?: string[];
}

export interface SeedData {
	accounts: SeedAccount[];
	users: SeedUser[];
}

export const BOOTSTRAP: SeedData = {
	accounts: [
		{
			name: 'BHP Group',
			segment: 'mining_metals',
			industry: 'Mining & Metals',
			country: 'Australia',
			ticker: 'BHP',
			exchange: 'ASX',
			website: 'https://www.bhp.com',
			description: 'Global resources company; iron ore, copper, coal and nickel.',
			pod: 'POD 1',
			aliases: ['BHP', 'BHP Group', 'BHP Billiton']
		},
		{
			name: 'Rio Tinto',
			segment: 'mining_metals',
			industry: 'Mining & Metals',
			country: 'Australia',
			ticker: 'RIO',
			exchange: 'ASX',
			website: 'https://www.riotinto.com',
			description: 'Diversified miner; iron ore, aluminium, copper and minerals.',
			pod: 'POD 1',
			aliases: ['Rio Tinto']
		},
		{
			name: 'Fortescue',
			segment: 'mining_metals',
			industry: 'Mining & Green Energy',
			country: 'Australia',
			ticker: 'FMG',
			exchange: 'ASX',
			website: 'https://fortescue.com',
			description: 'Iron ore producer and green-hydrogen developer (Fortescue Energy).',
			pod: 'POD 1',
			aliases: ['Fortescue', 'Fortescue Metals', 'FMG']
		},
		{
			name: 'Woodside Energy',
			segment: 'energy_utilities',
			industry: 'Oil & Gas',
			country: 'Australia',
			ticker: 'WDS',
			exchange: 'ASX',
			website: 'https://www.woodside.com',
			description: 'Australia’s largest independent oil and gas producer.',
			pod: 'POD 2',
			aliases: ['Woodside Energy', 'Woodside']
		},
		{
			name: 'AGL Energy',
			segment: 'energy_utilities',
			industry: 'Electricity & Utilities',
			country: 'Australia',
			ticker: 'AGL',
			exchange: 'ASX',
			website: 'https://www.agl.com.au',
			description: 'Integrated electricity and gas retailer and generator.',
			pod: 'POD 2',
			aliases: ['AGL Energy', 'AGL']
		},
		{
			name: 'Origin Energy',
			segment: 'energy_utilities',
			industry: 'Electricity & Utilities',
			country: 'Australia',
			ticker: 'ORG',
			exchange: 'ASX',
			website: 'https://www.originenergy.com.au',
			description: 'Energy retailer and generator; LNG and renewables.',
			pod: 'POD 2',
			aliases: ['Origin Energy']
		},
		{
			name: 'SA Water',
			segment: 'water_environment',
			industry: 'Water Utility',
			country: 'Australia',
			website: 'https://www.sawater.com.au',
			description: 'South Australian government-owned water and wastewater utility.',
			pod: 'POD 3',
			aliases: ['SA Water'],
			searchTerms: ['South Australia']
		},
		{
			name: 'Sydney Water',
			segment: 'water_environment',
			industry: 'Water Utility',
			country: 'Australia',
			website: 'https://www.sydneywater.com.au',
			description: 'New South Wales government-owned water utility.',
			pod: 'POD 3',
			aliases: ['Sydney Water'],
			searchTerms: ['New South Wales']
		}
	],
	users: [
		{
			email: 'admin@cosol.in',
			fullName: 'Vishal',
			role: 'admin',
			pod: 'Leadership',
			title: 'Administrator'
		},
		{
			email: 'analyst.mining@cosol.in',
			fullName: 'Mining POD Analyst',
			role: 'member',
			pod: 'POD 1',
			title: 'Account Analyst'
		}
	]
};
