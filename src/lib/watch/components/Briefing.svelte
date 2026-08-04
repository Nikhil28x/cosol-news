<!--
	The Gemini briefing block — used for an account ("AI Briefing") and for the member
	dashboard ("Portfolio Briefing").

	Structure over decoration: a labelled header carrying the sentiment read and its
	provenance, the summary as a lead paragraph, then the signals as a graded grid where
	each card states its kind outright (Opportunity / Risk / Watch) instead of relying on
	an unlabelled coloured dot. Risks sort first — they're what an account manager needs
	to see before anything else.
-->
<script lang="ts">
	import {
		IMPACT_KINDS,
		SENTIMENTS,
		type DigestSignal,
		type ImpactKind,
		type Sentiment
	} from '$lib/watch/types';
	import { relativeTime } from '$lib/watch/format';

	let {
		label = 'AI Briefing',
		summary,
		sentiment,
		sentimentScore = null,
		signals = [],
		signalsLabel = 'Key signals',
		showAccount = false,
		model = 'Gemini',
		itemCount,
		generatedAt
	}: {
		label?: string;
		summary: string;
		sentiment: Sentiment;
		sentimentScore?: number | null;
		signals?: DigestSignal[];
		signalsLabel?: string;
		showAccount?: boolean;
		model?: string;
		itemCount: number;
		generatedAt: string;
	} = $props();

	const KIND_ORDER: Record<ImpactKind, number> = { risk: 0, opportunity: 1, neutral: 2 };
	const ordered = $derived([...signals].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]));
	const counts = $derived({
		risk: signals.filter((s) => s.kind === 'risk').length,
		opportunity: signals.filter((s) => s.kind === 'opportunity').length
	});

	const kindLabel = (k: ImpactKind) => (k === 'neutral' ? 'Watch' : IMPACT_KINDS[k].label);
	/** -1..1 → 0..100, for the sentiment meter's marker position. */
	const meterPos = $derived(
		sentimentScore == null ? null : Math.round((Math.max(-1, Math.min(1, sentimentScore)) + 1) * 50)
	);
</script>

<section class="brief card">
	<header class="brief__head">
		<span class="brief__mark" aria-hidden="true">✦</span>
		<h2 class="brief__label">{label}</h2>

		<span class="verdict verdict--{sentiment}">
			<span aria-hidden="true">{SENTIMENTS[sentiment].arrow}</span>
			{SENTIMENTS[sentiment].label}
		</span>

		{#if meterPos !== null}
			<span class="meter" title="Sentiment score {sentimentScore?.toFixed(2)} (−1 to +1)">
				<span class="meter__track"></span>
				<span class="meter__tick"></span>
				<span class="meter__pin meter__pin--{sentiment}" style="left:{meterPos}%"></span>
			</span>
		{/if}

		<span class="brief__meta">
			{model} · {itemCount} article{itemCount === 1 ? '' : 's'} · {relativeTime(generatedAt)}
		</span>
	</header>

	<div class="brief__body">
		<p class="brief__summary">{summary}</p>

		{#if ordered.length}
			<div class="brief__signals">
				<div class="signals__head">
					<h3>{signalsLabel}</h3>
					<span class="signals__count">
						{#if counts.risk}<span class="tally tally--risk">{counts.risk} risk</span>{/if}
						{#if counts.opportunity}<span class="tally tally--opp"
								>{counts.opportunity} opportunity</span
							>{/if}
					</span>
				</div>

				<ul class="signals">
					{#each ordered as s, i (i)}
						<li class="signal signal--{s.kind}">
							<span class="signal__kind">{kindLabel(s.kind)}</span>
							<p class="signal__text">{s.headline}</p>
							{#if showAccount && s.account}<span class="signal__account">{s.account}</span>{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</section>

<style>
	.brief {
		margin-bottom: 14px;
		overflow: hidden;
	}

	/* ---------- Header ---------- */
	.brief__head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(180deg, #f8faff, var(--surface));
	}
	.brief__mark {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 8px;
		flex: none;
		font-size: 13px;
		color: var(--accent-ink);
		background: rgba(14, 165, 183, 0.12);
		border: 1px solid rgba(14, 165, 183, 0.28);
	}
	.brief__label {
		font-size: 12.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.verdict {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
		border: 1px solid transparent;
	}
	.verdict--bullish {
		background: var(--pos-bg);
		color: var(--pos);
		border-color: rgba(18, 133, 90, 0.2);
	}
	.verdict--bearish {
		background: var(--neg-bg);
		color: var(--neg);
		border-color: rgba(214, 69, 69, 0.2);
	}
	.verdict--neutral {
		background: var(--neutral-bg);
		color: var(--neutral);
		border-color: var(--border-strong);
	}

	/* Sentiment score on a −1 … +1 scale: neutral track, centre tick, graded marker. */
	.meter {
		position: relative;
		width: 96px;
		height: 14px;
		flex: none;
	}
	.meter__track {
		position: absolute;
		inset: 6px 0;
		border-radius: 999px;
		background: var(--bg-soft);
		border: 1px solid var(--border);
	}
	.meter__tick {
		position: absolute;
		left: 50%;
		top: 3px;
		bottom: 3px;
		width: 1px;
		background: var(--border-strong);
	}
	.meter__pin {
		position: absolute;
		top: 2px;
		width: 4px;
		height: 10px;
		margin-left: -2px;
		border-radius: 2px;
		background: var(--neutral);
	}
	.meter__pin--bullish {
		background: var(--pos);
	}
	.meter__pin--bearish {
		background: var(--neg);
	}

	.brief__meta {
		margin-left: auto;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--text-3);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* ---------- Body ---------- */
	.brief__body {
		padding: 20px;
	}
	.brief__summary {
		font-size: 15px;
		line-height: 1.7;
		color: var(--text);
		max-width: 92ch;
		padding-left: 14px;
		border-left: 3px solid var(--accent);
	}

	/* ---------- Signals ---------- */
	.brief__signals {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}
	.signals__head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
	}
	.signals__head h3 {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.signals__count {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.tally {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.02em;
	}
	.tally--risk {
		color: var(--neg);
	}
	.tally--opp {
		color: var(--info);
	}

	.signals {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.signal {
		display: grid;
		gap: 6px;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-left: 3px solid var(--neutral);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.signal:hover {
		background: var(--surface);
		border-color: var(--border-strong);
	}
	.signal--risk {
		border-left-color: var(--neg);
	}
	.signal--opportunity {
		border-left-color: var(--info);
	}
	.signal__kind {
		font-size: 10.5px;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--neutral);
	}
	.signal--risk .signal__kind {
		color: var(--neg);
	}
	.signal--opportunity .signal__kind {
		color: var(--info);
	}
	.signal__text {
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--text);
	}
	.signal__account {
		font-size: 11.5px;
		font-weight: 700;
		color: var(--text-3);
		letter-spacing: 0.02em;
	}

	@media (max-width: 820px) {
		.signals {
			grid-template-columns: 1fr;
		}
		.meter {
			display: none;
		}
		.brief__meta {
			display: none;
		}
	}
</style>
