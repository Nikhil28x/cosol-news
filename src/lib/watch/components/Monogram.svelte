<script lang="ts">
	import { initials, monogramColor } from '$lib/watch/format';

	let {
		name,
		segment = null,
		size = 38,
		slug = null,
		logoUrl = null
	}: {
		name: string;
		segment?: string | null;
		size?: number;
		slug?: string | null;
		logoUrl?: string | null;
	} = $props();

	let imageFailed = $state(false);
	const imageSource = $derived(slug ? `/account-logos/${slug}.png` : logoUrl);
</script>

<span
	class="mono"
	class:has-logo={imageSource && !imageFailed}
	style="width:{size}px;height:{size}px;background:{imageSource && !imageFailed
		? '#fff'
		: monogramColor(segment)};font-size:{size * 0.34}px"
>
	{#if imageSource && !imageFailed}
		<img src={imageSource} alt="" onerror={() => (imageFailed = true)} />
	{:else}
		{initials(name)}
	{/if}
</span>

<style>
	.mono.has-logo {
		border: 1px solid var(--border);
		padding: 5px;
		overflow: hidden;
	}
	.mono img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
</style>
