<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { segmentDef } from '$lib/watch/segments';
	import { relativeTime } from '$lib/watch/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let ingesting = $state(false);
</script>

<svelte:head><title>Admin · COSOL Customer Watch</title></svelte:head>

{#if form?.error}<p class="banner err">{form.error}</p>{/if}
{#if form?.created}
	<p class="banner ok">
		Created <strong>{form.created.email}</strong> ({form.created.assigned} accounts assigned). Temp password:
		<code>{form.created.tempPassword}</code> — share it securely; shown once.
	</p>
{/if}
{#if form?.reset}
	<p class="banner ok">
		Reset password for <strong>{form.reset.email}</strong>. New temp password:
		<code>{form.reset.tempPassword}</code> — shown once.
	</p>
{/if}
{#if form?.ran}
	<p class="banner ok">
		Ingestion ({form.ran.scope}): {form.ran.accounts} accounts, {form.ran.news} new items,
		{form.ran.errors} errors.
	</p>
{/if}

<section class="ov">
	<div class="ov__card"><span>{data.overview.users}</span><small>Users</small></div>
	<div class="ov__card"><span>{data.overview.accounts}</span><small>Accounts</small></div>
	<div class="ov__card"><span>{data.overview.news}</span><small>News items</small></div>
	<div class="ov__card"><span>{data.overview.runs}</span><small>Ingestion runs</small></div>
</section>

<!-- Ingestion -->
<section class="card blk">
	<div class="card__head">
		<span class="card__title">🛰 Research Agents</span>
		<form
			method="POST"
			action="?/ingestAll"
			use:enhance={() => {
				ingesting = true;
				return async ({ update }) => {
					await update();
					ingesting = false;
				};
			}}
		>
			<button class="btn btn--accent btn--sm" disabled={ingesting}>
				{ingesting ? 'Running…' : 'Run ingestion (all)'}
			</button>
		</form>
	</div>
	<div class="card__body pad0">
		<div class="table-wrap">
			<table class="tbl">
				<thead>
					<tr
						><th>Account</th><th>Source</th><th>Status</th><th>Found</th><th>New</th><th
							>Enriched</th
						><th>When</th></tr
					>
				</thead>
				<tbody>
					{#each data.runs as r (r.id)}
						<tr>
							<td>{r.accountName ?? '—'}</td>
							<td class="muted">{r.source}</td>
							<td><span class="st st--{r.status}">{r.status}</span></td>
							<td>{r.itemsFound}</td>
							<td>{r.itemsNew}</td>
							<td>{r.itemsEnriched}</td>
							<td class="muted">{relativeTime(r.startedAt)}</td>
						</tr>
					{:else}
						<tr><td colspan="7" class="muted pad">No runs yet. Click “Run ingestion”.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

<!-- Users -->
<section class="card blk">
	<div class="card__head"><span class="card__title">👥 Users</span></div>
	<div class="card__body">
		<form method="POST" action="?/createUser" use:enhance class="urow">
			<input class="input" name="fullName" placeholder="Full name" required />
			<input class="input" name="email" type="email" placeholder="email@cosol.in" required />
			<input class="input" name="pod" placeholder="POD (optional)" />
			<select class="input" name="role">
				<option value="member">Member</option>
				<option value="admin">Admin</option>
			</select>
			<button class="btn btn--primary">Add user</button>
		</form>

		<div class="table-wrap">
			<table class="tbl">
				<thead>
					<tr
						><th>Name</th><th>Email</th><th>Role</th><th>POD</th><th>Accounts</th><th>Last login</th
						><th></th></tr
					>
				</thead>
				<tbody>
					{#each data.users as u (u.id)}
						<tr class:inactive={!u.isActive}>
							<td
								>{u.fullName}{#if !u.isActive}<span class="badge">disabled</span>{/if}</td
							>
							<td class="muted">{u.email}</td>
							<td>{u.role}</td>
							<td class="muted">{u.pod ?? '—'}</td>
							<td>{u.accountCount}</td>
							<td class="muted">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : 'never'}</td>
							<td class="actions">
								<a class="btn btn--sm btn--primary" href="/watch/admin/users/{u.id}">Manage</a>
								{#if u.id !== data.meId && u.isActive}
									<form method="POST" action="/watch/view-as">
										<input type="hidden" name="userId" value={u.id} />
										<button class="btn btn--sm btn--accent">View as</button>
									</form>
								{/if}
								<form method="POST" action="?/resetPassword" use:enhance>
									<input type="hidden" name="userId" value={u.id} />
									<button class="btn btn--sm">Reset pw</button>
								</form>
								<form method="POST" action="?/toggleUser" use:enhance>
									<input type="hidden" name="userId" value={u.id} />
									<button class="btn btn--sm">{u.isActive ? 'Disable' : 'Enable'}</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

<!-- Accounts -->
<section class="card blk">
	<div class="card__head"><span class="card__title">🏢 Accounts</span></div>
	<div class="card__body pad0">
		<div class="table-wrap">
			<table class="tbl">
				<thead>
					<tr><th>Account</th><th>Segment</th><th>POD</th><th>News</th><th></th></tr>
				</thead>
				<tbody>
					{#each data.accounts as a (a.id)}
						<tr>
							<td><a class="link" href="/watch/accounts/{a.slug}">{a.name}</a></td>
							<td class="muted">{segmentDef(a.segment).label}</td>
							<td class="muted">{a.pod ?? '—'}</td>
							<td>{a.newsCount}</td>
							<td class="actions">
								<form method="POST" action="?/ingestOne" use:enhance>
									<input type="hidden" name="accountId" value={a.id} />
									<button class="btn btn--sm">Refresh</button>
								</form>
							</td>
						</tr>
					{:else}
						<tr
							><td colspan="5" class="muted pad"
								>No accounts yet — seed them from the account list.</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

<style>
	.banner {
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 13px;
		margin-bottom: 14px;
	}
	.banner.ok {
		background: var(--pos-bg);
		color: var(--pos);
	}
	.banner.err {
		background: var(--neg-bg);
		color: var(--neg);
	}
	.banner code {
		background: rgba(0, 0, 0, 0.06);
		padding: 1px 6px;
		border-radius: 5px;
		font-family: var(--mono);
		font-size: 12.5px;
	}
	.ov {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		margin-bottom: 16px;
	}
	.ov__card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-sm);
		padding: 16px;
		display: flex;
		flex-direction: column;
	}
	.ov__card span {
		font-size: 26px;
		font-weight: 800;
	}
	.ov__card small {
		color: var(--text-3);
		font-size: 12px;
		font-weight: 500;
	}
	.blk {
		margin-bottom: 16px;
	}
	.pad0 {
		padding: 0;
	}
	.pad {
		padding: 18px 16px;
	}
	.urow {
		display: grid;
		grid-template-columns: 1.2fr 1.4fr 1fr 0.8fr auto;
		gap: 8px;
		margin-bottom: 14px;
	}
	.table-wrap {
		overflow-x: auto;
	}
	.tbl {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.tbl th {
		text-align: left;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-3);
		font-weight: 700;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	.tbl td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	.tbl tbody tr:last-child td {
		border-bottom: 0;
	}
	tr.inactive {
		opacity: 0.55;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	.badge {
		font-size: 10.5px;
		background: var(--neg-bg);
		color: var(--neg);
		padding: 1px 6px;
		border-radius: 999px;
		margin-left: 6px;
	}
	.st {
		font-size: 11.5px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 999px;
		text-transform: capitalize;
	}
	.st--success {
		background: var(--pos-bg);
		color: var(--pos);
	}
	.st--error {
		background: var(--neg-bg);
		color: var(--neg);
	}
	.st--running,
	.st--queued {
		background: var(--warn-bg);
		color: var(--warn);
	}
	@media (max-width: 860px) {
		.ov {
			grid-template-columns: repeat(2, 1fr);
		}
		.urow {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
