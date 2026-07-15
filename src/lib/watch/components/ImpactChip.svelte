<script lang="ts">
	import type { ImpactKind } from '$lib/watch/types';

	let { kind = null, label = null }: { kind?: ImpactKind | null; label?: string | null } = $props();
	const cls = $derived(
		kind === 'opportunity' ? 'chip--opportunity' : kind === 'risk' ? 'chip--risk' : 'chip--neutral'
	);
</script>

{#if label}
	<span class="chip {cls}">{label}</span>
{/if}
