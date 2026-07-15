<script lang="ts">
	import type { PageData } from './$types';
	import { SENTIMENTS, type Sentiment } from '$lib/watch/types';
	import { relativeTime } from '$lib/watch/format';
	import NewsTile from '$lib/watch/components/NewsTile.svelte';
	import AiConsole from '$lib/watch/components/AiConsole.svelte';

	let { data }: { data: PageData } = $props();

	const sentimentClass = (s: Sentiment) =>
		s === 'bullish' ? 'chip--pos' : s === 'bearish' ? 'chip--risk' : 'chip--neutral';
</script>

<svelte:head><title>Dashboard · COSOL Customer Watch</title></svelte:head>

{#if data.mode === 'ai'}
	<AiConsole kb={data.kb} suggestions={data.suggestions} />
{:else}
	{@const c = data.counts}
	{@const news = data.news}
	{@const hero = news[0]}
	{@const secondary = news.slice(1, 3)}
	{@const latest = news.slice(3, 12)}

	<section class="kpis">
		<div class="kpi">
			<span class="kpi__label">Customers Tracked</span>
			<span class="kpi__value">{c.totalCustomers}</span>
			<span class="kpi__foot pos">+{c.newThisMonth} added (30d)</span>
		</div>
		<div class="kpi">
			<span class="kpi__label">News Today</span>
			<span class="kpi__value">{c.newsToday}</span>
			<span class="kpi__foot">fetched in last 24h</span>
		</div>
		<div class="kpi">
			<span class="kpi__label">Total Articles</span>
			<span class="kpi__value">{c.totalNews.toLocaleString()}</span>
			<span class="kpi__foot">in the knowledge base</span>
		</div>
		<div class="kpi">
			<span class="kpi__label">Sources Monitored</span>
			<span class="kpi__value">{c.sourcesMonitored}</span>
			<span class="kpi__foot">RSS publishers</span>
		</div>
	</section>

	{#if c.totalCustomers > 0}
		{#await data.digest then digest}
			{#if digest}
				<section class="card briefing">
					<div class="briefing__head">
						<span class="card__title">🧠 Portfolio Briefing</span>
						<span class="chip {sentimentClass(digest.portfolioSentiment)}">
							{SENTIMENTS[digest.portfolioSentiment].arrow}
							{SENTIMENTS[digest.portfolioSentiment].label}
						</span>
						<span class="gen"
							>Gemini · {digest.itemCount} articles · {relativeTime(digest.generatedAt)}</span
						>
					</div>
					<p class="briefing__text">{digest.portfolioSummary}</p>
				</section>
			{/if}
		{:catch}
			<!-- briefing is best-effort; a transient failure just hides it -->
		{/await}
	{/if}

	{#if news.length}
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

		{#if latest.length}
			<div class="section-head">
				<h2>Latest News</h2>
				<a class="link" href="/watch/feed">See all →</a>
			</div>
			<div class="latest-grid">
				{#each latest as item (item.id)}
					<NewsTile {item} variant="card" />
				{/each}
			</div>
		{/if}
	{:else}
		<div class="card empty">
			<p>No news yet for your accounts.</p>
			<p class="muted">
				Run a refresh in <a class="link" href="/watch/admin">Admin</a> or
				<code>npm run watch:ingest</code>.
			</p>
		</div>
	{/if}

	<footer class="statusbar">
		<span><span class="s-dot"></span> AI Engine Active</span>
		<span>🗂 {c.sourcesMonitored} sources monitored</span>
		<span>◷ Last sync {c.lastSyncAt ? relativeTime(c.lastSyncAt) : '—'}</span>
		<span class="statusbar__spacer"></span>
		<span>🔒 Enterprise Secure</span>
		<span>{c.totalNews.toLocaleString()} articles stored</span>
	</footer>
{/if}

<style>
	.kpis {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		margin-bottom: 16px;
	}
	.kpi {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.kpi__label {
		font-size: 11.5px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.kpi__value {
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.kpi__foot {
		font-size: 12px;
		color: var(--text-3);
	}
	.kpi__foot.pos {
		color: var(--pos);
	}

	.briefing {
		padding: 16px 18px;
		margin-bottom: 18px;
	}
	.briefing__head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}
	.gen {
		font-size: 12px;
		color: var(--text-3);
		margin-left: auto;
	}
	.briefing__text {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text);
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
		display: flex;
		align-items: center;
		justify-content: space-between;
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
	.latest-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 16px;
	}

	.empty {
		padding: 40px;
		text-align: center;
	}
	.empty code {
		background: var(--surface-2);
		border: 1px solid var(--border);
		padding: 1px 6px;
		border-radius: 5px;
		font-family: var(--mono);
		font-size: 12.5px;
	}

	.statusbar {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-top: 22px;
		padding: 11px 16px;
		background: var(--brand);
		color: #9fb2c9;
		border-radius: var(--radius);
		font-size: 12px;
		flex-wrap: wrap;
	}
	.statusbar__spacer {
		flex: 1;
	}
	.s-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #10b981;
		margin-right: 4px;
	}

	@media (max-width: 900px) {
		.kpis {
			grid-template-columns: repeat(2, 1fr);
		}
		.top-stories {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 520px) {
		.kpis {
			grid-template-columns: 1fr;
		}
	}
</style>
