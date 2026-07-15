/**
 * Download local account marks from the favicon published for each organisation's
 * official website. The UI serves these files locally and never depends on a logo
 * service at runtime.
 *
 * Run with: npx tsx scripts/fetch-account-logos.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';

const domains: Record<string, string> = {
	'bank-of-baroda': 'bankofbaroda.in',
	'bank-of-india': 'bankofindia.co.in',
	'central-bank-of-india': 'centralbankofindia.co.in',
	'karnataka-state-govt': 'karnataka.gov.in',
	'govt-led-educational-vertical': 'education.gov.in',
	'rbi-and-rbi-subsidiaries': 'rbi.org.in',
	'indian-bank': 'indianbank.in',
	'indian-overseas-bank': 'iob.in',
	'canara-bank': 'canarabank.com',
	'bank-of-maharashtra': 'bankofmaharashtra.in',
	'idbi-limited': 'idbibank.in',
	nimhans: 'nimhans.ac.in',
	nmdc: 'nmdc.co.in',
	'sbi-bank': 'sbi.co.in',
	'ubi-bank': 'unionbankofindia.co.in',
	'ministry-of-defence': 'mod.gov.in',
	'karnataka-bank-limited': 'karnatakabank.com',
	'nfsu-gfsu': 'nfsu.ac.in',
	'boi-mutual-fund': 'boimf.in',
	'lic-of-india': 'licindia.in',
	'saraswat-bank': 'www.saraswatbank.com',
	'shamrao-vittal-bank': 'www.svcbank.com',
	shcil: 'www.stockholding.com',
	'transunion-cibil': 'cibil.com',
	'unity-small-finance-bank': 'theunitybank.com',
	amicorp: 'amicorp.com',
	'anz-bank': 'anz.com',
	'collins-aerospace': 'collinsaerospace.com',
	fidelity: 'fidelity.com',
	inmobi: 'inmobi.com',
	'jc-penny': 'jcpenney.com',
	'mashreq-bank': 'mashreq.com',
	razorpay: 'razorpay.com',
	'ujjivan-bank': 'ujjivansfb.in',
	'varroc-india': 'varroc.com',
	jll: 'jll.com',
	'john-deere': 'deere.com',
	varian: 'siemens-healthineers.com',
	'bima-sugam': 'bimasugam.co.in',
	cipla: 'cipla.com',
	crisil: 'crisil.com',
	sunpharma: 'sunpharma.com',
	tcs: 'tcs.com',
	'sardar-vallabhai-patel-hospital': 'svphospital.com',
	'sbi-life-insurance': 'sbilife.co.in',
	apotex: 'apotex.com',
	'ac-nielsen': 'nielsen.com',
	'axis-bank-and-subsidiaries': 'axisbank.com',
	'bajaj-group': 'bajajgroup.company',
	capgemini: 'capgemini.com',
	'cholamandalam-group': 'cholamandalam.com',
	deloitte: 'deloitte.com',
	'fino-bank': 'finobank.com',
	'hdfc-bank': 'hdfcbank.com',
	'icici-bank': 'icicibank.com',
	'karnataka-energy-department': 'energy.karnataka.gov.in',
	'kddi-group': 'kddi.com',
	'publicis-groupe': 'publicisgroupe.com',
	'adani-group': 'adani.com',
	infineon: 'infineon.com',
	abb: 'global.abb',
	knauf: 'knauf.com',
	'kotak-group': 'kotak.com',
	mcx: 'mcxindia.com',
	nse: 'nseindia.com',
	'rbl-bank': 'rblbank.com',
	'resilire-group': 'resilire.com',
	'tata-electronics-pegatron': 'tataelectronics.com',
	tifr: 'www.tifr.res.in',
	'tata-group': 'tata.com',
	'tata-projects': 'tataprojects.com',
	'toyota-group': 'toyota.com',
	vertiv: 'vertiv.com',
	'yes-bank': 'yesbank.in',
	samsung: 'samsung.com',
	ey: 'ey.com',
	'ingersoll-rand-india': 'irco.com',
	'keppel-india': 'keppel.com',
	sagility: 'sagilityhealth.com',
	acuity: 'acuitykp.com',
	cummins: 'cummins.com',
	'delta-electronics': 'deltaww.com',
	dentsu: 'dentsu.com',
	lubrizol: 'lubrizol.com',
	vibracoustic: 'vibracoustic.com',
	'calderys-india': 'calderys.com',
	foxconn: 'honhai.com',
	'hinduja-group': 'hindujagroup.com',
	logicalis: 'logicalis.com',
	merck: 'merckgroup.com',
	pwc: 'pwc.in',
	'reliance-jio-radisys': 'jio.com',
	sony: 'sony.com',
	singtel: 'singtel.com',
	tkm: 'toyotabharat.com',
	'warnermedia-india': 'wbd.com',
	yuzhan: 'yuzenindia.com',
	baxter: 'baxter.in',
	foxlink: 'foxlink.com',
	hilton: 'hilton.com',
	'pi-industries': 'piindustries.com',
	vantiv: 'worldpay.com',
	blum: 'blum.com',
	'mann-and-hummel-india': 'mann-hummel.com',
	pouchen: 'pouchen.com',
	wittur: 'wittur.com',
	apnic: 'apnic.net',
	'ambit-group': 'ambit.co',
	azentio: 'azentio.com',
	bayer: 'bayer.com',
	championx: 'championx.com',
	cognizant: 'cognizant.com',
	'dyson-india': 'dyson.in',
	'firstsource-limited': 'www.firstsource.com',
	'general-atlantic': 'generalatlantic.com',
	'heraeus-india': 'heraeus.com',
	idfc: 'idfcfirstbank.com',
	iifl: 'iifl.com',
	iftas: 'iftasonline.com',
	'nuclear-power-corporation-npcil': 'npcil.nic.in',
	kseb: 'kseb.in',
	'iim-ahmedabad': 'iima.ac.in',
	infosys: 'infosys.com',
	'indusind-bank': 'indusind.com',
	'koch-industries': 'kochinc.com',
	microglobal: 'mgcorp.com',
	micron: 'micron.com',
	mondelez: 'mondelezinternational.com',
	'nuvama-edelweiss': 'nuvama.com',
	'parker-hannifin': 'parker.com',
	jsw: 'jsw.in',
	'bhp-group': 'bhp.com',
	'rio-tinto': 'riotinto.com',
	fortescue: 'fortescue.com',
	'woodside-energy': 'woodside.com',
	'agl-energy': 'agl.com.au',
	'origin-energy': 'originenergy.com.au',
	'sa-water': 'sawater.com.au',
	'sydney-water': 'sydneywater.com.au'
};

const outputDir = new URL('../static/account-logos/', import.meta.url);
await mkdir(outputDir, { recursive: true });

let cursor = 0;
let saved = 0;
let failed = 0;
const entries = Object.entries(domains);

async function worker() {
	while (cursor < entries.length) {
		const [slug, domain] = entries[cursor++];
		try {
			const source = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${domain}`)}&sz=256`;
			const response = await fetch(source, { signal: AbortSignal.timeout(15_000) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const bytes = Buffer.from(await response.arrayBuffer());
			if (bytes.length < 100) throw new Error('empty image');
			await writeFile(new URL(`${slug}.png`, outputDir), bytes);
			saved++;
			console.log(`saved  ${slug} (${domain})`);
		} catch (error) {
			failed++;
			console.warn(`failed ${slug} (${domain}): ${(error as Error).message}`);
		}
	}
}

await Promise.all(Array.from({ length: 8 }, worker));
console.log(`\nAccount logos: ${saved} saved, ${failed} failed`);
