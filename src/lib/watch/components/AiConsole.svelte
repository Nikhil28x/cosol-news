<script lang="ts">
	import { tick } from 'svelte';
	import { renderMarkdown } from '$lib/watch/markdown';

	interface Msg {
		role: 'user' | 'assistant';
		content: string;
		streaming?: boolean;
	}

	let {
		kb,
		suggestions
	}: { kb: { accounts: number; articles: number; sources: number }; suggestions: string[] } =
		$props();

	let messages = $state<Msg[]>([]);
	let input = $state('');
	let busy = $state(false);
	let thread: HTMLDivElement | null = $state(null);
	let controller: AbortController | null = null;

	async function scrollDown() {
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
	}

	async function ask(q: string) {
		const question = q.trim();
		if (!question || busy) return;
		input = '';
		busy = true;
		const history = messages.map((m) => ({ role: m.role, content: m.content }));
		messages.push({ role: 'user', content: question });
		messages.push({ role: 'assistant', content: '', streaming: true });
		// Hold the assistant message by reference so mutations stay safe even if the
		// messages array is reassigned mid-stream (e.g. "New chat").
		const assistant = messages[messages.length - 1];
		controller = new AbortController();
		const { signal } = controller;
		scrollDown();

		try {
			const res = await fetch('/watch/api/ask', {
				method: 'POST',
				signal,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ question, history })
			});
			if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			let buf = '';
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				const parts = buf.split('\n\n');
				buf = parts.pop() ?? '';
				for (const p of parts) {
					const line = p.trim();
					if (!line.startsWith('data:')) continue;
					let obj: { type: string; v?: string; message?: string };
					try {
						obj = JSON.parse(line.slice(5).trim());
					} catch {
						continue;
					}
					if (obj.type === 'delta') assistant.content += obj.v ?? '';
					else if (obj.type === 'error') assistant.content += `\n\n⚠️ ${obj.message}`;
				}
				scrollDown();
			}
		} catch (e) {
			if ((e as Error).name !== 'AbortError') {
				assistant.content += `\n\n⚠️ ${(e as Error).message}`;
			}
		} finally {
			assistant.streaming = false;
			busy = false;
			controller = null;
			scrollDown();
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		ask(input);
	}
	function reset() {
		controller?.abort(); // stop any in-flight stream cleanly
		messages = [];
		input = '';
	}
</script>

<div class="console">
	<div class="glow"></div>

	<header class="bar-top">
		<span class="brand">✦ Watch <b>AI</b></span>
		<span class="kb">
			{kb.accounts} accounts · {kb.articles.toLocaleString()} articles · {kb.sources} sources
			<span class="model">Gemini 2.5 Flash</span>
		</span>
		{#if messages.length}
			<button class="newchat" onclick={reset}>＋ New</button>
		{/if}
	</header>

	<div class="thread" bind:this={thread}>
		{#if messages.length === 0}
			<div class="hero">
				<h1>Ask your portfolio <span class="grad">anything</span>.</h1>
				<p>
					News, accounts, risks, opportunities, and your team — answered live from the knowledge
					base of every article we've collected.
				</p>
			</div>
		{:else}
			{#each messages as m, i (i)}
				{#if m.role === 'user'}
					<div class="row user"><div class="bubble">{m.content}</div></div>
				{:else}
					<div class="row ai">
						<div class="avatar">✦</div>
						<div class="answer">
							<div class="text md">{@html renderMarkdown(m.content)}</div>
							{#if m.streaming}<span class="caret"></span>{/if}
						</div>
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	{#if messages.length === 0}
		<div class="suggest">
			{#each suggestions as s (s)}
				<button type="button" onclick={() => ask(s)}>{s}</button>
			{/each}
		</div>
	{/if}

	<form class="prompt" onsubmit={submit}>
		<span class="prompt__spark">✦</span>
		<input
			bind:value={input}
			placeholder="Ask about any account, sector, risk, or your team…"
			autocomplete="off"
			disabled={busy}
		/>
		<button class="send" type="submit" disabled={busy || !input.trim()} aria-label="Send">
			{#if busy}<span class="spin"></span>{:else}➤{/if}
		</button>
	</form>
</div>

<style>
	.console {
		position: relative;
		border-radius: 20px;
		padding: 20px;
		min-height: calc(100dvh - 140px);
		display: flex;
		flex-direction: column;
		gap: 14px;
		color: #e8eefc;
		background:
			radial-gradient(1100px 500px at 78% -8%, rgba(14, 165, 183, 0.22), transparent 60%),
			radial-gradient(900px 500px at 10% 108%, rgba(59, 91, 219, 0.18), transparent 55%),
			linear-gradient(160deg, #0b1220 0%, #0a0f1c 60%, #070b14 100%);
		border: 1px solid rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}
	.glow {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
		background-size: 42px 42px;
		mask-image: radial-gradient(70% 60% at 50% 0%, #000, transparent 75%);
		pointer-events: none;
	}
	.console > :not(.glow) {
		position: relative;
		z-index: 1;
	}

	.bar-top {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.brand {
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #fff;
	}
	.brand b {
		color: #22d3ee;
	}
	.kb {
		font-size: 12px;
		color: #8ea3c4;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.model {
		background: rgba(34, 211, 238, 0.15);
		color: #67e8f9;
		border: 1px solid rgba(34, 211, 238, 0.3);
		border-radius: 999px;
		padding: 2px 9px;
		font-weight: 600;
	}
	.newchat {
		margin-left: auto;
		font-size: 12.5px;
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		padding: 5px 12px;
	}
	.newchat:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.thread {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 6px 2px;
		scrollbar-width: thin;
	}
	.hero {
		margin: auto 0;
		padding: 32px 8px;
		max-width: 680px;
	}
	.hero h1 {
		font-size: 40px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.05;
		color: #fff;
	}
	.grad {
		background: linear-gradient(90deg, #22d3ee, #6366f1);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.hero p {
		margin-top: 14px;
		color: #9fb2d4;
		font-size: 15px;
		line-height: 1.6;
		max-width: 60ch;
	}

	.row {
		display: flex;
		gap: 12px;
	}
	.row.user {
		justify-content: flex-end;
	}
	.bubble {
		background: linear-gradient(135deg, #1d4ed8, #0ea5b7);
		color: #fff;
		padding: 11px 15px;
		border-radius: 16px 16px 4px 16px;
		max-width: 78%;
		font-size: 14px;
		line-height: 1.5;
		box-shadow: 0 6px 20px rgba(14, 165, 183, 0.25);
	}
	.avatar {
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		display: grid;
		place-items: center;
		background: rgba(34, 211, 238, 0.16);
		border: 1px solid rgba(34, 211, 238, 0.3);
		color: #67e8f9;
		font-size: 15px;
	}
	.answer {
		min-width: 0;
		flex: 1;
		max-width: 80%;
	}
	.text {
		font-size: 14.5px;
		line-height: 1.7;
		color: #e8eefc;
	}
	/* rendered markdown (injected via {@html} → :global selectors) */
	.md :global(p) {
		margin: 0 0 10px;
	}
	.md :global(> :last-child) {
		margin-bottom: 0;
	}
	.md :global(strong) {
		color: #fff;
		font-weight: 700;
	}
	.md :global(em) {
		font-style: italic;
	}
	.md :global(h4),
	.md :global(h5),
	.md :global(h6) {
		font-size: 14.5px;
		font-weight: 700;
		color: #fff;
		margin: 16px 0 7px;
		letter-spacing: -0.01em;
	}
	.md :global(ul),
	.md :global(ol) {
		margin: 6px 0 12px;
		padding-left: 20px;
	}
	.md :global(ul) {
		list-style: disc;
	}
	.md :global(ol) {
		list-style: decimal;
	}
	.md :global(li) {
		margin: 4px 0;
	}
	.md :global(li)::marker {
		color: #67e8f9;
	}
	.md :global(code) {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 1px 5px;
		font-family: var(--mono);
		font-size: 0.9em;
	}
	.caret {
		display: inline-block;
		width: 8px;
		height: 16px;
		margin-left: 2px;
		background: #22d3ee;
		border-radius: 2px;
		vertical-align: text-bottom;
		animation: blink 1s steps(2) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	.suggest {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.suggest button {
		font-size: 12.5px;
		color: #cbd5e1;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		padding: 8px 14px;
		transition:
			background 0.15s,
			border-color 0.15s,
			transform 0.05s;
	}
	.suggest button:hover {
		background: rgba(34, 211, 238, 0.12);
		border-color: rgba(34, 211, 238, 0.4);
		color: #fff;
	}

	.prompt {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 8px 8px 16px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.14);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}
	.prompt:focus-within {
		border-color: rgba(34, 211, 238, 0.55);
		box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.14);
	}
	.prompt__spark {
		color: #22d3ee;
	}
	.prompt input {
		flex: 1;
		background: none;
		border: 0;
		outline: none;
		color: #fff;
		font-size: 15px;
	}
	.prompt input::placeholder {
		color: #7f93b5;
	}
	.send {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: grid;
		place-items: center;
		color: #04202a;
		font-size: 15px;
		background: linear-gradient(135deg, #22d3ee, #0ea5b7);
	}
	.send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.spin {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 0, 0, 0.3);
		border-top-color: #04202a;
		border-radius: 50%;
		animation: rot 0.7s linear infinite;
	}
	@keyframes rot {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.hero h1 {
			font-size: 30px;
		}
		.answer,
		.bubble {
			max-width: 100%;
		}
	}
</style>
