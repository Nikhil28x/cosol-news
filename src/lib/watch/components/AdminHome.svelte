<!--
	Admin workspace home — the dashboard admins land on.

	Two views, one component:
	  home — soft gradient hero (greeting, headline, ask prompt, suggested questions,
	         quick actions), a row of KPI tiles, then recent activity beside sector coverage.
	  chat — asking a question swaps the page for a full-height conversation surface:
	         header, scrolling thread, and a composer pinned at the bottom. The composer is
	         never disabled, so a follow-up can be typed while the answer is still streaming;
	         the send button becomes a stop button for the duration. "← Dashboard" returns
	         home with the conversation kept; "＋ New chat" clears it.

	Palette, radii and type all come from watch.css tokens (Inter, navy ink, teal accent).
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { renderMarkdown } from '$lib/watch/markdown';
	import { relativeTime } from '$lib/watch/format';
	import type { DashboardCounts, FeedItem } from '$lib/watch/types';
	import Monogram from './Monogram.svelte';

	interface Source {
		title: string;
		account: string | null;
		url: string;
		date?: string | null;
	}

	interface Msg {
		role: 'user' | 'assistant';
		content: string;
		streaming?: boolean;
		/** Articles the answer was grounded in (streamed by /watch/api/ask). */
		sources?: Source[];
	}

	let {
		firstName,
		counts,
		recent,
		kb,
		suggestions
	}: {
		firstName: string;
		counts: DashboardCounts;
		recent: FeedItem[];
		kb: { accounts: number; articles: number; sources: number };
		suggestions: string[];
	} = $props();

	let messages = $state<Msg[]>([]);
	let input = $state('');
	let busy = $state(false);
	/** 'home' = workspace overview, 'chat' = full conversation surface. */
	let view = $state<'home' | 'chat'>('home');
	let thread: HTMLDivElement | null = $state(null);
	let inputEl: HTMLInputElement | null = $state(null);
	let controller: AbortController | null = null;

	// Client-only so SSR and hydration can't disagree on the hour.
	let greeting = $state('Welcome back');
	$effect(() => {
		const h = new Date().getHours();
		greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
	});

	const maxSegment = $derived(Math.max(1, ...counts.segments.map((s) => s.count)));

	const tiles = $derived([
		{
			tone: 'violet',
			icon: '🏢',
			value: counts.totalCustomers.toLocaleString(),
			label: 'Customers tracked',
			// Right after a seed every account is "new", which reads like noise — only
			// call out genuine recent additions.
			foot:
				counts.newThisMonth && counts.newThisMonth < counts.totalCustomers
					? `${counts.newThisMonth} added in 30 days`
					: 'across every POD'
		},
		{
			tone: 'blue',
			icon: '📰',
			value: counts.newsToday.toLocaleString(),
			label: 'News today',
			foot: 'fetched in the last 24h'
		},
		{
			tone: 'green',
			icon: '📚',
			value: counts.totalNews.toLocaleString(),
			label: 'Articles in the base',
			foot: 'what the AI answers from'
		},
		{
			tone: 'amber',
			icon: '📡',
			value: counts.sourcesMonitored.toLocaleString(),
			label: 'Sources monitored',
			foot: counts.lastSyncAt
				? `last sync ${relativeTime(counts.lastSyncAt)}`
				: 'awaiting first sync'
		}
	]);

	async function scrollDown() {
		await tick();
		thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
	}

	async function ask(q: string) {
		const question = q.trim();
		if (!question || busy) return;
		input = '';
		busy = true;
		view = 'chat';
		// The composer stays enabled while the answer streams, so the next question can
		// be typed straight away — keep the caret in it.
		tick().then(() => inputEl?.focus());
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
					let obj: { type: string; v?: string; message?: string; sources?: Source[] };
					try {
						obj = JSON.parse(line.slice(5).trim());
					} catch {
						continue;
					}
					if (obj.type === 'delta') assistant.content += obj.v ?? '';
					else if (obj.type === 'sources') assistant.sources = obj.sources ?? [];
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
	/** Cut a streaming answer short; whatever arrived so far stays in the thread. */
	function stop() {
		controller?.abort();
	}
	function reset() {
		controller?.abort(); // stop any in-flight stream cleanly
		messages = [];
		input = '';
		view = 'home';
	}
</script>

{#snippet composer(placeholder: string)}
	<form class="prompt" onsubmit={submit}>
		<span class="prompt__spark" aria-hidden="true">✦</span>
		<!-- Never disabled: the next question can be typed while an answer streams. -->
		<input bind:this={inputEl} bind:value={input} {placeholder} autocomplete="off" />
		{#if busy}
			<button
				class="prompt__send prompt__send--stop"
				type="button"
				onclick={stop}
				aria-label="Stop"
			>
				<span class="stopsq"></span>
			</button>
		{:else}
			<button class="prompt__send" type="submit" disabled={!input.trim()} aria-label="Send"
				>➤</button
			>
		{/if}
	</form>
{/snippet}

{#if view === 'chat'}
	<section class="chat">
		<header class="chat__head">
			<span class="avatar avatar--head" aria-hidden="true">✦</span>
			<span class="chat__id">
				<strong>Watch AI</strong>
				<span class="chat__kb">
					{kb.accounts} accounts · {kb.articles.toLocaleString()} articles
					{#if busy}<span class="chat__typing">· thinking…</span>{/if}
				</span>
			</span>
			<button class="ghost" type="button" onclick={reset}>＋ New chat</button>
			<button class="ghost" type="button" onclick={() => (view = 'home')}>← Dashboard</button>
		</header>

		<div class="thread" bind:this={thread}>
			{#each messages as m, i (i)}
				{#if m.role === 'user'}
					<div class="row user"><div class="bubble">{m.content}</div></div>
				{:else}
					<div class="row ai">
						<div class="avatar" aria-hidden="true">✦</div>
						<div class="answer">
							<div class="text md">{@html renderMarkdown(m.content)}</div>
							{#if m.streaming && !m.content}<span class="thinking"
									>Reading the knowledge base…</span
								>{/if}
							{#if m.streaming}<span class="caret"></span>{/if}
							{#if !m.streaming && m.sources?.length}
								<div class="sources">
									<span class="sources__label">Grounded in</span>
									{#each m.sources.slice(0, 4) as src (src.url)}
										<a
											class="source"
											href={src.url}
											target="_blank"
											rel="noopener noreferrer"
											title="{src.account ?? 'Source'} · {src.title}"
										>
											{#if src.account}<span class="source__acct">{src.account}</span>{/if}
											{src.title}
										</a>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<div class="chat__composer">
			{@render composer('Ask a follow-up…')}
			<p class="chat__hint">
				Answers are grounded in the {kb.articles.toLocaleString()} articles Watch has collected.
			</p>
		</div>
	</section>
{:else}
	<section class="hero">
		<div class="hero__inner">
			<p class="eyebrow">Customer Watch · Admin Workspace</p>
			<p class="greeting">{greeting}, {firstName}.</p>
			<h1 class="headline">Ask your portfolio <span class="grad">anything</span>.</h1>
			<p class="sub">
				Every article we've collected across {kb.accounts} accounts, answered live — risks, renewals,
				sector moves and who owns them.
			</p>

			{@render composer('Ask Watch AI about any account, sector or risk…')}

			{#if suggestions.length}
				<div class="suggest">
					{#each suggestions.slice(0, 4) as s (s)}
						<button type="button" onclick={() => ask(s)}>{s}</button>
					{/each}
				</div>
			{/if}

			<div class="actions">
				{#if messages.length}
					<button class="pill pill--accent" type="button" onclick={() => (view = 'chat')}>
						<span aria-hidden="true">💬</span> Resume conversation
					</button>
				{/if}
				<a class="pill" href="/watch/feed"><span aria-hidden="true">🗞</span> Browse the feed</a>
				<a class="pill" href="/watch/accounts"><span aria-hidden="true">🏢</span> All accounts</a>
				<a class="pill" href="/watch/admin"><span aria-hidden="true">⚙</span> Admin console</a>
			</div>
		</div>
	</section>

	<section class="tiles">
		{#each tiles as t (t.label)}
			<article class="tile tile--{t.tone}">
				<span class="tile__icon" aria-hidden="true">{t.icon}</span>
				<span class="tile__value">{t.value}</span>
				<span class="tile__label">{t.label}</span>
				<span class="tile__foot">{t.foot}</span>
			</article>
		{/each}
	</section>

	<section class="work">
		<article class="card panel">
			<header class="panel__head">
				<div>
					<h2 class="panel__title">Latest across the portfolio</h2>
					<p class="panel__sub">Most recently collected stories from your accounts</p>
				</div>
				<a class="link" href="/watch/feed">View all →</a>
			</header>

			{#if recent.length}
				<ul class="rows">
					{#each recent as item (item.id)}
						<li>
							<a class="rowitem" href={item.url} target="_blank" rel="noopener noreferrer">
								<Monogram
									name={item.account.name}
									segment={item.account.segment}
									slug={item.account.slug}
									logoUrl={item.account.logoUrl}
									size={36}
								/>
								<span class="rowitem__main">
									<span class="rowitem__title">{item.title}</span>
									<span class="rowitem__meta">
										<span class="rowitem__account">{item.account.name}</span>
										{#if item.source}<span class="dot" aria-hidden="true">·</span>{item.source}{/if}
									</span>
								</span>
								<span class="rowitem__when">{relativeTime(item.publishedAt ?? item.fetchedAt)}</span
								>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="panel__empty">
					No news collected yet. Run an ingestion from the <a class="link" href="/watch/admin"
						>Admin console</a
					>.
				</p>
			{/if}
		</article>

		<article class="card panel">
			<header class="panel__head">
				<div>
					<h2 class="panel__title">Coverage by sector</h2>
					<p class="panel__sub">Active accounts in the knowledge base</p>
				</div>
				<a class="link" href="/watch/accounts">Manage →</a>
			</header>

			{#if counts.segments.length}
				<ul class="sectors">
					{#each counts.segments as s (s.key)}
						<li class="sector">
							<span class="sector__icon" aria-hidden="true">{s.icon}</span>
							<span class="sector__label">{s.label}</span>
							<span class="sector__count">{s.count}</span>
							<span class="sector__bar">
								<span
									class="sector__fill"
									style="width:{Math.round((s.count / maxSegment) * 100)}%;background:{s.accent}"
								></span>
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="panel__empty">No accounts assigned yet.</p>
			{/if}
		</article>
	</section>
{/if}

<style>
	/* ---------- Hero ---------- */
	.hero {
		border: 1px solid var(--border);
		border-radius: 20px;
		background:
			radial-gradient(760px 420px at 12% -15%, rgba(139, 92, 246, 0.18), transparent 62%),
			radial-gradient(720px 400px at 88% -10%, rgba(14, 165, 183, 0.2), transparent 62%),
			radial-gradient(900px 500px at 50% 120%, rgba(99, 102, 241, 0.08), transparent 60%),
			linear-gradient(180deg, #f6f8ff 0%, #ffffff 82%);
		padding: 56px 32px 40px;
		margin-bottom: 22px;
		box-shadow: var(--shadow-sm);
	}
	/* ---------- Chat surface (once a question has been asked) ---------- */
	.chat {
		display: flex;
		flex-direction: column;
		/* Fills the content area between topbar and page padding, so the composer
		   sits at the bottom of the window like a real chat client. */
		height: calc(100dvh - 130px);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 20px;
		box-shadow: var(--shadow);
		overflow: hidden;
	}
	.chat__head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(180deg, #f8faff, var(--surface));
	}
	.chat__id {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-right: auto;
		min-width: 0;
	}
	.chat__id strong {
		font-size: 14.5px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.chat__kb {
		font-size: 12px;
		color: var(--text-3);
	}
	.chat__typing {
		color: var(--accent-ink);
		font-weight: 600;
	}
	.ghost {
		flex: none;
		height: 32px;
		padding: 0 13px;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text-2);
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}
	.ghost:hover {
		background: var(--surface-2);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.chat__composer {
		padding: 14px 20px 16px;
		border-top: 1px solid var(--border);
		background: var(--surface);
	}
	.chat__composer .prompt {
		margin: 0;
		max-width: none;
		box-shadow: none;
	}
	.chat__hint {
		margin-top: 8px;
		text-align: center;
		font-size: 11.5px;
		color: var(--text-3);
	}
	.thinking {
		font-size: 13.5px;
		color: var(--text-3);
	}
	.avatar--head {
		width: 34px;
		height: 34px;
	}
	.hero__inner {
		max-width: 760px;
		margin: 0 auto;
		text-align: center;
	}
	.eyebrow {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.greeting {
		margin-top: 18px;
		font-size: 22px;
		font-weight: 500;
		color: var(--text-2);
		letter-spacing: -0.01em;
	}
	.greeting--sm {
		margin-top: 10px;
		font-size: 14px;
		color: var(--text-3);
	}
	.headline {
		margin-top: 6px;
		font-size: 42px;
		line-height: 1.1;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--text);
	}
	.grad {
		background: linear-gradient(90deg, var(--accent) 0%, #4f46e5 55%, #a855f7 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.sub {
		margin: 14px auto 0;
		max-width: 62ch;
		font-size: 14.5px;
		line-height: 1.65;
		color: var(--text-2);
	}

	.prompt {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 28px auto 0;
		max-width: 620px;
		padding: 8px 8px 8px 18px;
		border-radius: 999px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		box-shadow: var(--shadow);
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.prompt:focus-within {
		border-color: var(--accent);
		box-shadow: var(--ring);
	}
	.prompt__spark {
		color: var(--accent);
		font-size: 15px;
	}
	.prompt input {
		flex: 1;
		min-width: 0;
		height: 34px;
		border: 0;
		background: none;
		outline: none;
		font-size: 14.5px;
	}
	.prompt input::placeholder {
		color: var(--text-3);
	}
	.prompt__send {
		flex: none;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: #fff;
		font-size: 14px;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.28);
	}
	.prompt__send:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		box-shadow: none;
	}
	.prompt__send--stop {
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		box-shadow: none;
	}
	.prompt__send--stop:hover {
		border-color: var(--neg);
	}
	.stopsq {
		width: 11px;
		height: 11px;
		border-radius: 3px;
		background: var(--text-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		margin-top: 18px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 18px;
		border-radius: 999px;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		box-shadow: var(--shadow-sm);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text-2);
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s,
			transform 0.05s;
	}
	.pill:hover {
		background: var(--surface-2);
		color: var(--text);
		border-color: var(--accent);
	}
	.pill:active {
		transform: translateY(1px);
	}

	/* ---------- Suggested prompts (inside the hero, under the input) ---------- */
	.suggest {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin: 16px auto 0;
		max-width: 660px;
	}
	.suggest button {
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-2);
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 7px 14px;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}
	.suggest button:hover {
		border-color: var(--accent);
		color: var(--accent-ink);
		background: var(--surface-2);
	}

	/* ---------- Answer thread ---------- */
	.thread {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding: 24px 22px;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.row {
		display: flex;
		gap: 12px;
	}
	.row.user {
		justify-content: flex-end;
	}
	.bubble {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: #fff;
		padding: 11px 15px;
		border-radius: 16px 16px 4px 16px;
		max-width: 78%;
		font-size: 14px;
		line-height: 1.5;
		box-shadow: 0 6px 18px rgba(99, 102, 241, 0.22);
	}
	.avatar {
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		display: grid;
		place-items: center;
		background: rgba(14, 165, 183, 0.12);
		border: 1px solid rgba(14, 165, 183, 0.3);
		color: var(--accent-ink);
		font-size: 15px;
	}
	.answer {
		min-width: 0;
		flex: 1;
	}
	.text {
		font-size: 14.5px;
		line-height: 1.75;
		color: var(--text);
	}
	/* rendered markdown (injected via {@html} → :global selectors) */
	.md :global(p) {
		margin: 0 0 10px;
	}
	.md :global(> :last-child) {
		margin-bottom: 0;
	}
	.md :global(strong) {
		color: var(--text);
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
		color: var(--accent);
	}
	.md :global(code) {
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 1px 5px;
		font-family: var(--mono);
		font-size: 0.9em;
	}
	.sources {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px dashed var(--border);
	}
	.sources__label {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
		margin-right: 2px;
	}
	.source {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 3px 10px;
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.source__acct {
		font-weight: 700;
		color: var(--text);
		margin-right: 4px;
	}
	.source:hover {
		border-color: var(--accent);
		color: var(--accent-ink);
	}

	.caret {
		display: inline-block;
		width: 8px;
		height: 15px;
		margin-left: 2px;
		background: var(--accent);
		border-radius: 2px;
		vertical-align: text-bottom;
		animation: blink 1s steps(2) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	/* ---------- KPI tiles ---------- */
	.tiles {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
		margin-bottom: 22px;
	}
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 22px 22px 20px;
		border-radius: var(--radius-lg);
		border: 1px solid transparent;
		min-height: 132px;
	}
	.tile--violet {
		background: #f4f1fe;
		border-color: #e7e0fb;
	}
	.tile--blue {
		background: #eef4ff;
		border-color: #dde8fd;
	}
	.tile--green {
		background: #eaf7f0;
		border-color: #d7eee2;
	}
	.tile--amber {
		background: #fdf5e6;
		border-color: #f6e8cd;
	}
	.tile__icon {
		position: absolute;
		top: 18px;
		right: 18px;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		display: grid;
		place-items: center;
		background: rgba(255, 255, 255, 0.8);
		font-size: 15px;
		box-shadow: var(--shadow-sm);
	}
	.tile__value {
		font-size: 34px;
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.tile__label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}
	.tile__foot {
		margin-top: auto;
		font-size: 12.5px;
		color: var(--text-2);
	}

	/* ---------- Work area ---------- */
	.work {
		display: grid;
		grid-template-columns: 1.7fr 1fr;
		gap: 18px;
		align-items: start;
	}
	.panel {
		padding: 22px 24px 20px;
	}
	.panel__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
	}
	.panel__title {
		font-size: 16px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.panel__sub {
		margin-top: 3px;
		font-size: 13px;
		color: var(--text-3);
	}
	.panel__empty {
		padding: 18px 0 8px;
		font-size: 13.5px;
		color: var(--text-3);
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.rowitem {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 14px;
		border-radius: var(--radius);
		background: var(--surface-2);
		border: 1px solid transparent;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.rowitem:hover {
		background: var(--surface);
		border-color: var(--border-strong);
	}
	.rowitem__main {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.rowitem__title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.rowitem__meta {
		font-size: 12.5px;
		color: var(--text-3);
	}
	.rowitem__account {
		font-weight: 600;
		color: var(--text-2);
	}
	.dot {
		margin: 0 5px;
	}
	.rowitem__when {
		flex: none;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--text-3);
		white-space: nowrap;
	}

	.sectors {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.sector {
		display: grid;
		grid-template-columns: 20px 1fr auto;
		align-items: center;
		gap: 10px 8px;
	}
	.sector__icon {
		font-size: 14px;
	}
	.sector__label {
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text-2);
	}
	.sector__count {
		font-size: 13.5px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.sector__bar {
		grid-column: 2 / -1;
		height: 6px;
		border-radius: 999px;
		background: var(--bg-soft);
		overflow: hidden;
	}
	.sector__fill {
		display: block;
		height: 100%;
		border-radius: 999px;
	}

	@media (max-width: 1100px) {
		.work {
			grid-template-columns: 1fr;
		}
		.tiles {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 640px) {
		.hero {
			padding: 36px 18px 28px;
		}
		.headline {
			font-size: 30px;
		}
		.tiles {
			grid-template-columns: 1fr;
		}
		.bubble {
			max-width: 100%;
		}
	}
</style>
