import { error } from '@sveltejs/kit';
import { retrieveContext, type KnowledgeContext } from '$lib/server/watch/data/knowledge';
import { streamChat, type ChatMessage } from '$lib/server/watch/agents/chat-stream';
import { searchGoogleNews } from '$lib/server/watch/agents/sources/google-news-rss';
import type { RequestHandler } from './$types';

const SYSTEM = `You are the Account Intel intelligence assistant — a sharp analyst for an admin monitoring the firm's customer accounts. Your knowledge base has ACCOUNTS (the tracked customers), the TEAM (internal PODs/owners who manage them), and recent NEWS collected about those accounts. For questions about companies OUTSIDE the tracked portfolio (prospects, competitors, any public company), you may also be given LIVE WEB NEWS from a fresh Google News search.

Be a genuinely useful analyst — concise, specific, analytical (short paragraphs, tight bullets; surface risks and opportunities):
- The tracked portfolio (ACCOUNTS / TEAM / NEWS) is your authoritative source. When referencing a tracked development, name the real account(s), and NEVER fabricate accounts, PODs, tickers, figures, or headlines for tracked customers.
- If the question is about a company that ISN'T a tracked account, that's fine — use the LIVE WEB NEWS provided and your own general knowledge to give useful background, clearly framing it as general market context rather than tracked-portfolio data.
- If neither the portfolio nor the live results fully cover something, say briefly what's missing, then still give whatever accurate, clearly-labelled context you can.
Do NOT refuse just because a company isn't in the knowledge base, and don't claim you "can't access external sites" — you have live news and general knowledge; use them.`;

// When the question is about a specific company, our priority is always the same:
// how is this company expanding/investing, what are its India-specific growth plans, and
// what is its financial output — because that is where we can win work. Every
// company/account answer is structured around those pillars.
const COMPANY_FORMAT = `RESPONSE FORMAT — this question is about a specific company. Our goal when researching ANY company is its expansion, investment, India-specific growth, and financial output (that's where we sell). Structure the answer EXACTLY like this, in order:

Open with a one-sentence bottom line on the company.

**🏗 Expansion & Investment** — new plants/facilities, capacity additions, capex, acquisitions, JVs, partnerships, major hiring.
**🇮🇳 India Growth Plans** — India-specific strategy, investments, market entry/expansion, localisation, government/regulatory moves.
**📊 Financial Output** — latest revenue, profit, earnings/results, margins and guidance — always include the figure and period when the sources have them.
**🎯 Our Angle** — one line: the concrete opportunity or risk this represents for us.

Rules: tight bullets under each heading; lead with the most material item; include real figures and dates from the NEWS / LIVE WEB NEWS (or clearly-labelled general knowledge). If a section has nothing, write "No recent signals." under it rather than padding. Never fabricate numbers, deals, or headlines.`;

function contextBlock(ctx: KnowledgeContext): string {
	const accounts = ctx.accounts
		.map(
			(a) =>
				`- ${a.name} — ${a.segment}${a.pod ? ` — POD ${a.pod}` : ''}${a.ticker ? ` (${a.ticker})` : ''}`
		)
		.join('\n');
	const team = ctx.users
		.map(
			(u) => `- ${u.name} — ${u.role}${u.pod ? ` — POD ${u.pod}` : ''} — ${u.accountCount} accounts`
		)
		.join('\n');
	const news = ctx.articles
		.map(
			(a) =>
				`- [${a.account}${a.date ? ` · ${a.date}` : ''}] ${a.title}${a.summary ? ` — ${a.summary}` : ''}`
		)
		.join('\n');

	return [
		`ACCOUNTS (${ctx.totals.accounts}):\n${accounts}`,
		`\nTEAM / PODs (${ctx.users.length}):\n${team}`,
		ctx.matchedAccounts.length
			? `\nAccounts named in the question: ${ctx.matchedAccounts.join(', ')}`
			: '',
		`\nRELEVANT NEWS (${ctx.articles.length} of ${ctx.totals.articles} matched):\n${news || '(no matching news)'}`
	]
		.filter(Boolean)
		.join('\n');
}

// Filler words to strip so a natural question becomes a usable news query.
const FILLER = new Set([
	'what',
	'whats',
	'is',
	'are',
	'was',
	'were',
	'the',
	'a',
	'an',
	'latest',
	'recent',
	'news',
	'on',
	'about',
	'happening',
	'with',
	'tell',
	'me',
	'get',
	'give',
	'show',
	'any',
	'info',
	'information',
	'please',
	'signals',
	'signal',
	'update',
	'updates',
	'from',
	'for',
	'of',
	'do',
	'does',
	'you',
	'know',
	'can',
	'could',
	'how',
	'doing',
	'their',
	'its',
	'and',
	'or',
	'in',
	'at',
	'to',
	'this',
	'that',
	'these',
	'those',
	'over',
	'last',
	'week',
	'month',
	'today',
	'right',
	'now',
	'whats',
	'going'
]);

/** Turn a natural question into a lean Google News query (drops URLs, TLDs, filler). */
function webQuery(q: string): string {
	const cleaned = q
		.replace(/https?:\/\/\S+/gi, ' ')
		.replace(/\b([a-z0-9][a-z0-9-]*)\.(?:com|in|co|net|org|io|ai|gov|edu)\b/gi, '$1')
		.replace(/[^\p{L}\p{N} ]+/gu, ' ');
	const words = cleaned.split(/\s+/).filter((w) => w.length >= 2 && !FILLER.has(w.toLowerCase()));
	return words.join(' ').trim();
}

// Question words that mean "the tracked book", not an external company — a question
// containing any of these stays in the portfolio (never triggers a web search).
const PORTFOLIO_WORDS = new Set([
	'portfolio',
	'accounts',
	'account',
	'customers',
	'customer',
	'clients',
	'client',
	'pod',
	'pods',
	'team',
	'sector',
	'sectors',
	'segment',
	'segments',
	'everyone',
	'book'
]);

interface LiveArticle {
	title: string;
	source: string | null;
	url: string;
	date: string | null;
}

// We care most about expansion, investment, India growth and financials — bias the
// live search toward those signals, then top up with the latest general news.
const SIGNAL_TERMS =
	'(expansion OR investment OR capex OR capacity OR factory OR plant OR acquisition OR partnership OR revenue OR profit OR earnings OR results OR guidance OR India OR "growth plans")';

/** Fresh Google News for a company outside the tracked portfolio (empty on failure).
 *  Runs a signal-biased search (expansion/investment/India/financials) plus a broad
 *  recent search, merged with the on-goal results first. */
async function fetchLiveNews(wq: string): Promise<LiveArticle[]> {
	const [focused, recent] = await Promise.all([
		searchGoogleNews(`${wq} ${SIGNAL_TERMS} when:150d`).catch(() => []),
		searchGoogleNews(`${wq} when:60d`).catch(() => [])
	]);
	const seen = new Set<string>();
	const out: LiveArticle[] = [];
	for (const a of [...focused, ...recent]) {
		if (seen.has(a.url)) continue;
		seen.add(a.url);
		out.push({
			title: a.title,
			source: a.source,
			url: a.url,
			date: a.publishedAt ? a.publishedAt.toISOString().slice(0, 10) : null
		});
		if (out.length >= 14) break;
	}
	return out;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') error(403, 'Admins only');

	const body = (await request.json().catch(() => ({}))) as {
		question?: string;
		history?: ChatMessage[];
	};
	const question = (body.question ?? '').trim();
	if (!question) error(400, 'question is required');

	const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
	const ctx = await retrieveContext(question, { limit: 40 });

	// When the question is about a company OUTSIDE the tracked portfolio (e.g. a prospect or
	// competitor like "Vodafone"), pull fresh Google News so the assistant answers with real,
	// current info instead of refusing it "can't access external sites". Gate tightly so
	// portfolio-wide questions ("risks across the book") keep using the knowledge base: no
	// tracked account matched, FTS found nothing, it reads like a short entity query, and it
	// doesn't reference the book itself.
	const wq = webQuery(question);
	const qTokens = new Set(
		question
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
	);
	const wqWords = wq ? wq.split(' ').length : 0;
	const needsWeb =
		ctx.matchedAccounts.length === 0 &&
		ctx.matchedNews < 3 &&
		wqWords >= 1 &&
		wqWords <= 4 &&
		![...PORTFOLIO_WORDS].some((w) => qTokens.has(w));
	const live = needsWeb ? await fetchLiveNews(wq) : [];

	const liveBlock = live.length
		? 'LIVE WEB NEWS (fresh Google News for a company outside the tracked portfolio):\n' +
			live
				.map((a) => `- [${a.source ?? 'web'}${a.date ? ` · ${a.date}` : ''}] ${a.title}`)
				.join('\n')
		: '';

	// A specific company is the subject when a tracked account matched or we ran a web
	// search for an off-portfolio company — apply the expansion/India/financials structure.
	const isCompanyQuery = ctx.matchedAccounts.length > 0 || needsWeb;

	const messages: ChatMessage[] = [
		{ role: 'system', content: SYSTEM },
		{ role: 'system', content: `KNOWLEDGE BASE\n${contextBlock(ctx)}` },
		...(liveBlock ? [{ role: 'system', content: liveBlock } as ChatMessage] : []),
		...(isCompanyQuery ? [{ role: 'system', content: COMPANY_FORMAT } as ChatMessage] : []),
		...history.filter((m) => m.role === 'user' || m.role === 'assistant'),
		{ role: 'user', content: question }
	];

	const sources = ctx.articles.slice(0, 8).map((a) => ({
		title: a.title,
		account: a.account,
		accountSlug: a.accountSlug,
		segment: a.segment,
		url: a.url,
		date: a.date
	}));

	const stream = new ReadableStream({
		async start(controller) {
			const enc = new TextEncoder();
			const send = (obj: unknown) =>
				controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
			send({ type: 'sources', sources, matched: ctx.matchedAccounts });
			try {
				for await (const delta of streamChat(messages)) send({ type: 'delta', v: delta });
			} catch (e) {
				send({ type: 'error', message: (e as Error).message });
			}
			send({ type: 'done' });
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive'
		}
	});
};
