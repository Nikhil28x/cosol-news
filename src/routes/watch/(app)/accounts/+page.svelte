<script lang="ts">
	import type { PageData } from './$types';
	import { SENTIMENTS, type ImpactKind, type Sentiment } from '$lib/watch/types';
	import { segmentDef } from '$lib/watch/segments';
	import Monogram from '$lib/watch/components/Monogram.svelte';
	import NewsTile from '$lib/watch/components/NewsTile.svelte';
	import EmptyState from '$lib/watch/components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();
	const seg = $derived(data.segment ? segmentDef(data.segment) : null);
	const heading = $derived(seg ? seg.label : data.q ? `Results for “${data.q}”` : 'All accounts');

	const sentimentClass = (s: Sentiment) =>
		s === 'bullish' ? 'chip--pos' : s === 'bearish' ? 'chip--risk' : 'chip--neutral';
	const kindClass = (k: ImpactKind) =>
		k === 'opportunity' ? 'is-opp' : k === 'risk' ? 'is-risk' : 'is-neu';
</script>

<svelte:head><title>{heading} · Account Intel</title></svelte:head>

<div class="head">
	<h1>{heading}</h1>
	<span class="muted">{data.accounts.length} account{data.accounts.length === 1 ? '' : 's'}</span>
	{#if data.segment || data.q}<a class="link" href="/watch/accounts">Clear</a>{/if}
</div>

<!-- Industry summary (only when a segment is selected) -->
{#if seg && data.sector}
	<section class="card industry" style="--accent:{seg.accent}">
		<div class="industry__head">
			<span class="industry__icon">{seg.icon}</span>
			<div class="industry__id">
				<h2>{seg.label}</h2>
				<small>{data.accounts.length} accounts in this industry</small>
			</div>
			{#await data.sector then sector}
				{#if sector}
					<span class="chip {sentimentClass(sector.sentiment)}">
						{SENTIMENTS[sector.sentiment].arrow}
						{SENTIMENTS[sector.sentiment].label}
					</span>
				{/if}
			{:catch}
				<!-- sentiment chip is best-effort -->
			{/await}
		</div>

		{#await data.sector}
			<p class="loading"><span class="spin"></span> Summarising this industry with Gemini…</p>
		{:then sector}
			{#if sector}
				<p class="industry__summary">{sector.summary}</p>
				{#if sector.signals.length}
					<ul class="signals">
						{#each sector.signals as g, i (i)}
							<li class="signal">
								<span class="signal__dot {kindClass(g.kind)}" title={g.kind}></span>
								<span class="signal__text"><strong>{g.account}</strong> — {g.headline}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				<p class="muted">No AI summary yet — run a refresh to generate this industry's briefing.</p>
			{/if}
		{:catch}
			<p class="muted">Industry summary is unavailable right now — try again shortly.</p>
		{/await}
	</section>

	{#if data.sectorNews.length}
		<div class="section-head">
			<h3>Recent {seg.label} news</h3>
			<a class="link" href="/watch/feed?segment={seg.key}">More →</a>
		</div>
		<div class="sector-news">
			{#each data.sectorNews as item (item.id)}
				<NewsTile {item} variant="card" />
			{/each}
		</div>
	{/if}
{/if}

<!-- Accounts list -->
{#if data.accounts.length}
	<div class="section-head"><h3>{seg ? `${seg.label} accounts` : 'Accounts'}</h3></div>
	<div class="acct-grid">
		{#each data.accounts as a (a.id)}
			<a class="acct card" href="/watch/accounts/{a.slug}">
				<div class="acct__top">
					<Monogram name={a.name} segment={a.segment} slug={a.slug} logoUrl={a.logoUrl} size={44} />
					<div class="acct__id">
						<strong>{a.name}</strong>
						<small>{segmentDef(a.segment).label}</small>
					</div>
					{#if a.ticker}<span class="ticker">{a.exchange ? `${a.exchange}:` : ''}{a.ticker}</span
						>{/if}
				</div>
				{#if a.description}<p class="acct__desc">{a.description}</p>{/if}
				<div class="acct__foot">
					{#if a.pod}<span class="tag">POD {a.pod}</span>{/if}
					{#if a.country}<span class="tag">{a.country}</span>{/if}
				</div>
			</a>
		{/each}
	</div>
{:else}
	<EmptyState icon="🏢" title="No accounts found" hint="Nothing matches this filter." />
{/if}

<style>
	.head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 16px;
	}
	.head h1 {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.01em;
	}

	.industry {
		padding: 20px;
		margin-bottom: 18px;
		border-left: 4px solid var(--accent);
	}
	.industry__head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}
	.industry__icon {
		font-size: 26px;
		color: var(--accent);
	}
	.industry__id {
		flex: 1;
		min-width: 0;
	}
	.industry__id h2 {
		font-size: 20px;
		font-weight: 800;
	}
	.industry__id small {
		color: var(--text-3);
		font-size: 12.5px;
	}
	.industry__summary {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text);
	}
	.loading {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-2);
	}
	.signals {
		display: flex;
		flex-direction: column;
		gap: 8px;
		border-top: 1px solid var(--border);
		margin-top: 14px;
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
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 6px 0 14px;
	}
	.section-head h3 {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-2);
	}
	.sector-news {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 14px;
		margin-bottom: 22px;
	}

	.acct-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.acct {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		transition:
			box-shadow 0.15s,
			border-color 0.15s;
	}
	.acct:hover {
		box-shadow: var(--shadow);
		border-color: var(--border-strong);
	}
	.acct__top {
		display: flex;
		align-items: center;
		gap: 11px;
	}
	.acct__id {
		min-width: 0;
		flex: 1;
	}
	.acct__id strong {
		display: block;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.acct__id small {
		color: var(--text-3);
		font-size: 12px;
	}
	.ticker {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		padding: 2px 7px;
		border-radius: 6px;
		white-space: nowrap;
	}
	.acct__desc {
		font-size: 13px;
		color: var(--text-2);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.acct__foot {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: auto;
	}
	.tag {
		font-size: 11px;
		color: var(--text-3);
		background: var(--surface-2);
		border-radius: 6px;
		padding: 2px 8px;
	}

	.spin {
		width: 15px;
		height: 15px;
		border: 2px solid var(--border-strong);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex: none;
		display: inline-block;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
