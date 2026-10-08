<script lang="ts">
	import { SIGNAL_TYPES, signalLabel, type AccountSignalView } from '$lib/watch/types';

	let {
		signals = [],
		selectedSignalId = ''
	}: {
		signals: AccountSignalView[];
		selectedSignalId?: string;
	} = $props();

	const signalOptions = Object.entries(SIGNAL_TYPES);
	const hasRfb = $derived(signals.some((signal) => signal.kind === 'rfb'));
</script>

<section class="card watch-setup">
	<div class="card__head setup-head">
		<div>
			<span class="card__title">🎯 Account watch setup</span>
			<p>
				Only business-relevant stories are kept. Add the exact buying or risk signals this account
				needs.
			</p>
		</div>
		<span class="strict"><span></span> Strict business filter on</span>
	</div>

	<div class="setup-body">
		{#if !hasRfb}
			<div class="rfb-callout">
				<div>
					<strong>Track RFB and bid opportunities</strong>
					<p>Add a high-priority watch for RFB, RFP, tenders, procurement notices and EOIs.</p>
				</div>
				<form method="POST" action="?/addRfbSignal">
					<button class="btn btn--accent btn--sm">Add RFB watch</button>
				</form>
			</div>
		{/if}

		<form class="signal-form" method="POST" action="?/addSignal">
			<div class="field">
				<label for="signal-name">Signal name</label>
				<input
					id="signal-name"
					class="input"
					name="name"
					placeholder="e.g. SAP transformation"
					required
				/>
			</div>
			<div class="field terms-field">
				<label for="signal-terms">Terms to look for</label>
				<input
					id="signal-terms"
					class="input"
					name="terms"
					placeholder="SAP S/4HANA, ERP modernisation, cloud migration"
					required
				/>
				<small>Separate phrases with commas. A story matches when any term appears.</small>
			</div>
			<div class="field">
				<label for="signal-excludes">Exclude terms</label>
				<input
					id="signal-excludes"
					class="input"
					name="excludeTerms"
					placeholder="optional noise terms"
				/>
			</div>
			<div class="field">
				<label for="signal-type">Category</label>
				<select id="signal-type" class="input" name="signalType">
					{#each signalOptions as [value, option]}
						<option {value}>{option.label}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="signal-kind">Tracking mode</label>
				<select id="signal-kind" class="input" name="kind">
					<option value="watch">News signal</option>
					<option value="rfb">RFB / bid opportunity</option>
				</select>
			</div>
			<label class="priority-check">
				<input type="checkbox" name="isPriority" value="1" />
				<span>High priority</span>
			</label>
			<button class="btn btn--primary">Add signal</button>
		</form>

		<div class="signal-list-head">
			<div>
				<strong>Configured signals</strong>
				<span>{signals.filter((signal) => signal.isActive).length} active</span>
			</div>
			{#if selectedSignalId}<a class="clear" href="?">Clear news filter ×</a>{/if}
		</div>

		<div class="signal-list">
			{#each signals as signal (signal.id)}
				<article
					class="signal-row"
					class:inactive={!signal.isActive}
					class:selected={selectedSignalId === signal.id}
				>
					<div class="signal-row__main">
						<div class="signal-row__title">
							<strong>{signal.name}</strong>
							<span class="chip chip--signal">{signalLabel(signal.signalType).label}</span>
							{#if signal.kind === 'rfb'}<span class="rfb-badge">RFB</span>{/if}
							{#if signal.isPriority}<span class="priority-badge">Priority</span>{/if}
						</div>
						<p>{signal.terms.join(' · ')}</p>
						{#if signal.excludeTerms.length}<small
								>Excludes: {signal.excludeTerms.join(' · ')}</small
							>{/if}
					</div>
					<div class="signal-row__actions">
						<a
							class="match-count"
							href="?signal={signal.id}"
							aria-label="Filter news by {signal.name}"
						>
							<strong>{signal.matchCount}</strong><span>matches</span>
						</a>
						<form method="POST" action="?/toggleSignal">
							<input type="hidden" name="signalId" value={signal.id} />
							<input type="hidden" name="active" value={signal.isActive ? '0' : '1'} />
							<button class="btn btn--sm">{signal.isActive ? 'Pause' : 'Resume'}</button>
						</form>
						<form
							method="POST"
							action="?/deleteSignal"
							onsubmit={(event) => {
								if (!confirm(`Delete “${signal.name}”? Existing follow-ups will be kept.`))
									event.preventDefault();
							}}
						>
							<input type="hidden" name="signalId" value={signal.id} />
							<button class="delete" aria-label="Delete {signal.name}">Delete</button>
						</form>
					</div>
				</article>
			{:else}
				<div class="empty-signals">
					<strong>No account-specific signals yet</strong>
					<p>Add buying triggers, programmes, risks, subsidiaries, or an RFB watch above.</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.watch-setup {
		margin-bottom: 14px;
		overflow: hidden;
	}
	.setup-head {
		align-items: flex-start;
		background: linear-gradient(135deg, #f7fbfc, #fff);
	}
	.setup-head p {
		margin-top: 5px;
		font-size: 13px;
		color: var(--text-3);
		max-width: 70ch;
	}
	.strict {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 11.5px;
		font-weight: 700;
		color: var(--pos);
		background: var(--pos-bg);
		padding: 5px 10px;
		border-radius: 999px;
		white-space: nowrap;
	}
	.strict span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--pos);
	}
	.setup-body {
		padding: 18px;
	}
	.rfb-callout {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		padding: 12px 14px;
		border: 1px solid rgba(14, 165, 183, 0.28);
		border-radius: 10px;
		background: rgba(14, 165, 183, 0.07);
		margin-bottom: 16px;
	}
	.rfb-callout strong {
		font-size: 13.5px;
	}
	.rfb-callout p {
		font-size: 12.5px;
		color: var(--text-2);
		margin-top: 2px;
	}
	.signal-form {
		display: grid;
		grid-template-columns: 1.1fr 2fr 1.3fr 1fr 1.15fr auto auto;
		gap: 10px;
		align-items: end;
		padding-bottom: 18px;
		border-bottom: 1px solid var(--border);
	}
	.signal-form .input {
		height: 38px;
		padding: 0 11px;
		font-size: 12.5px;
	}
	.signal-form small {
		font-size: 10.5px;
		color: var(--text-3);
		line-height: 1.3;
	}
	.priority-check {
		display: flex;
		align-items: center;
		gap: 7px;
		height: 38px;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.signal-list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 0 8px;
	}
	.signal-list-head strong {
		font-size: 13px;
	}
	.signal-list-head span {
		font-size: 11px;
		color: var(--text-3);
		margin-left: 8px;
	}
	.clear {
		font-size: 12px;
		font-weight: 650;
		color: var(--accent-ink);
	}
	.signal-list {
		display: grid;
		gap: 8px;
	}
	.signal-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 11px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-2);
	}
	.signal-row.selected {
		border-color: var(--accent);
		box-shadow: var(--ring);
	}
	.signal-row.inactive {
		opacity: 0.58;
	}
	.signal-row__main {
		min-width: 0;
		flex: 1;
	}
	.signal-row__title {
		display: flex;
		align-items: center;
		gap: 7px;
		flex-wrap: wrap;
	}
	.signal-row__title strong {
		font-size: 13.5px;
	}
	.signal-row__main p,
	.signal-row__main small {
		display: block;
		font-size: 11.5px;
		color: var(--text-3);
		margin-top: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.rfb-badge,
	.priority-badge {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.05em;
		padding: 2px 6px;
		border-radius: 999px;
	}
	.rfb-badge {
		color: var(--accent-ink);
		background: rgba(14, 165, 183, 0.12);
	}
	.priority-badge {
		color: var(--neg);
		background: var(--neg-bg);
	}
	.signal-row__actions {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.match-count {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 50px;
		padding: 2px 8px;
		border-right: 1px solid var(--border);
	}
	.match-count strong {
		font-size: 15px;
		line-height: 1;
		color: var(--accent-ink);
	}
	.match-count span {
		font-size: 9.5px;
		color: var(--text-3);
	}
	.delete {
		font-size: 11.5px;
		font-weight: 650;
		color: var(--neg);
		padding: 6px;
	}
	.empty-signals {
		text-align: center;
		padding: 18px;
		border: 1px dashed var(--border-strong);
		border-radius: 10px;
		color: var(--text-2);
	}
	.empty-signals p {
		font-size: 12px;
		color: var(--text-3);
		margin-top: 3px;
	}
	@media (max-width: 1180px) {
		.signal-form {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (max-width: 720px) {
		.setup-head,
		.rfb-callout,
		.signal-row {
			align-items: stretch;
			flex-direction: column;
		}
		.signal-form {
			grid-template-columns: 1fr;
		}
		.signal-row__actions {
			flex-wrap: wrap;
		}
		.match-count {
			border-right: 0;
			align-items: flex-start;
		}
	}
</style>
