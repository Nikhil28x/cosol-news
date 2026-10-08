/**
 * Canonical customer segments — the sidebar taxonomy for the portfolio
 * (India BFSI / government / technology / manufacturing / pharma / services).
 * Segment keys are stored on `accounts.segment`; `classifyAccountSegment()` derives
 * one from an account name at seed time (see scripts/build-seed.ts).
 */

export interface SegmentDef {
	key: string;
	label: string;
	icon: string;
	/** CSS custom-property accent used by chips/bars (see watch.css). */
	accent: string;
}

export const SEGMENTS: SegmentDef[] = [
	{ key: 'financial_services', label: 'Financial Services', icon: '🏦', accent: 'var(--seg-blue)' },
	{
		key: 'government_public',
		label: 'Government & Public Sector',
		icon: '🏛️',
		accent: 'var(--seg-purple)'
	},
	{ key: 'technology', label: 'Technology & IT', icon: '💻', accent: 'var(--seg-cyan)' },
	{
		key: 'manufacturing',
		label: 'Manufacturing & Industrial',
		icon: '🏭',
		accent: 'var(--seg-slate)'
	},
	{
		key: 'pharma_healthcare',
		label: 'Pharma & Healthcare',
		icon: '⚕️',
		accent: 'var(--seg-green)'
	},
	{
		key: 'professional_services',
		label: 'Consulting & Services',
		icon: '📊',
		accent: 'var(--seg-amber)'
	},
	{ key: 'telecom_media', label: 'Telecom & Media', icon: '📡', accent: 'var(--seg-yellow)' },
	{ key: 'other', label: 'Other', icon: '🏢', accent: 'var(--seg-gray)' }
];

const SEGMENT_MAP = new Map(SEGMENTS.map((s) => [s.key, s]));

export function segmentDef(key: string | null | undefined): SegmentDef {
	return (key && SEGMENT_MAP.get(key)) || SEGMENT_MAP.get('other')!;
}

// Ordered classification rules — first match wins (specific → general).
const RULES: { key: string; re: RegExp }[] = [
	{
		key: 'government_public',
		re: /\bgovt\b|government|ministry|defen[cs]e|\bnpcil\b|nuclear power|\bkseb\b|energy department|\biim\b|\btifr\b|\bnmdc\b|\bnfsu\b|\bgfsu\b|\biftas\b|state govt|reserve bank|\brbi\b/i
	},
	{
		key: 'pharma_healthcare',
		re: /cipla|sun\s?pharma|apotex|\bmerck\b|bayer|baxter|varian|\bpharma\b|hospital|health|nimhans|\bcipla\b/i
	},
	{
		key: 'financial_services',
		re: /\bbank\b|\bsbi\b|\bubi\b|\brbl\b|\bidbi\b|\bidfc\b|\biifl\b|canara|indian overseas|maharashtra|karnataka bank|saraswat|shamrao|small finance|ujjivan|\bfino\b|indusind|\baxis\b|\bhdfc\b|icici|kotak|yes bank|insurance|\blic\b|mutual fund|\bmcx\b|\bnse\b|cibil|transunion|shcil|crisil|edelweiss|nuvama|cholamandalam|\bbajaj\b|ambit|amicorp|general atlantic|vantiv|razorpay|mashreq|\banz\b|bima|fidelity|sbi/i
	},
	{
		key: 'telecom_media',
		re: /singtel|\bjio\b|radisys|\bkddi\b|telecom|\bsony\b|warnermedia/i
	},
	{
		key: 'professional_services',
		re: /deloitte|\bey\b|\bpwc\b|\bkpmg\b|nielsen|dentsu|publicis|\bjll\b|consult|advisory|firstsource|sagility|acuity/i
	},
	{
		key: 'technology',
		re: /\btcs\b|infosys|cognizant|capgemini|inmobi|\bmicron\b|infineon|azentio|logicalis|microglobal|apnic|semiconductor|software|\bit\b|digital/i
	},
	{
		key: 'manufacturing',
		re: /electronics|foxconn|pegatron|foxlink|cummins|parker|john deere|vertiv|knauf|calderys|vibracoustic|hummel|\bblum\b|wittur|pouchen|delta|ingersoll|varroc|\bjsw\b|\babb\b|championx|\bkoch\b|toyota|\btkm\b|samsung|hinduja|keppel|pi industries|dyson|collins aerospace|heraeus|mondelez|lubrizol|yuzhan|\bmann\b|adani|\btata\b|reliance|vibra|micron|steel|motors?|automotive|industr|manufactur/i
	}
];

/** Best-effort segment for an account name. Falls back to 'other'. */
export function classifyAccountSegment(name: string): string {
	for (const r of RULES) if (r.re.test(name)) return r.key;
	return 'other';
}
