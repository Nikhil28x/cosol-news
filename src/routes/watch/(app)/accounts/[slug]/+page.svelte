<script lang="ts">
	import type { PageData } from './$types';
	import { SENTIMENTS, type ImpactKind, type Sentiment } from '$lib/watch/types';
	import { segmentDef } from '$lib/watch/segments';
	import { relativeTime } from '$lib/watch/format';
	import Monogram from '$lib/watch/components/Monogram.svelte';
	import FeedCard from '$lib/watch/components/FeedCard.svelte';
	import EmptyState from '$lib/watch/components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();
	const a = $derived(data.account);
	const articleCount = $derived(data.items.length);
	const last = $derived(data.items[0]?.publishedAt ?? data.items[0]?.fetchedAt ?? null);

	const sentimentClass = (s: Sentiment) =>
		s === 'bullish' ? 'chip--pos' : s === 'bearish' ? 'chip--risk' : 'chip--neutral';
	const kindClass = (k: ImpactKind) =>
		k === 'opportunity' ? 'is-opp' : k === 'risk' ? 'is-risk' : 'is-neu';
</script>

<svelte:head><title>{a.name} · COSOL Customer Watch</title></svelte:head>

<a class="back" href="/watch/accounts">← Accounts</a>

<header class="head card">
	<Monogram name={a.name} segment={a.segment} slug={a.slug} logoUrl={a.logoUrl} size={56} />
	<div class="head__id">
		<h2>{a.name}</h2>
		<div class="head__meta">
			<span
				class="seg-pill"
				style="border-color:{segmentDef(a.segment).accent};color:{segmentDef(a.segment).accent}"
			>
				{segmentDef(a.segment).icon}
				{segmentDef(a.segment).label}
			</span>
			{#if a.ticker}<span class="chip chip--signal"
					>{a.exchange ? `${a.exchange}:` : ''}{a.ticker}</span
				>{/if}
			{#if a.pod}<span class="chip chip--neutral">POD {a.pod}</span>{/if}
			{#if a.country}<span class="muted">{a.country}</span>{/if}
			{#if a.website}<a class="link" href={a.website} target="_blank" rel="noopener noreferrer"
					>Website ↗</a
				>{/if}
		</div>
		{#if a.description}<p class="head__desc">{a.description}</p>{/if}
	</div>
</header>

<!-- AI briefing (streams in) -->
{#await data.digest}
	<section class="card digest loading">
		<span class="spin"></span> Generating AI briefing for {a.name}…
	</section>
{:then digest}
	{#if digest}
		<section class="card digest">
			<div class="card__head">
				<span class="card__title">🧠 AI Briefing</span>
				<span class="chip {sentimentClass(digest.sentiment)}">
					{SENTIMENTS[digest.sentiment].arrow}
					{SENTIMENTS[digest.sentiment].label}
				</span>
				<span class="gen"
					>Gemini · {digest.itemCount} articles · {relativeTime(digest.generatedAt)}</span
				>
			</div>
			<div class="card__body">
				<p class="digest__text">{digest.summary}</p>
				{#if digest.signals.length}
					<ul class="signals">
						{#each digest.signals as g, i (i)}
							<li class="signal">
								<span class="signal__dot {kindClass(g.kind)}" title={g.kind}></span>
								<span class="signal__text">{g.headline}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	{/if}
{/await}

<!-- Raw news (RSS knowledge base) -->
<div class="card">
	<div class="card__head">
		<span class="card__title">📰 Latest News</span>
		<span class="freshness">
			<span class="live__dot"></span>
			Auto-refreshed daily via RSS · {articleCount} articles{#if last}
				· last {relativeTime(last)}{/if}
		</span>
	</div>
	<div class="card__body">
		{#if data.items.length}
			<div class="feed">
				{#each data.items as item (item.id)}
					<FeedCard {item} showAccount={false} />
				{/each}
			</div>
		{:else}
			<EmptyState
				icon="🔍"
				title="No news yet for {a.name}"
				hint="The research agents haven't collected news for this account yet."
			/>
		{/if}
	</div>
</div>

<style>
	.back {
		display: inline-block;
		color: var(--text-3);
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 12px;
	}
	.back:hover {
		color: var(--accent-ink);
	}
	.head {
		display: flex;
		gap: 16px;
		padding: 20px;
		margin-bottom: 14px;
	}
	.head__id {
		min-width: 0;
	}
	.head__id h2 {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
	.head__meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 8px;
	}
	.seg-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		font-weight: 600;
		border: 1px solid;
		border-radius: 999px;
		padding: 3px 10px;
		background: var(--surface);
	}
	.head__desc {
		margin-top: 10px;
		color: var(--text-2);
		font-size: 13.5px;
		line-height: 1.55;
		max-width: 80ch;
	}

	.digest {
		margin-bottom: 14px;
	}
	.digest.loading {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 18px;
		color: var(--text-2);
		font-weight: 500;
	}
	.digest__text {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text);
	}
	.gen {
		font-size: 12px;
		color: var(--text-3);
		margin-left: auto;
	}
	.signals {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-top: 1px solid var(--border);
		margin-top: 12px;
		padding-top: 12px;
	}
	.signal {
		display: flex;
		gap: 9px;
		align-items: baseline;
	}
	.signal__dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: none;
		transform: translateY(1px);
	}
	.signal__dot.is-opp {
		background: var(--info);
	}
	.signal__dot.is-risk {
		background: var(--neg);
	}
	.signal__dot.is-neu {
		background: var(--neutral);
	}
	.signal__text {
		font-size: 13px;
		line-height: 1.45;
		color: var(--text);
	}

	.freshness {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
		font-weight: 600;
		color: var(--accent-ink);
	}
	.spin {
		width: 16px;
		height: 16px;
		border: 2px solid var(--border-strong);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex: none;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
