<script lang="ts">
	import { signalLabel, type SignalType } from '$lib/watch/types';

	let { type = null }: { type?: SignalType | null } = $props();
	const s = $derived(signalLabel(type));
</script>

<span class="chip chip--signal"><span aria-hidden="true">{s.icon}</span>{s.label}</span>
