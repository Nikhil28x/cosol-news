<script lang="ts">
	import type { FeedItem } from '$lib/watch/types';
	import { relativeTime } from '$lib/watch/format';
	import Monogram from './Monogram.svelte';
	import SignalChip from './SignalChip.svelte';
	import ImpactChip from './ImpactChip.svelte';
	import Trend from './Trend.svelte';

	let { item, showAccount = true }: { item: FeedItem; showAccount?: boolean } = $props();
</script>

<article class="feed-item" class:is-priority={item.isPriority}>
	{#if showAccount}
		<a
			href="/watch/accounts/{item.account.slug}"
			class="feed-item__mono"
			aria-label={item.account.name}
		>
			<Monogram name={item.account.name} segment={item.account.segment} size={40} />
		</a>
	{/if}

	<div class="feed-item__body">
		<div class="feed-item__meta">
			{#if showAccount}
				<a href="/watch/accounts/{item.account.slug}" class="feed-item__acct">{item.account.name}</a
				>
				<span class="dot">·</span>
			{/if}
			{#if item.source}<span>{item.source}</span><span class="dot">·</span>{/if}
			<time>{relativeTime(item.publishedAt ?? item.fetchedAt)}</time>
			{#if item.isPriority}<span class="prio">Priority</span>{/if}
		</div>

		<a href={item.url} target="_blank" rel="noopener noreferrer" class="feed-item__title">
			{item.title}
		</a>

		{#if item.detail && item.detail !== item.title}
			<p class="feed-item__detail">{item.detail}</p>
		{/if}

		<div class="feed-item__chips">
			{#if item.signalType}<SignalChip type={item.signalType} />{/if}
			<ImpactChip kind={item.impactKind} label={item.impactLabel} />
		</div>
	</div>

	<div class="feed-item__trend">
		<Trend sentiment={item.sentiment} pct={item.trendPct} />
	</div>
</article>

<style>
	.feed-item {
		display: flex;
		gap: 14px;
		padding: 16px 4px;
		border-bottom: 1px solid var(--border);
	}
	.feed-item:last-child {
		border-bottom: 0;
	}
	.feed-item.is-priority {
		background: linear-gradient(90deg, rgba(214, 69, 69, 0.05), transparent 40%);
		border-radius: 8px;
		padding-left: 12px;
	}
	.feed-item__mono {
		flex: none;
	}
	.feed-item__body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.feed-item__meta {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		font-size: 12.5px;
		color: var(--text-3);
	}
	.feed-item__acct {
		font-weight: 600;
		color: var(--text-2);
	}
	.feed-item__acct:hover {
		color: var(--accent-ink);
	}
	.dot {
		color: var(--text-3);
	}
	.prio {
		color: var(--neg);
		font-weight: 700;
		background: var(--neg-bg);
		padding: 1px 7px;
		border-radius: 999px;
		font-size: 11px;
	}
	.feed-item__title {
		font-weight: 600;
		font-size: 14.5px;
		line-height: 1.4;
		color: var(--text);
	}
	.feed-item__title:hover {
		color: var(--accent-ink);
	}
	.feed-item__detail {
		font-size: 13px;
		color: var(--text-2);
		line-height: 1.5;
	}
	.feed-item__chips {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 2px;
	}
	.feed-item__trend {
		flex: none;
		align-self: flex-start;
		padding-top: 2px;
	}
</style>
