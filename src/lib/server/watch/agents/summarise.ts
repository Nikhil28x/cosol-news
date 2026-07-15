/**
 * Gemini (via OpenRouter) summarisation over the news knowledge base.
 *
 * Two shapes:
 *  - summariseDashboard(sectors)  → portfolio summary + per-sector summary/signals/sentiment
 *  - summariseAccount(account)    → a single account's digest
 *
 * The model reads already-fetched RSS news (no per-item AI at ingest time). All output
 * is strict JSON, tolerantly parsed and normalised to known enums.
 */
import type { ImpactKind, Sentiment } from '$lib/watch/types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface SectorInput {
	key: string;
	label: string;
	items: { account: string; title: string; date: string | null }[];
}

export interface AccountInput {
	name: string;
	segment: string;
	items: { title: string; source: string | null; date: string | null }[];
}

export interface DashboardSummary {
	portfolioSummary: string;
	portfolioSentiment: Sentiment;
	sectors: {
		key: string;
		label: string;
		summary: string;
		sentiment: Sentiment;
		sentimentScore: number;
		signals: { headline: string; account: string; kind: ImpactKind }[];
	}[];
	model: string;
}

export interface AccountSummary {
	summary: string;
	sentiment: Sentiment;
	sentimentScore: number;
	signals: { headline: string; account: string; kind: ImpactKind }[];
	model: string;
}

// ---- helpers ----
function parseJson(content: string): Record<string, unknown> {
	let s = content.trim();
	const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence) s = fence[1].trim();
	try {
		return JSON.parse(s);
	} catch {
		const a = s.indexOf('{');
		const b = s.lastIndexOf('}');
		if (a !== -1 && b > a) return JSON.parse(s.slice(a, b + 1));
		throw new Error('no JSON object in model output');
	}
}

const clampScore = (n: unknown, fb: number) => {
	const v = Number(n);
	return Number.isNaN(v) ? fb : Math.max(-1, Math.min(1, v));
};
const normKind = (v: unknown): ImpactKind => {
	const s = String(v ?? '').toLowerCase();
	return s === 'opportunity' || s === 'risk' ? (s as ImpactKind) : 'neutral';
};
const normSentiment = (v: unknown): Sentiment => {
	const s = String(v ?? '').toLowerCase();
	return s === 'bullish' || s === 'bearish' ? (s as Sentiment) : 'neutral';
};
const scoreFor = (s: Sentiment) => (s === 'bullish' ? 0.5 : s === 'bearish' ? -0.5 : 0);

async function chat(
	system: string,
	user: string,
	maxTokens = 4000
): Promise<{ raw: Record<string, unknown>; model: string }> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
	const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 90_000);
	try {
		const res = await fetch(ENDPOINT, {
			method: 'POST',
			signal: ctrl.signal,
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json',
				'HTTP-Referer': 'https://cosol.in',
				'X-Title': 'COSOL Customer Watch'
			},
			body: JSON.stringify({
				model,
				temperature: 0.3,
				max_tokens: maxTokens,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user }
				]
			})
		});
		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
		const data = await res.json();
		const content = data?.choices?.[0]?.message?.content;
		if (!content) throw new Error('OpenRouter returned no content');
		return { raw: parseJson(content), model };
	} finally {
		clearTimeout(timer);
	}
}

const DASHBOARD_SYSTEM = `You are a senior account-intelligence analyst at COSOL (a B2B enterprise technology and services firm). You are given recent news headlines about the customer accounts a COSOL account manager is responsible for, grouped by sector. Produce an executive briefing.

Return ONLY a JSON object:
{
  "portfolio_summary": "2-3 sentence overview across ALL sectors of what matters most this period",
  "portfolio_sentiment": "bullish" | "neutral" | "bearish",
  "sectors": [
    {
      "key": "<the exact sector key given>",
      "summary": "2-4 sentences on what's happening across these accounts",
      "sentiment": "bullish" | "neutral" | "bearish",
      "sentiment_score": <number -1..1>,
      "signals": [
        { "headline": "<short, specific signal>", "account": "<account name>", "kind": "opportunity" | "risk" | "neutral" }
      ]
    }
  ]
}
Rules: use ONLY the sector keys provided; at most 5 signals per sector, most material first; signals must be grounded in the provided headlines (name the real account). Be concise and specific — no filler.`;

const ACCOUNT_SYSTEM = `You are a senior account-intelligence analyst at COSOL. Given recent news headlines about ONE customer account, write a briefing.

Return ONLY a JSON object:
{
  "summary": "3-5 sentences: what's happening with this account and why it matters to COSOL",
  "sentiment": "bullish" | "neutral" | "bearish",
  "sentiment_score": <number -1..1>,
  "signals": [ { "headline": "<short signal>", "account": "<account name>", "kind": "opportunity" | "risk" | "neutral" } ]
}
At most 6 signals, most material first, grounded in the headlines. Be concise and specific.`;

export async function summariseDashboard(sectors: SectorInput[]): Promise<DashboardSummary> {
	const byKey = new Map(sectors.map((s) => [s.key, s.label]));
	const lines: string[] = [];
	for (const s of sectors) {
		lines.push(`SECTOR ${s.key} — ${s.label}:`);
		for (const it of s.items.slice(0, 25)) {
			lines.push(`- [${it.account}] ${it.title}${it.date ? ` (${it.date})` : ''}`);
		}
		lines.push('');
	}

	// Large portfolios (admin: 8 sectors × signals) need headroom or the JSON truncates.
	const { raw, model } = await chat(DASHBOARD_SYSTEM, lines.join('\n'), 6000);
	const rawSectors = Array.isArray(raw.sectors) ? (raw.sectors as Record<string, unknown>[]) : [];

	return {
		portfolioSummary: String(raw.portfolio_summary ?? '').slice(0, 900),
		portfolioSentiment: normSentiment(raw.portfolio_sentiment),
		model,
		sectors: rawSectors
			.filter((s) => byKey.has(String(s.key)))
			.map((s) => {
				const sentiment = normSentiment(s.sentiment);
				const rawSignals = Array.isArray(s.signals) ? (s.signals as Record<string, unknown>[]) : [];
				return {
					key: String(s.key),
					label: byKey.get(String(s.key))!,
					summary: String(s.summary ?? '').slice(0, 800),
					sentiment,
					sentimentScore: Number(clampScore(s.sentiment_score, scoreFor(sentiment)).toFixed(2)),
					signals: rawSignals.slice(0, 5).map((g) => ({
						headline: String(g.headline ?? '').slice(0, 180),
						account: String(g.account ?? '').slice(0, 80),
						kind: normKind(g.kind)
					}))
				};
			})
	};
}

export async function summariseAccount(input: AccountInput): Promise<AccountSummary> {
	const lines = input.items
		.slice(0, 30)
		.map((it) => `- ${it.title}${it.date ? ` (${it.date})` : ''}`);
	const user = `Account: ${input.name}\nSector: ${input.segment}\nRecent news:\n${lines.join('\n')}`;

	const { raw, model } = await chat(ACCOUNT_SYSTEM, user, 1800);
	const sentiment = normSentiment(raw.sentiment);
	const rawSignals = Array.isArray(raw.signals) ? (raw.signals as Record<string, unknown>[]) : [];
	return {
		summary: String(raw.summary ?? '').slice(0, 1200),
		sentiment,
		sentimentScore: Number(clampScore(raw.sentiment_score, scoreFor(sentiment)).toFixed(2)),
		model,
		signals: rawSignals.slice(0, 6).map((g) => ({
			headline: String(g.headline ?? '').slice(0, 180),
			account: input.name,
			kind: normKind(g.kind)
		}))
	};
}
