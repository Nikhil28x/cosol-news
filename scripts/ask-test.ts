/** End-to-end test of the AI assistant: retrieve → stream a grounded answer. */
import { retrieveContext } from '../src/lib/server/watch/data/knowledge';
import { streamChat, type ChatMessage } from '../src/lib/server/watch/agents/chat-stream';

const question =
	process.argv.slice(2).join(' ') || 'What are the biggest risks across the portfolio right now?';

const ctx = await retrieveContext(question, { limit: 30 });
console.log(`Q: ${question}`);
console.log(
	`retrieved: ${ctx.articles.length} articles · matched accounts: ${ctx.matchedAccounts.join(', ') || 'none'} · KB ${ctx.totals.accounts} accounts / ${ctx.users.length} users\n`
);

const accounts = ctx.accounts
	.map((a) => `- ${a.name} — ${a.segment}${a.pod ? ` — POD ${a.pod}` : ''}`)
	.join('\n');
const news = ctx.articles
	.map((a) => `- [${a.account}${a.date ? ` · ${a.date}` : ''}] ${a.title}`)
	.join('\n');
const messages: ChatMessage[] = [
	{
		role: 'system',
		content:
			'You are the COSOL Customer Watch intelligence assistant. Answer using ONLY the context. Name real accounts. Be concise.'
	},
	{ role: 'system', content: `ACCOUNTS:\n${accounts}\n\nRELEVANT NEWS:\n${news}` },
	{ role: 'user', content: question }
];

process.stdout.write('A: ');
for await (const delta of streamChat(messages)) process.stdout.write(delta);
console.log('\n');
process.exit(0);
