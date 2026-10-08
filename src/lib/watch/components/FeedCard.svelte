<script lang="ts">
	import type { FeedItem } from '$lib/watch/types';
	import { relativeTime } from '$lib/watch/format';
	import Monogram from './Monogram.svelte';
	import SignalChip from './SignalChip.svelte';
	import ImpactChip from './ImpactChip.svelte';
	import Trend from './Trend.svelte';

	let {
		item,
		showAccount = true,
		adminActions = false
	}: { item: FeedItem; showAccount?: boolean; adminActions?: boolean } = $props();
	const rfbSignal = $derived(item.watchSignals?.find((signal) => signal.kind === 'rfb'));
	const firstSignal = $derived(item.watchSignals?.[0]);
</script>

<article class="feed-item" class:is-priority={item.isPriority}>
	{#if showAccount}
		<a
			href="/watch/accounts/{item.account.slug}"
			class="feed-item__mono"
			aria-label={item.account.name}
		>
			<Monogram
				name={item.account.name}
				segment={item.account.segment}
				slug={item.account.slug}
				logoUrl={item.account.logoUrl}
				size={40}
			/>
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
			{#each item.watchSignals ?? [] as signal (signal.id)}
				<span class="watch-chip" class:rfb={signal.kind === 'rfb'}>
					{signal.kind === 'rfb' ? 'RFB' : 'Watch'} · {signal.name}
				</span>
			{/each}
		</div>

		{#if adminActions}
			<div class="feed-item__actions">
				<form method="POST" action="?/createAction">
					<input type="hidden" name="kind" value="follow_up" />
					<input type="hidden" name="newsItemId" value={item.id} />
					<input type="hidden" name="signalId" value={firstSignal?.id ?? ''} />
					<input type="hidden" name="title" value={`Follow up: ${item.title}`} />
					<button>+ Follow up</button>
				</form>
				<form method="POST" action="?/createAction">
					<input type="hidden" name="kind" value="rfb" />
					<input type="hidden" name="newsItemId" value={item.id} />
					<input type="hidden" name="signalId" value={rfbSignal?.id ?? firstSignal?.id ?? ''} />
					<input type="hidden" name="title" value={`RFB: ${item.title}`} />
					<button class="rfb-action">Track RFB</button>
				</form>
			</div>
		{/if}
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
	.watch-chip {
		display: inline-flex;
		align-items: center;
		padding: 3px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 650;
		color: var(--accent-ink);
		background: rgba(14, 165, 183, 0.1);
	}
	.watch-chip.rfb {
		color: var(--warn);
		background: var(--warn-bg);
	}
	.feed-item__actions {
		display: flex;
		gap: 6px;
		margin-top: 3px;
	}
	.feed-item__actions button {
		font-size: 11.5px;
		font-weight: 650;
		color: var(--accent-ink);
		padding: 4px 8px;
		border: 1px solid rgba(14, 165, 183, 0.24);
		border-radius: 7px;
		background: rgba(14, 165, 183, 0.05);
	}
	.feed-item__actions button:hover {
		background: rgba(14, 165, 183, 0.11);
	}
	.feed-item__actions .rfb-action {
		color: var(--warn);
		border-color: rgba(183, 121, 31, 0.25);
		background: var(--warn-bg);
	}
	.feed-item__trend {
		flex: none;
		align-self: flex-start;
		padding-top: 2px;
	}
</style>
