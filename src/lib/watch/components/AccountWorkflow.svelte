<script lang="ts">
	import {
		ACTION_STATUS_LABELS,
		type AccountActionView,
		type AccountSignalView,
		type ActionStatus
	} from '$lib/watch/types';
	import { relativeTime } from '$lib/watch/format';

	let {
		actions = [],
		signals = []
	}: {
		actions: AccountActionView[];
		signals: AccountSignalView[];
	} = $props();

	const closed = new Set<ActionStatus>(['done', 'won', 'lost']);
	const openFollowUps = $derived(
		actions.filter((action) => action.kind === 'follow_up' && !closed.has(action.status)).length
	);
	const activeRfbs = $derived(
		actions.filter((action) => action.kind === 'rfb' && !closed.has(action.status)).length
	);
	const statuses = Object.entries(ACTION_STATUS_LABELS) as [ActionStatus, string][];

	function inputDay(value: Date | null): string {
		return value ? value.toISOString().slice(0, 10) : '';
	}

	function dueLabel(value: Date | null): string {
		if (!value) return 'No due date';
		return new Intl.DateTimeFormat('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(value);
	}
</script>

<section class="card workflow">
	<div class="card__head workflow-head">
		<div>
			<span class="card__title">✅ Follow-ups & RFB tracker</span>
			<p>Turn a business signal into a next action and keep bid opportunities moving.</p>
		</div>
		<div class="workflow-kpis">
			<div><strong>{openFollowUps}</strong><span>Open follow-ups</span></div>
			<div><strong>{activeRfbs}</strong><span>Active RFBs</span></div>
		</div>
	</div>

	<div class="workflow-body">
		<form class="action-create" method="POST" action="?/createAction">
			<div class="field">
				<label for="action-kind">Type</label>
				<select id="action-kind" class="input" name="kind">
					<option value="follow_up">Follow-up</option>
					<option value="rfb">RFB / bid</option>
				</select>
			</div>
			<div class="field title-field">
				<label for="action-title">Next action</label>
				<input
					id="action-title"
					class="input"
					name="title"
					placeholder="e.g. Contact procurement team"
					required
				/>
			</div>
			<div class="field">
				<label for="action-signal">Related signal</label>
				<select id="action-signal" class="input" name="signalId">
					<option value="">None</option>
					{#each signals.filter((signal) => signal.isActive) as signal (signal.id)}
						<option value={signal.id}>{signal.name}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="action-due">Due date</label>
				<input id="action-due" class="input" type="date" name="dueAt" />
			</div>
			<label class="priority-check">
				<input type="checkbox" name="priority" value="high" />
				<span>High priority</span>
			</label>
			<button class="btn btn--primary">Add action</button>
			<div class="field notes-field">
				<label for="action-notes">Notes</label>
				<textarea
					id="action-notes"
					class="notes"
					name="notes"
					rows="2"
					placeholder="Owner context, bid reference, or next step"></textarea>
			</div>
		</form>

		<div class="action-list">
			{#each actions as action (action.id)}
				<article
					class="action-row"
					class:closed={closed.has(action.status)}
					class:high={action.priority === 'high'}
				>
					<div class="action-icon" class:rfb={action.kind === 'rfb'}>
						{action.kind === 'rfb' ? 'RFB' : '↗'}
					</div>
					<div class="action-main">
						<div class="action-title">
							<strong>{action.title}</strong>
							<span class="kind">{action.kind === 'rfb' ? 'Bid opportunity' : 'Follow-up'}</span>
							{#if action.priority === 'high'}<span class="high-badge">High</span>{/if}
						</div>
						<div class="action-meta">
							<span>{dueLabel(action.dueAt)}</span>
							{#if action.assigneeName}<span>Owner: {action.assigneeName}</span>{/if}
							{#if action.signalName}<span>Signal: {action.signalName}</span>{/if}
							<span>Added {relativeTime(action.createdAt)}</span>
						</div>
						{#if action.notes}<p>{action.notes}</p>{/if}
						{#if action.newsUrl}
							<a
								class="source-link"
								href={action.newsUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								Source: {action.newsTitle ?? 'Open story'} ↗
							</a>
						{/if}
					</div>
					<form class="action-controls" method="POST" action="?/updateAction">
						<input type="hidden" name="actionId" value={action.id} />
						<select class="mini-input" name="status" aria-label="Status for {action.title}">
							{#each statuses as [value, label]}
								<option {value} selected={action.status === value}>{label}</option>
							{/each}
						</select>
						<input
							class="mini-input due"
							type="date"
							name="dueAt"
							value={inputDay(action.dueAt)}
							aria-label="Due date for {action.title}"
						/>
						<select class="mini-input" name="priority" aria-label="Priority for {action.title}">
							<option value="normal" selected={action.priority === 'normal'}>Normal</option>
							<option value="high" selected={action.priority === 'high'}>High</option>
						</select>
						<button class="btn btn--sm">Save</button>
					</form>
					<form
						method="POST"
						action="?/deleteAction"
						onsubmit={(event) => {
							if (!confirm('Delete this tracked action?')) event.preventDefault();
						}}
					>
						<input type="hidden" name="actionId" value={action.id} />
						<button class="remove" aria-label="Delete {action.title}">×</button>
					</form>
				</article>
			{:else}
				<div class="empty-actions">
					<strong>No follow-ups or RFBs yet</strong>
					<p>Add one above, or create it directly from a news story below.</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.workflow {
		margin-bottom: 14px;
		overflow: hidden;
	}
	.workflow-head {
		align-items: flex-start;
	}
	.workflow-head p {
		font-size: 13px;
		color: var(--text-3);
		margin-top: 5px;
	}
	.workflow-kpis {
		display: flex;
		gap: 8px;
	}
	.workflow-kpis div {
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface-2);
	}
	.workflow-kpis strong {
		font-size: 17px;
	}
	.workflow-kpis span {
		font-size: 10.5px;
		color: var(--text-3);
		white-space: nowrap;
	}
	.workflow-body {
		padding: 18px;
	}
	.action-create {
		display: grid;
		grid-template-columns: 0.8fr 1.7fr 1.2fr 0.85fr auto auto;
		gap: 10px;
		align-items: end;
		padding-bottom: 18px;
		border-bottom: 1px solid var(--border);
	}
	.action-create .input {
		height: 38px;
		font-size: 12.5px;
		padding: 0 11px;
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
	.notes-field {
		grid-column: 1 / -1;
	}
	.notes {
		width: 100%;
		resize: vertical;
		min-height: 58px;
		padding: 9px 11px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		font-size: 12.5px;
	}
	.notes:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: var(--ring);
	}
	.action-list {
		display: grid;
		gap: 8px;
		padding-top: 16px;
	}
	.action-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 11px 12px;
		border: 1px solid var(--border);
		border-left: 3px solid var(--accent);
		border-radius: 10px;
		background: var(--surface-2);
	}
	.action-row.high {
		border-left-color: var(--neg);
	}
	.action-row.closed {
		opacity: 0.58;
	}
	.action-icon {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--info-bg);
		color: var(--info);
		font-weight: 800;
		font-size: 13px;
		flex: none;
	}
	.action-icon.rfb {
		background: rgba(14, 165, 183, 0.12);
		color: var(--accent-ink);
		font-size: 9px;
		letter-spacing: 0.04em;
	}
	.action-main {
		min-width: 200px;
		flex: 1;
	}
	.action-title,
	.action-meta {
		display: flex;
		align-items: center;
		gap: 7px;
		flex-wrap: wrap;
	}
	.action-title strong {
		font-size: 13.5px;
	}
	.kind,
	.high-badge {
		font-size: 10px;
		font-weight: 750;
		padding: 2px 6px;
		border-radius: 999px;
	}
	.kind {
		background: var(--neutral-bg);
		color: var(--neutral);
	}
	.high-badge {
		background: var(--neg-bg);
		color: var(--neg);
	}
	.action-meta {
		font-size: 10.5px;
		color: var(--text-3);
		margin-top: 4px;
	}
	.action-meta span + span::before {
		content: '·';
		margin-right: 7px;
	}
	.action-main p {
		font-size: 12px;
		color: var(--text-2);
		margin-top: 5px;
	}
	.source-link {
		display: block;
		max-width: 72ch;
		font-size: 11px;
		color: var(--accent-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 4px;
	}
	.action-controls {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.mini-input {
		height: 32px;
		border: 1px solid var(--border-strong);
		border-radius: 7px;
		background: var(--surface);
		padding: 0 8px;
		font-size: 11.5px;
	}
	.mini-input.due {
		width: 128px;
	}
	.remove {
		font-size: 20px;
		line-height: 1;
		color: var(--text-3);
		padding: 4px;
	}
	.remove:hover {
		color: var(--neg);
	}
	.empty-actions {
		text-align: center;
		padding: 18px;
		border: 1px dashed var(--border-strong);
		border-radius: 10px;
		color: var(--text-2);
	}
	.empty-actions p {
		font-size: 12px;
		color: var(--text-3);
		margin-top: 3px;
	}
	@media (max-width: 1100px) {
		.action-create {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.notes-field {
			grid-column: 1 / -1;
		}
		.action-row {
			align-items: flex-start;
			flex-wrap: wrap;
		}
		.action-controls {
			margin-left: 44px;
			flex-wrap: wrap;
		}
	}
	@media (max-width: 700px) {
		.workflow-head {
			align-items: stretch;
			flex-direction: column;
		}
		.action-create {
			grid-template-columns: 1fr;
		}
		.notes-field {
			grid-column: auto;
		}
		.action-controls {
			margin-left: 0;
		}
	}
</style>
