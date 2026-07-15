<script lang="ts">
	import type { PageData } from './$types';
	import { SIGNAL_TYPES } from '$lib/watch/types';
	import FeedCard from '$lib/watch/components/FeedCard.svelte';
	import EmptyState from '$lib/watch/components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();
	const signalOptions = Object.entries(SIGNAL_TYPES);

	function submit(e: Event) {
		(e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
	}
</script>

<svelte:head><title>News Feed · COSOL Customer Watch</title></svelte:head>

<div class="card">
	<div class="card__head">
		<span class="card__title">📰 News Feed <span class="count">{data.items.length}</span></span>
		<form class="filters" method="GET">
			{#if data.filters.segment}<input
					type="hidden"
					name="segment"
					value={data.filters.segment}
				/>{/if}
			<select name="signal" class="sel" onchange={submit}>
				<option value="">All signals</option>
				{#each signalOptions as [key, meta] (key)}
					<option value={key} selected={data.filters.signalType === key}>{meta.label}</option>
				{/each}
			</select>
			<select name="sentiment" class="sel" onchange={submit}>
				<option value="">Any sentiment</option>
				<option value="bullish" selected={data.filters.sentiment === 'bullish'}>Bullish</option>
				<option value="neutral" selected={data.filters.sentiment === 'neutral'}>Neutral</option>
				<option value="bearish" selected={data.filters.sentiment === 'bearish'}>Bearish</option>
			</select>
			<label class="prio-toggle">
				<input
					type="checkbox"
					name="priority"
					value="1"
					checked={data.filters.priorityOnly}
					onchange={submit}
				/>
				Priority only
			</label>
		</form>
	</div>
	<div class="card__body">
		{#if data.items.length}
			<div class="feed">
				{#each data.items as item (item.id)}
					<FeedCard {item} />
				{/each}
			</div>
		{:else}
			<EmptyState
				icon="📰"
				title="No news matches"
				hint="Try clearing the filters, or wait for the next ingestion cycle."
			/>
		{/if}
	</div>
</div>

<style>
	.count {
		font-size: 12px;
		background: var(--neutral-bg);
		color: var(--text-2);
		padding: 1px 8px;
		border-radius: 999px;
		margin-left: 4px;
	}
	.filters {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.sel {
		height: 34px;
		padding: 0 10px;
		border-radius: 8px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		font-size: 13px;
	}
	.sel:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: var(--ring);
	}
	.prio-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-2);
		font-weight: 500;
	}
</style>
