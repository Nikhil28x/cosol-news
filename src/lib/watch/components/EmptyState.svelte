<script lang="ts">
	let { icon = '📭', title, hint = '' }: { icon?: string; title: string; hint?: string } = $props();
</script>

<div class="empty">
	<div class="empty__icon" aria-hidden="true">{icon}</div>
	<p class="empty__title">{title}</p>
	{#if hint}<p class="empty__hint">{hint}</p>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 44px 20px;
		gap: 6px;
	}
	.empty__icon {
		font-size: 30px;
		opacity: 0.7;
	}
	.empty__title {
		font-weight: 600;
		color: var(--text-2);
	}
	.empty__hint {
		font-size: 13px;
		color: var(--text-3);
		max-width: 30ch;
	}
</style>
