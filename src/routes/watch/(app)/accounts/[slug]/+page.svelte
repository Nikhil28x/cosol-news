<script lang="ts">
	import type { PageData } from './$types';
	import { segmentDef } from '$lib/watch/segments';
	import { relativeTime } from '$lib/watch/format';
	import Monogram from '$lib/watch/components/Monogram.svelte';
	import Briefing from '$lib/watch/components/Briefing.svelte';
	import FeedCard from '$lib/watch/components/FeedCard.svelte';
	import EmptyState from '$lib/watch/components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();
	const a = $derived(data.account);
	const articleCount = $derived(data.items.length);
	const last = $derived(data.items[0]?.publishedAt ?? data.items[0]?.fetchedAt ?? null);
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
	<section class="card brief-skeleton" aria-busy="true">
		<div class="brief-skeleton__head">
			<span class="spin"></span>
			<span class="brief-skeleton__label">Generating AI briefing for {a.name}…</span>
		</div>
		<div class="brief-skeleton__body">
			<span class="bar" style="width:96%"></span>
			<span class="bar" style="width:88%"></span>
			<span class="bar" style="width:62%"></span>
			<div class="brief-skeleton__grid">
				<span class="block"></span>
				<span class="block"></span>
			</div>
		</div>
	</section>
{:then digest}
	{#if digest}
		<Briefing
			summary={digest.summary}
			sentiment={digest.sentiment}
			sentimentScore={digest.sentimentScore}
			signals={digest.signals}
			itemCount={digest.itemCount}
			generatedAt={digest.generatedAt}
			model={digest.model?.includes('gemini') ? 'Gemini' : digest.model}
		/>
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

	/* Placeholder that mirrors the briefing's real shape while Gemini streams. */
	.brief-skeleton {
		margin-bottom: 14px;
		overflow: hidden;
	}
	.brief-skeleton__head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(180deg, #f8faff, var(--surface));
	}
	.brief-skeleton__label {
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.brief-skeleton__body {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 22px 20px;
	}
	.brief-skeleton__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-top: 8px;
	}
	.bar,
	.block {
		border-radius: 6px;
		background: linear-gradient(90deg, var(--bg-soft) 25%, #e9edf3 50%, var(--bg-soft) 75%);
		background-size: 400% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}
	.bar {
		height: 12px;
	}
	.block {
		height: 62px;
		border-radius: var(--radius-sm);
	}
	@keyframes shimmer {
		to {
			background-position: -200% 0;
		}
	}
	@media (max-width: 820px) {
		.brief-skeleton__grid {
			grid-template-columns: 1fr;
		}
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
