<script lang="ts">
	import { page } from '$app/state';
	import type { AuthUser } from '$lib/watch/types';

	let { user }: { user: AuthUser } = $props();

	const TITLES: [string, string][] = [
		['/watch/dashboard', 'Dashboard'],
		['/watch/feed', 'News Feed'],
		['/watch/accounts', 'Accounts'],
		['/watch/admin', 'Admin'],
		['/watch/account', 'My Account']
	];
	const title = $derived(
		TITLES.find(([p]) => page.url.pathname.startsWith(p))?.[1] ?? 'Customer Watch'
	);

	let today = $state('');
	$effect(() => {
		today = new Date().toLocaleDateString('en-AU', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	});
</script>

<header class="topbar">
	<h1 class="topbar__title">{title}</h1>

	<form class="search" method="GET" action="/watch/accounts" role="search">
		<span class="search__ico" aria-hidden="true">⌕</span>
		<input
			class="search__input"
			name="q"
			placeholder="Search accounts…"
			value={page.url.pathname === '/watch/accounts' ? (page.url.searchParams.get('q') ?? '') : ''}
			autocomplete="off"
		/>
	</form>

	<div class="topbar__right">
		<span class="live"><span class="live__dot"></span>LIVE</span>
		<span class="topbar__date">{today}</span>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 14px 26px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 20;
	}
	.topbar__title {
		font-size: 19px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.search {
		position: relative;
		margin-left: 8px;
		flex: 1;
		max-width: 380px;
	}
	.search__ico {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-3);
		font-size: 16px;
	}
	.search__input {
		width: 100%;
		height: 38px;
		padding: 0 14px 0 34px;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		background: var(--surface-2);
	}
	.search__input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: var(--ring);
		background: var(--surface);
	}
	.topbar__right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.topbar__date {
		font-size: 13px;
		color: var(--text-2);
		font-weight: 500;
		white-space: nowrap;
	}
	@media (max-width: 720px) {
		.search {
			display: none;
		}
		.topbar__date {
			display: none;
		}
	}
</style>
