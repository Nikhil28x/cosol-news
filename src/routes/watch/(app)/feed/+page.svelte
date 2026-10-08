<script lang="ts">
	import type { PageData } from './$types';
	import NewsTile from '$lib/watch/components/NewsTile.svelte';
	import EmptyState from '$lib/watch/components/EmptyState.svelte';
	import { segmentDef } from '$lib/watch/segments';

	let { data }: { data: PageData } = $props();
	const hero = $derived(data.items[0]);
	const secondary = $derived(data.items.slice(1, 3));
	const rest = $derived(data.items.slice(3));

	function submitPick(e: Event) {
		(e.currentTarget as HTMLElement).closest('form')?.requestSubmit();
	}
</script>

<svelte:head><title>News Feed · Account Intel</title></svelte:head>

<div class="head">
	<h1>
		{data.filters.segment ? segmentDef(data.filters.segment).label : 'News Feed'}
		<span class="count">{data.items.length}</span>
	</h1>
	<!-- One GET form so industry + user submit together and preserve each other. -->
	<form class="filters" method="GET">
		<select name="segment" class="sel" onchange={submitPick} title="Filter by industry">
			<option value="">All industries</option>
			{#each data.segments as s (s.key)}
				<option value={s.key} selected={data.filters.segment === s.key}>{s.label}</option>
			{/each}
		</select>
		{#if data.isAdmin}
			<select name="user" class="sel" onchange={submitPick} title="View a user's news">
				<option value="">All accounts</option>
				{#each data.users as u (u.id)}
					<option value={u.id} selected={data.asUserId === u.id}>
						{u.name}{u.pod ? ` · POD ${u.pod}` : ''}
					</option>
				{/each}
			</select>
		{/if}
	</form>
</div>

{#if data.asUserName}
	<div class="viewing">
		👁 Showing <strong>{data.asUserName}</strong>'s news — {data.items.length} articles from their accounts.
		<a class="link" href="/watch/feed">Show all</a>
	</div>
{/if}

{#if data.items.length}
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
		<div class="section-head"><h2>More stories</h2></div>
		<div class="grid">
			{#each rest as item (item.id)}
				<NewsTile {item} variant="card" />
			{/each}
		</div>
	{/if}
{:else}
	<EmptyState
		icon="📰"
		title="No news here yet"
		hint="Try a different user or segment, or wait for the next daily refresh."
	/>
{/if}

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}
	.head h1 {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}
	.count {
		font-size: 12px;
		background: var(--neutral-bg);
		color: var(--text-2);
		padding: 1px 9px;
		border-radius: 999px;
		margin-left: 4px;
		vertical-align: middle;
	}
	.filters {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.sel {
		height: 36px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		font-size: 13px;
		font-weight: 500;
	}
	.sel:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: var(--ring);
	}
	.viewing {
		background: rgba(14, 165, 183, 0.1);
		border: 1px solid rgba(14, 165, 183, 0.25);
		color: var(--accent-ink);
		border-radius: 10px;
		padding: 9px 14px;
		font-size: 13px;
		margin-bottom: 16px;
	}
	.viewing .link {
		margin-left: 8px;
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
		background: var(--accent);
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
