<script lang="ts">
	import { initials, monogramColor } from '$lib/watch/format';

	let {
		name,
		segment = null,
		size = 38
	}: { name: string; segment?: string | null; size?: number } = $props();
</script>

<span
	class="mono"
	style="width:{size}px;height:{size}px;background:{monogramColor(segment)};font-size:{size *
		0.34}px"
>
	{initials(name)}
</span>
