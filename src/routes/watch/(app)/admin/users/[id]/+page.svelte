<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { segmentDef } from '$lib/watch/segments';
	import Monogram from '$lib/watch/components/Monogram.svelte';
	import { untrack } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let query = $state('');
	// UI selection state (id → checked). Submitted via hidden inputs so filtering the
	// visible list never drops hidden selections. Seeded once from the loaded data.
	let checked = $state<Record<string, boolean>>(
		untrack(() =>
			Object.fromEntries(data.accounts.map((a) => [a.id, data.assigned.includes(a.id)]))
		)
	);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data.accounts;
		return data.accounts.filter(
			(a) =>
				a.name.toLowerCase().includes(q) ||
				(a.pod ?? '').toLowerCase().includes(q) ||
				segmentDef(a.segment).label.toLowerCase().includes(q)
		);
	});
	const selectedIds = $derived(data.accounts.filter((a) => checked[a.id]).map((a) => a.id));

	const setFiltered = (v: boolean) => {
		for (const a of filtered) checked[a.id] = v;
	};
	const selectPod = () => {
		for (const a of data.accounts) if (a.pod && a.pod === data.u.pod) checked[a.id] = true;
	};
</script>

<svelte:head><title>{data.u.fullName} · Admin · Account Intel</title></svelte:head>

<a class="back" href="/watch/admin">← All users</a>

{#if form?.reset}
	<p class="banner ok">
		Reset password for <strong>{form.reset.email}</strong>: <code>{form.reset.tempPassword}</code> — shown
		once.
	</p>
{/if}
{#if form?.saved !== undefined}
	<p class="banner ok">
		Saved — {form.saved} account{form.saved === 1 ? '' : 's'} assigned to this user.
	</p>
{/if}
{#if form?.toggledActive !== undefined}
	<p class="banner ok">User {form.toggledActive ? 'enabled' : 'disabled'}.</p>
{/if}
{#if form?.error}<p class="banner err">{form.error}</p>{/if}

<header class="card uhead">
	<div class="uhead__id">
		<h2>
			{data.u.fullName}{#if !data.u.isActive}<span class="badge">disabled</span>{/if}
		</h2>
		<p class="muted">{data.u.email} · {data.u.role} · POD {data.u.pod ?? '—'}</p>
	</div>
	<div class="uhead__actions">
		<form method="POST" action="?/toggleActive" use:enhance>
			<button class="btn btn--sm">{data.u.isActive ? 'Disable user' : 'Enable user'}</button>
		</form>
		<form method="POST" action="?/resetPassword" use:enhance>
			<button class="btn btn--sm">Reset password</button>
		</form>
	</div>
</header>

<form method="POST" action="?/save" use:enhance class="assign card">
	<div class="assign__head">
		<span class="card__title"
			>🔑 Account access — {selectedIds.length} / {data.accounts.length}</span
		>
		<button class="btn btn--primary btn--sm" type="submit">Save assignments</button>
	</div>

	<div class="assign__tools">
		<input
			class="input search"
			placeholder="Search accounts…"
			bind:value={query}
			autocomplete="off"
		/>
		<button type="button" class="btn btn--sm" onclick={() => setFiltered(true)}>Select shown</button
		>
		<button type="button" class="btn btn--sm" onclick={() => setFiltered(false)}>Clear shown</button
		>
		{#if data.u.pod}
			<button type="button" class="btn btn--sm" onclick={selectPod}>Select POD {data.u.pod}</button>
		{/if}
	</div>

	<!-- The real submission: hidden inputs for every selected id (filter-proof). -->
	{#each selectedIds as id (id)}
		<input type="hidden" name="account" value={id} />
	{/each}

	<div class="assign__list">
		{#each filtered as a (a.id)}
			<label class="arow" class:on={checked[a.id]}>
				<input
					type="checkbox"
					checked={checked[a.id] ?? false}
					onchange={(e) => (checked[a.id] = e.currentTarget.checked)}
				/>
				<Monogram name={a.name} segment={a.segment} slug={a.slug} size={28} />
				<span class="arow__name">{a.name}</span>
				<span class="arow__meta">
					{segmentDef(a.segment).label}{#if a.pod}
						· POD {a.pod}{/if}
				</span>
			</label>
		{/each}
		{#if filtered.length === 0}<p class="muted empty">No accounts match “{query}”.</p>{/if}
	</div>
</form>

<style>
	.back {
		display: inline-block;
		color: var(--text-3);
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 12px;
	}
	.back:hover {
		color: var(--accent-ink);
	}
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
	}
	.uhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 16px 18px;
		margin-bottom: 14px;
		flex-wrap: wrap;
	}
	.uhead__id h2 {
		font-size: 19px;
		font-weight: 800;
	}
	.uhead__actions {
		display: flex;
		gap: 8px;
	}
	.badge {
		font-size: 10.5px;
		background: var(--neg-bg);
		color: var(--neg);
		padding: 1px 6px;
		border-radius: 999px;
		margin-left: 8px;
	}
	.assign__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 18px;
		border-bottom: 1px solid var(--border);
	}
	.assign__tools {
		display: flex;
		gap: 8px;
		padding: 12px 18px;
		align-items: center;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--border);
	}
	.search {
		flex: 1;
		min-width: 180px;
		height: 34px;
	}
	.assign__list {
		max-height: 60vh;
		overflow-y: auto;
		padding: 8px 10px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 2px;
	}
	.arow {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 13.5px;
	}
	.arow:hover {
		background: var(--surface-2);
	}
	.arow.on {
		background: rgba(14, 165, 183, 0.08);
	}
	.arow input {
		width: 16px;
		height: 16px;
		accent-color: var(--accent);
		flex: none;
	}
	.arow__name {
		font-weight: 600;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.arow__meta {
		font-size: 11.5px;
		color: var(--text-3);
		white-space: nowrap;
	}
	.empty {
		padding: 20px;
	}
</style>
