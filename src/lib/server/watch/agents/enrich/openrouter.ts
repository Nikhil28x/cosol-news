import { SIGNAL_TYPES, type ImpactKind, type Sentiment, type SignalType } from '$lib/watch/types';
import { segmentDef } from '$lib/watch/segments';
import type { Account } from '../../db/schema';
import type { EnrichResult, Enricher, RawArticle } from '../types';
import { heuristicEnricher } from './heuristics';

const SIGNAL_KEYS = new Set(Object.keys(SIGNAL_TYPES));
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM = `You are an analyst for a B2B asset-management and enterprise technology services firm. You monitor news about the firm's customer accounts and classify each item for an account-intelligence dashboard.

Return ONLY a JSON object with these fields:
- "detail": string, <= 120 chars, a crisp present-tense summary of what happened (no trailing publisher name).
- "summary": string, 1-2 sentences of context.
- "signal_type": one of ["expansion","regulatory","earnings","partnership","leadership","m_and_a","product","financial","legal","esg","contract","budget_cut","other"].
- "impact_label": 2-3 words naming the impact to the firm's relationship, e.g. "Upsell Opportunity", "Compliance Risk", "Revenue Risk", "New Project", "Renewal Strength".
- "impact_kind": one of ["opportunity","risk","neutral"] (how it affects the firm's account).
- "sentiment": one of ["bullish","neutral","bearish"] (outlook for the customer).
- "sentiment_score": number from -1 (very negative) to 1 (very positive).
- "is_priority": boolean, true only when materially important or time-sensitive (big deals, contract risk, leadership change, regulatory action).`;

function clampScore(n: unknown, fallback: number): number {
	const v = Number(n);
	if (Number.isNaN(v)) return fallback;
	return Math.max(-1, Math.min(1, v));
}

function normalizeSignal(v: unknown): SignalType {
	let s = String(v ?? '')
		.toLowerCase()
		.trim()
		.replace(/[\s&/-]+/g, '_');
	if (s === 'm_a' || s === 'manda' || s === 'm_and_a') s = 'm_and_a';
	if (s === 'mergers_acquisitions') s = 'm_and_a';
	return (SIGNAL_KEYS.has(s) ? s : 'other') as SignalType;
}

function normalizeKind(v: unknown): ImpactKind {
	const s = String(v ?? '').toLowerCase();
	return s === 'opportunity' || s === 'risk' ? (s as ImpactKind) : 'neutral';
}

function normalizeSentiment(v: unknown): Sentiment {
	const s = String(v ?? '').toLowerCase();
	return s === 'bullish' || s === 'bearish' ? (s as Sentiment) : 'neutral';
}

/** Robust JSON parse: tolerates ```json fences or leading/trailing prose. */
function parseJson(content: string): Record<string, unknown> {
	let s = content.trim();
	const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence) s = fence[1].trim();
	try {
		return JSON.parse(s);
	} catch {
		const start = s.indexOf('{');
		const end = s.lastIndexOf('}');
		if (start !== -1 && end > start) return JSON.parse(s.slice(start, end + 1));
		throw new Error('no JSON object in model output');
	}
}

async function classify(account: Account, article: RawArticle, apiKey: string, model: string) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 30_000);
	try {
		const user = [
			`Account: ${account.name}${account.legalName ? ` (${account.legalName})` : ''}`,
			`Segment: ${segmentDef(account.segment).label}${account.industry ? ` / ${account.industry}` : ''}`,
			account.country ? `Country: ${account.country}` : '',
			`Headline: ${article.title}`,
			article.summary ? `Snippet: ${article.summary}` : '',
			article.publishedAt ? `Published: ${article.publishedAt.toISOString().slice(0, 10)}` : ''
		]
			.filter(Boolean)
			.join('\n');

		const res = await fetch(ENDPOINT, {
			method: 'POST',
			signal: ctrl.signal,
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json',
				'X-Title': 'Account Intel'
			},
			body: JSON.stringify({
				model,
				temperature: 0.2,
				max_tokens: 500,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: SYSTEM },
					{ role: 'user', content: user }
				]
			})
		});

		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
		const data = await res.json();
		const content = data?.choices?.[0]?.message?.content;
		if (!content) throw new Error('OpenRouter returned no content');
		const raw = parseJson(content);

		const impactKind = normalizeKind(raw.impact_kind);
		const sentiment = normalizeSentiment(raw.sentiment);
		const fallbackScore = sentiment === 'bullish' ? 0.5 : sentiment === 'bearish' ? -0.5 : 0;
		const detail = String(raw.detail ?? article.title).slice(0, 160);

		const result: EnrichResult = {
			detail,
			summary: String(raw.summary ?? article.summary ?? article.title).slice(0, 600),
			signalType: normalizeSignal(raw.signal_type),
			impactLabel:
				String(raw.impact_label ?? '')
					.trim()
					.slice(0, 40) ||
				(impactKind === 'risk'
					? 'Account Risk'
					: impactKind === 'opportunity'
						? 'Opportunity'
						: 'Market Signal'),
			impactKind,
			sentiment,
			sentimentScore: Number(clampScore(raw.sentiment_score, fallbackScore).toFixed(2)),
			isPriority: Boolean(raw.is_priority),
			model
		};
		return result;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * LLM enricher via OpenRouter (OpenAI-compatible). Falls back to the deterministic
 * heuristic classifier if the key is missing or any request/parse step fails, so
 * ingestion never blocks on the LLM.
 */
export const openRouterEnricher: Enricher = {
	name: 'openrouter',
	async enrich(account: Account, article: RawArticle): Promise<EnrichResult> {
		const apiKey = process.env.OPENROUTER_API_KEY;
		if (!apiKey) return heuristicEnricher.enrich(account, article);
		const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
		try {
			return await classify(account, article, apiKey, model);
		} catch (err) {
			console.warn(`[enrich] OpenRouter failed, using heuristics: ${(err as Error).message}`);
			return heuristicEnricher.enrich(account, article);
		}
	}
};
