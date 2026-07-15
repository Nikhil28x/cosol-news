<script lang="ts">
	import type { PageData } from './$types';
	import NewsTile from '$lib/watch/components/NewsTile.svelte';
	import EmptyState from '$lib/watch/components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();
	const hero = $derived(data.news[0]);
	const secondary = $derived(data.news.slice(1, 3));
	const rest = $derived(data.news.slice(3));
</script>

<svelte:head><title>General Tech · COSOL Customer Watch</title></svelte:head>

<div class="head">
	<div class="head__id">
		<h1>🤖 General Tech <span class="grad">· AI News</span></h1>
		<p class="sub">
			The latest in AI and technology across the industry — refreshed daily, shared by everyone.
		</p>
	</div>
	<span class="count">{data.news.length}</span>
</div>

{#if data.news.length}
	<section class="top-stories">
		{#if hero}<NewsTile item={hero} variant="hero" />{/if}
		{#if secondary.length}
			<div class="secondary">
				{#each secondary as item (item.id)}
					<NewsTile {item} variant="wide" />
				{/each}
			</div>
		{/if}
	</section>

	{#if rest.length}
		<div class="section-head"><h2>More in AI &amp; Tech</h2></div>
		<div class="grid">
			{#each rest as item (item.id)}
				<NewsTile {item} variant="card" />
			{/each}
		</div>
	{/if}
{:else}
	<EmptyState
		icon="🤖"
		title="No tech news yet"
		hint="Run a refresh (Admin → Run ingestion, or npm run watch:tech) to pull the latest AI news."
	/>
{/if}

<style>
	.head {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		margin-bottom: 18px;
	}
	.head__id {
		flex: 1;
	}
	.head h1 {
		font-size: 24px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
	.grad {
		background: linear-gradient(90deg, var(--seg-cyan), var(--seg-purple));
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.sub {
		margin-top: 4px;
		color: var(--text-2);
		font-size: 13.5px;
	}
	.count {
		font-size: 12px;
		background: var(--neutral-bg);
		color: var(--text-2);
		padding: 2px 10px;
		border-radius: 999px;
		font-weight: 600;
	}
	.top-stories {
		display: grid;
		grid-template-columns: 1.55fr 1fr;
		gap: 16px;
		margin-bottom: 22px;
	}
	.secondary {
		display: grid;
		gap: 16px;
		align-content: start;
	}
	.section-head {
		margin-bottom: 14px;
	}
	.section-head h2 {
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.01em;
		position: relative;
		padding-left: 12px;
	}
	.section-head h2::before {
		content: '';
		position: absolute;
		left: 0;
		top: 2px;
		bottom: 2px;
		width: 4px;
		border-radius: 3px;
		background: var(--seg-cyan);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 16px;
	}
	@media (max-width: 900px) {
		.top-stories {
			grid-template-columns: 1fr;
		}
	}
</style>
