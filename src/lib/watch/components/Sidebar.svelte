<script lang="ts">
	import type { AccountSummary, AuthUser } from '$lib/watch/types';
	import { SEGMENTS } from '$lib/watch/segments';

	let {
		user,
		accounts,
		path,
		search = '',
		showAdmin = false
	}: {
		user: AuthUser;
		accounts: AccountSummary[];
		path: string;
		search?: string;
		showAdmin?: boolean;
	} = $props();

	const activeSegment = $derived(new URLSearchParams(search).get('segment'));

	const segCounts = $derived.by(() => {
		const m = new Map<string, number>();
		for (const a of accounts) m.set(a.segment ?? 'other', (m.get(a.segment ?? 'other') ?? 0) + 1);
		return SEGMENTS.map((s) => ({ ...s, count: m.get(s.key) ?? 0 })).filter((s) => s.count > 0);
	});

	const nav = [
		{ href: '/watch/dashboard', label: 'Dashboard', icon: '▤' },
		{ href: '/watch/feed', label: 'News Feed', icon: '📰' },
		{ href: '/watch/accounts', label: 'Accounts', icon: '🏢' }
	];
</script>

<aside class="sidebar">
	<a href="/watch/dashboard" class="brand">
		<img class="brand__logo" src="/cosol-logo.svg" alt="COSOL" width="609" height="203" />
		<small class="brand__sub">Customer Watch</small>
	</a>

	<nav class="nav">
		{#each nav as n (n.href)}
			<a href={n.href} class="nav__link" class:active={path === n.href}>
				<span class="nav__ico" aria-hidden="true">{n.icon}</span>{n.label}
			</a>
		{/each}
		{#if showAdmin}
			<a href="/watch/admin" class="nav__link" class:active={path.startsWith('/watch/admin')}>
				<span class="nav__ico" aria-hidden="true">⚙︎</span>Admin
			</a>
		{/if}
	</nav>

	{#if segCounts.length}
		<div class="seg">
			<p class="seg__title">Customer Segments</p>
			<ul>
				{#each segCounts as s (s.key)}
					<li>
						<a
							href="/watch/accounts?segment={s.key}"
							class="seg__row"
							class:active={activeSegment === s.key}
						>
							<span class="seg__ico" style="color:{s.accent}" aria-hidden="true">{s.icon}</span>
							<span class="seg__label">{s.label}</span>
							<span class="seg__count">{s.count}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="sidebar__foot">
		<div class="me">
			<span class="me__avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
			<span class="me__id">
				<strong>{user.fullName}</strong>
				<small>{user.pod ? `${user.pod} · ` : ''}{user.role === 'admin' ? 'Admin' : 'Member'}</small
				>
			</span>
		</div>
		<form method="POST" action="/watch/logout">
			<button class="me__out" title="Sign out" aria-label="Sign out">⎋</button>
		</form>
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 18px 14px;
		background: var(--brand);
		color: #cdd8e6;
		height: 100dvh;
		position: sticky;
		top: 0;
	}
	.brand {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 5px;
		padding: 2px 6px 14px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.brand__logo {
		height: 26px;
		width: auto;
		display: block;
	}
	.brand__sub {
		color: #8aa0bb;
		font-size: 10.5px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		padding-left: 2px;
	}
	.nav {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.nav__link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 11px;
		border-radius: 9px;
		font-weight: 600;
		font-size: 13.5px;
		color: #b7c4d6;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.nav__link:hover {
		background: rgba(255, 255, 255, 0.06);
		color: #fff;
	}
	.nav__link.active {
		background: rgba(14, 165, 183, 0.18);
		color: #fff;
		box-shadow: inset 3px 0 0 var(--accent);
	}
	.nav__ico {
		width: 18px;
		text-align: center;
		font-size: 14px;
	}
	.seg__title {
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #7d92ac;
		padding: 0 8px 8px;
	}
	.seg__row {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 7px 9px;
		border-radius: 8px;
		font-size: 13px;
		color: #b7c4d6;
	}
	.seg__row:hover {
		background: rgba(255, 255, 255, 0.06);
		color: #fff;
	}
	.seg__row.active {
		background: rgba(255, 255, 255, 0.09);
		color: #fff;
	}
	.seg__ico {
		font-size: 13px;
	}
	.seg__label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.seg__count {
		font-size: 11.5px;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 999px;
		padding: 1px 8px;
		color: #d4deec;
	}
	.sidebar__foot {
		margin-top: auto;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 8px 4px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.me {
		display: flex;
		align-items: center;
		gap: 9px;
		flex: 1;
		min-width: 0;
	}
	.me__avatar {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--accent);
		color: #04303a;
		font-weight: 700;
		flex: none;
	}
	.me__id {
		min-width: 0;
	}
	.me__id strong {
		display: block;
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.me__id small {
		color: #8aa0bb;
		font-size: 11px;
	}
	.me__out {
		color: #b7c4d6;
		font-size: 17px;
		padding: 6px;
		border-radius: 8px;
	}
	.me__out:hover {
		background: rgba(255, 255, 255, 0.08);
		color: #fff;
	}
</style>
