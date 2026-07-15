import type { ImpactKind, SignalType } from '$lib/watch/types';
import type { Account } from '../../db/schema';
import type { EnrichResult, Enricher, RawArticle } from '../types';

interface Rule {
	type: SignalType;
	impactLabel: string;
	impactKind: ImpactKind;
	kw: RegExp;
}

// Ordered by specificity — first match wins.
const RULES: Rule[] = [
	{
		type: 'budget_cut',
		impactLabel: 'Revenue Risk',
		impactKind: 'risk',
		kw: /budget cut|spending cut|cost cut|slash|layoff|redundan|writedown|impairment|austerity/i
	},
	{
		type: 'regulatory',
		impactLabel: 'Compliance Risk',
		impactKind: 'risk',
		kw: /regulat|complian|environmental (approval|requirement|breach)|permit|sanction|probe|investigation|fine[sd]?\b/i
	},
	{
		type: 'legal',
		impactLabel: 'Legal Risk',
		impactKind: 'risk',
		kw: /lawsuit|litigation|court|sued?|settlement|class action|allegation/i
	},
	{
		type: 'm_and_a',
		impactLabel: 'Portfolio Change',
		impactKind: 'neutral',
		kw: /merger|acquisition|acquire[sd]?|takeover|buyout|divest|demerger/i
	},
	{
		type: 'partnership',
		impactLabel: 'New Project',
		impactKind: 'opportunity',
		kw: /partnership|joint venture|\bjv\b|collaborat|alliance|teams? up|signs? (a )?deal/i
	},
	{
		type: 'contract',
		impactLabel: 'Upsell Opportunity',
		impactKind: 'opportunity',
		kw: /contract|tender|awarded|wins?|secures?|deal worth|framework agreement/i
	},
	{
		type: 'expansion',
		impactLabel: 'Upsell Opportunity',
		impactKind: 'opportunity',
		kw: /expansion|expand|new (mine|plant|facility|project|site)|invest(ment)?|ramp up|capacity|greenfield|scale up/i
	},
	{
		type: 'earnings',
		impactLabel: 'Renewal Strength',
		impactKind: 'opportunity',
		kw: /earnings|revenue|profit|results|guidance|dividend|half-year|full-year|ebitda|quarterly/i
	},
	{
		type: 'leadership',
		impactLabel: 'Stakeholder Change',
		impactKind: 'neutral',
		kw: /\bceo\b|\bcfo\b|chair(man|person)?|appoint|resign|steps? down|new (boss|head)|executive shake/i
	},
	{
		type: 'esg',
		impactLabel: 'ESG Signal',
		impactKind: 'neutral',
		kw: /emission|carbon|net zero|decarbon|renewable|green hydrogen|climate|sustainab|\besg\b/i
	},
	{
		type: 'product',
		impactLabel: 'Product Update',
		impactKind: 'neutral',
		kw: /launch|unveil|roll ?out|new (product|platform|technology|system)/i
	}
];

const POS =
	/\b(beat|record|surge|soar|jump|grow|growth|profit|win|wins|awarded|expand|approval|approved|strong|rise|rises|gain|gains|boost|upgrade|higher|success|milestone)\b/gi;
const NEG =
	/\b(cut|cuts|loss|losses|decline|fall|falls|drop|drops|risk|lawsuit|fine|fined|probe|delay|delayed|weak|concern|slump|down|impairment|redundan|halt|halted|warning|breach|shortfall)\b/gi;

function count(re: RegExp, s: string): number {
	return (s.match(re) ?? []).length;
}

function firstSentence(s: string, max = 140): string {
	const clean = s.replace(/\s+/g, ' ').trim();
	const m = clean.match(/^.*?[.!?](\s|$)/);
	const sentence = (m ? m[0] : clean).trim();
	return sentence.length > max ? sentence.slice(0, max - 1).trimEnd() + '…' : sentence;
}

const BIG_VALUE = /(\$|A\$|US\$|₹|€|£)\s?\d[\d,.]*\s?(m|bn|b|billion|million|cr|crore|trillion)\b/i;

/**
 * Keyword-based classifier — the no-key fallback. Deterministic and cheap; upgraded
 * to LLM classification when OPENROUTER_API_KEY is set.
 */
export const heuristicEnricher: Enricher = {
	name: 'heuristics',
	async enrich(_account: Account, article: RawArticle): Promise<EnrichResult> {
		const text = `${article.title}. ${article.summary ?? ''}`;
		const rule = RULES.find((r) => r.kw.test(text)) ?? {
			type: 'other' as SignalType,
			impactLabel: 'Market Signal',
			impactKind: 'neutral' as ImpactKind
		};

		const pos = count(POS, text);
		const neg = count(NEG, text);
		const raw = pos - neg;
		const sentimentScore = Math.max(-1, Math.min(1, raw / 3));
		const sentiment =
			sentimentScore > 0.15 ? 'bullish' : sentimentScore < -0.15 ? 'bearish' : 'neutral';

		const bigValue = BIG_VALUE.test(text);
		const isPriority =
			rule.impactKind === 'risk' || (rule.impactKind === 'opportunity' && bigValue);

		const detail = firstSentence(article.summary || article.title);

		return {
			detail,
			summary: article.summary ?? article.title,
			signalType: rule.type,
			impactLabel: rule.impactLabel,
			impactKind: rule.impactKind,
			sentiment,
			sentimentScore: Number(sentimentScore.toFixed(2)),
			isPriority,
			model: 'heuristics'
		};
	}
};
