/** Streaming chat completions via OpenRouter (Gemini 2.5 Flash). Yields text deltas. */
export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export async function* streamChat(
	messages: ChatMessage[],
	opts: { temperature?: number; maxTokens?: number } = {}
): AsyncGenerator<string> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');
	const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${apiKey}`,
			'content-type': 'application/json',
			'HTTP-Referer': 'https://cosol.in',
			'X-Title': 'COSOL Customer Watch'
		},
		body: JSON.stringify({
			model,
			temperature: opts.temperature ?? 0.4,
			max_tokens: opts.maxTokens ?? 1200,
			stream: true,
			messages
		})
	});
	if (!res.ok || !res.body) {
		throw new Error(
			`OpenRouter ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`
		);
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) {
			const t = line.trim();
			if (!t.startsWith('data:')) continue; // skip SSE comments / keep-alives
			const data = t.slice(5).trim();
			if (data === '[DONE]') return;
			try {
				const json = JSON.parse(data);
				const delta = json.choices?.[0]?.delta?.content;
				if (typeof delta === 'string' && delta) yield delta;
			} catch {
				/* partial JSON across chunks — ignore, next read completes it */
			}
		}
	}
}
