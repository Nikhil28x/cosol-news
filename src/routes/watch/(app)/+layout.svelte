<script lang="ts">
	import { page } from '$app/state';
	import Sidebar from '$lib/watch/components/Sidebar.svelte';
	import Topbar from '$lib/watch/components/Topbar.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<div class="shell">
	<Sidebar
		user={data.user}
		accounts={data.accounts}
		showAdmin={data.realUser.role === 'admin'}
		path={page.url.pathname}
		search={page.url.search}
	/>
	<div class="shell__main">
		<Topbar user={data.user} />

		{#if data.viewingAs}
			<div class="viewas">
				<span>
					👁 Viewing <strong>{data.viewingAs.fullName}</strong>'s portfolio
					{#if data.viewingAs.pod}({data.viewingAs.pod}){/if} — admin impersonation
				</span>
				<form method="POST" action="/watch/view-as">
					<button class="viewas__exit">Exit to my view</button>
				</form>
			</div>
		{:else if data.realUser.mustChangePassword}
			<a class="pw-banner" href="/watch/account">
				🔑 You're using a temporary password. <strong>Set a new one →</strong>
			</a>
		{/if}

		<main class="shell__content">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 248px 1fr;
		min-height: 100dvh;
	}
	.shell__main {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.shell__content {
		padding: 22px 26px 40px;
		flex: 1;
	}
	.pw-banner {
		display: block;
		background: var(--warn-bg);
		color: var(--warn);
		padding: 9px 26px;
		font-size: 13px;
		font-weight: 500;
		border-bottom: 1px solid var(--border);
	}
	.pw-banner strong {
		text-decoration: underline;
	}
	.viewas {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		background: #1f2d45;
		color: #dbe6f5;
		padding: 8px 26px;
		font-size: 13px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.viewas strong {
		color: #fff;
	}
	.viewas__exit {
		background: var(--accent);
		color: #04303a;
		font-weight: 700;
		font-size: 12.5px;
		padding: 5px 12px;
		border-radius: 7px;
		white-space: nowrap;
	}
	.viewas__exit:hover {
		filter: brightness(1.05);
	}
	@media (max-width: 860px) {
		.shell {
			grid-template-columns: 1fr;
		}
		:global(.watch .sidebar) {
			position: static !important;
			height: auto !important;
			flex-direction: row;
			flex-wrap: wrap;
			align-items: center;
		}
	}
</style>
