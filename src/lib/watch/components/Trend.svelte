<script lang="ts">
	import type { Sentiment } from '$lib/watch/types';

	let { pct = null, sentiment = null }: { pct?: number | null; sentiment?: Sentiment | null } =
		$props();

	const dir = $derived(
		pct != null
			? pct > 0
				? 'up'
				: pct < 0
					? 'down'
					: 'flat'
			: sentiment === 'bullish'
				? 'up'
				: sentiment === 'bearish'
					? 'down'
					: 'flat'
	);
	const arrow = $derived(dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→');
</script>

<span class="trend trend--{dir}">
	{arrow}{#if pct != null}&nbsp;{pct > 0 ? '+' : ''}{pct.toFixed(1)}%{/if}
</span>
