/**
 * Build data/seed.json from the POD account list.
 *   npx tsx scripts/build-seed.ts
 *
 * Each source line is "<OWNER> <ACCOUNT>" (owner is a single token, so a tab or
 * spaces both parse). Owners become member users; accounts are tagged to the owner's
 * POD and classified into a segment. An admin (vishal@cosol.in) is added.
 */
import { writeFileSync } from 'node:fs';
import { classifyAccountSegment } from '../src/lib/watch/segments';

const RAW = `
ASHWINI	BANK OF BARODA
ASHWINI	BANK OF INDIA
ASHWINI	CENTRAL BANK OF INDIA
ASHWINI	KARNATAKA STATE GOVT
ASHWINI	GOVT LED EDUCATIONAL VERTICAL
ASHWINI	RBI AND RBI SUBSIDIARIES
ASHWINI	INDIAN BANK
ASHWINI	INDIAN OVERSEAS BANK
ASHWINI	CANARA BANK
ASHWINI	BANK OF MAHARASHTRA
ASHWINI	IDBI LIMITED
ASHWINI	NIMHANS
ASHWINI	NMDC
ASHWINI	SBI Bank
ASHWINI	UBI Bank
ASHWINI	Ministry of Defence
SHRUTHI	KARNATAKA BANK LIMITED
OJAS	NFSU/GFSU
OJAS	BOI MUTUAL FUND
OJAS	LIC OF INDIA
OJAS	SARASWAT BANK
OJAS	SHAMRAO VITTAL BANK
OJAS	SHCIL
OJAS	TRANSUNION CIBIL
OJAS	Unity Small Finance Bank
OJAS	AMICORP
OJAS	ANZ Bank
OJAS	COLLINS AEROSPACE
OJAS	FIDELITY
OJAS	INMOBI
OJAS	JC PENNY
OJAS	MASHREQ BANK
OJAS	RAZORPAY
OJAS	Ujjivan Bank
OJAS	VARROC INDIA
OJAS	JLL
OJAS	John Deere
OJAS	VARIAN
OJAS	BIMA SUGAM
OJAS	Cipla
OJAS	CRISIL
OJAS	SUNPHARMA
OJAS	TCS
OJAS	SARDAR VALLABHAI PATEL HOSPITAL
ASHWINI	SBI LIFE INSURANCE
SHRUTHI	APOTEX
SOWMYA	AC NIELSEN
SHRUTHI	AXIS BANK AND SUBSIDIARIES
SHRUTHI	BAJAJ GROUP
SHRUTHI	CAPGEMINI
SHRUTHI	Cholamandalam Group
SOWMYA	DELOITTE
SHRUTHI	Fino Bank
SHRUTHI	HDFC BANK
SHRUTHI	ICICI Bank
SHRUTHI	KARNATAKA ENERGY DEPARTMENT
OJAS	KDDI GROUP
OJAS	PUBLICIS GROUPE
OJAS	ADANI GROUP
OJAS	Infineon
OJAS	ABB
SHRUTHI	KNAUF
SHRUTHI	KOTAK GROUP
SHRUTHI	MCX
SHRUTHI	NSE
SHRUTHI	RBL Bank
SHRUTHI	RESILIRE GROUP
SOWMYA	TATA ELECTRONICS//PEGATRON
SHRUTHI	TIFR
SHRUTHI	TATA GROUP
SOWMYA	TATA Projects
SHRUTHI	Toyota Group
SHRUTHI	Vertiv
SHRUTHI	YES BANK
SOWMYA	SAMSUNG
SOWMYA	EY
SHRUTHI	Ingersoll-Rand India
SHRUTHI	KEPPEL INDIA
SOWMYA	SAGILITY
SOWMYA	ACUITY
SOWMYA	CUMMINS
SOWMYA	Delta Electronics
SOWMYA	Dentsu
SOWMYA	LUBRIZOL
OJAS	Vibracoustic
SOWMYA	Calderys India
SOWMYA	Foxconn
SOWMYA	HINDUJA GROUP
SOWMYA	LOGICALIS
SOWMYA	MERCK
SOWMYA	PWC
SOWMYA	RELIANCE JIO/RADISYS
SOWMYA	SONY
SOWMYA	SINGTEL
SOWMYA	TKM
SOWMYA	WarnerMedia India
SOWMYA	YUZHAN
SOWMYA	Baxter
SOWMYA	Foxlink
SOWMYA	Hilton
SHRUTHI	PI Industries
SOWMYA	Vantiv
SOWMYA1	BLUM
SOWMYA1	Mann & Hummel India
SOWMYA1	POUCHEN
SOWMYA1	Wittur
SOWMYA1	APNIC
SHRUTHI	AMBIT GROUP
SOWMYA1	AZENTIO
SOWMYA1	Bayer
SOWMYA1	ChampionX
SOWMYA1	Cognizant
SOWMYA1	Dyson India
SHRUTHI	FIRSTSOURCE LIMITED
SOWMYA1	General Atlantic
SOWMYA1	Heraeus India
SHRUTHI	IDFC
SHRUTHI	IIFL
ASHWINI	IFTAS
ASHWINI	Nuclear Power Corporation (NPCIL)
ASHWINI	KSEB
ASHWINI	IIM Ahmedabad
SOWMYA1	INFOSYS
SHRUTHI	Indusind Bank
SOWMYA1	KOCH Industries
SOWMYA1	Microglobal
SOWMYA1	Micron
SOWMYA1	Mondelez
SHRUTHI	Nuvama/ Edelweiss
SOWMYA1	Parker Hannifin
SOWMYA1	JSW
`;

interface Row {
	owner: string;
	name: string;
}

const rows: Row[] = RAW.trim()
	.split('\n')
	.map((line) => {
		const m = line.trim().match(/^(\S+)\s+(.+)$/);
		return m ? { owner: m[1].trim(), name: m[2].trim() } : null;
	})
	.filter((r): r is Row => Boolean(r && r.name));

// Dedupe accounts by name (first owner wins)
const seen = new Map<string, Row>();
for (const r of rows) {
	const key = r.name.toLowerCase();
	if (!seen.has(key)) seen.set(key, r);
}

const accounts = [...seen.values()].map((r) => ({
	name: r.name,
	segment: classifyAccountSegment(r.name),
	pod: r.owner,
	country: 'India',
	aliases: [r.name]
}));

const owners = [...new Set(rows.map((r) => r.owner))];
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const emailFor = (owner: string) => owner.toLowerCase().replace(/[^a-z0-9]/g, '') + '@cosol.in';

const users = [
	{
		email: 'admin@cosol.in',
		fullName: 'Vishal',
		role: 'admin',
		pod: 'Leadership',
		title: 'Administrator'
	},
	...owners.map((o) => ({
		email: emailFor(o),
		fullName: titleCase(o),
		role: 'member',
		pod: o,
		title: 'Account Manager'
	}))
];

writeFileSync('data/seed.json', JSON.stringify({ accounts, users }, null, 2));

const dist: Record<string, number> = {};
for (const a of accounts) dist[a.segment] = (dist[a.segment] ?? 0) + 1;
console.log(`Wrote data/seed.json: ${accounts.length} accounts, ${users.length} users`);
console.log('Segments:', dist);
console.log(
	'PODs:',
	owners.map((o) => `${o}:${accounts.filter((a) => a.pod === o).length}`).join('  ')
);
