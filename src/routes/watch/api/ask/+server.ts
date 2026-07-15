import { error } from '@sveltejs/kit';
import { retrieveContext, type KnowledgeContext } from '$lib/server/watch/data/knowledge';
import { streamChat, type ChatMessage } from '$lib/server/watch/agents/chat-stream';
import type { RequestHandler } from './$types';

const SYSTEM = `You are the COSOL Customer Watch intelligence assistant — a sharp analyst for an admin monitoring the firm's customer accounts. You have a knowledge base of ACCOUNTS (the customers), the TEAM (internal PODs/owners who manage them), and recent NEWS collected about the accounts.

Answer the admin's question using ONLY the provided context. Be concise, specific and analytical:
- Name the real account(s) when referencing a development.
- Prefer short paragraphs and tight bullet points.
- Surface risks and opportunities explicitly when relevant.
- If the answer isn't in the context, say what's missing rather than inventing.
Never fabricate accounts, numbers, or headlines that aren't in the context.`;

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

	const messages: ChatMessage[] = [
		{ role: 'system', content: SYSTEM },
		{ role: 'system', content: `KNOWLEDGE BASE\n${contextBlock(ctx)}` },
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
