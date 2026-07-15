<script lang="ts">
	import type { FeedItem } from '$lib/watch/types';
	import { segmentDef } from '$lib/watch/segments';
	import { newsImage, stockImage, relativeTime } from '$lib/watch/format';

	let { item, variant = 'card' }: { item: FeedItem; variant?: 'hero' | 'wide' | 'card' } = $props();

	const seg = $derived(segmentDef(item.account.segment));
	const overlay = $derived(variant !== 'card');
	const when = $derived(relativeTime(item.publishedAt ?? item.fetchedAt));
	// Real fetched image, else a themed stock placeholder (the accent gradient shows
	// behind if even the placeholder fails to load).
	const img = $derived(newsImage(item) ?? stockImage(item.account.segment));

	// Other outlets covering the same story, collapsed into this lead by clusterStories.
	const moreSources = $derived(item.moreSources ?? []);
	const moreTip = $derived(
		moreSources
			.map((s) => s.source)
			.filter(Boolean)
			.join(' · ') || undefined
	);

	function markBroken(node: HTMLImageElement) {
		node.style.visibility = 'hidden';
	}
	function onImgError(e: Event) {
		markBroken(e.currentTarget as HTMLImageElement);
	}
	// onImgError is only attached at hydration, but an above-the-fold hero image can
	// finish loading — and fail — during the SSR→hydration window, before the handler
	// exists (Svelte never replays that missed error event). This action runs on mount
	// and hides an image that already failed, so the accent gradient still shows.
	function coverImage(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth === 0) markBroken(node);
	}
</script>

<a
	class="tile tile--{variant}"
	class:overlay
	href={item.url}
	target="_blank"
	rel="noopener noreferrer"
	style="--accent:{seg.accent}"
>
	<div class="media">
		<!-- {#key img}: remount on src change so a reused tile never keeps a stale hide -->
		{#key img}
			<img src={img} alt="" loading="lazy" onerror={onImgError} use:coverImage />
		{/key}
		<span class="chip">{seg.icon} {seg.label}</span>
		{#if overlay}
			<div class="scrim"></div>
			<div class="overlay-body">
				<h3 class="title">{item.title}</h3>
				<p class="meta">
					📍 {item.account.name} · {when}{#if item.source}
						· {item.source}{/if}
				</p>
				{#if moreSources.length}
					<span class="more more--overlay" title={moreTip}
						>＋{moreSources.length} more source{moreSources.length > 1 ? 's' : ''}</span
					>
				{/if}
			</div>
		{/if}
	</div>
	{#if !overlay}
		<div class="body">
			<h3 class="title">{item.title}</h3>
			<p class="meta">📍 {item.account.name} · {when}</p>
			{#if moreSources.length}
				<span class="more" title={moreTip}
					>＋{moreSources.length} more source{moreSources.length > 1 ? 's' : ''}</span
				>
			{/if}
		</div>
	{/if}
</a>

<style>
	.tile {
		display: block;
		border-radius: 16px;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-sm);
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
	}
	.tile:hover {
		transform: translateY(-3px);
		box-shadow: var(--shadow);
	}

	.media {
		position: relative;
		width: 100%;
		background: linear-gradient(155deg, var(--accent) 0%, #0f1b2d 85%);
		overflow: hidden;
	}
	.media img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.tile--hero {
		height: 100%;
	}
	.tile--hero .media {
		height: 100%;
		aspect-ratio: auto;
	}
	.tile--wide .media {
		aspect-ratio: 16 / 9;
	}
	.tile--card .media {
		aspect-ratio: 16 / 10;
	}

	.chip {
		position: absolute;
		top: 12px;
		left: 12px;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 999px;
		font-size: 11.5px;
		font-weight: 700;
		color: #fff;
		background: color-mix(in srgb, var(--accent) 58%, #05070d);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(4px);
		max-width: calc(100% - 24px);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(4, 8, 18, 0.92) 8%,
			rgba(4, 8, 18, 0.35) 45%,
			transparent 70%
		);
		z-index: 1;
	}
	.overlay-body {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 2;
		padding: 18px 20px;
		color: #fff;
	}

	.title {
		font-weight: 800;
		letter-spacing: -0.01em;
		line-height: 1.2;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.overlay-body .title {
		color: #fff;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
	}
	.tile--hero .title {
		font-size: 26px;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}
	.tile--wide .title {
		font-size: 18px;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}
	.tile--card .title {
		font-size: 14.5px;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		color: var(--text);
	}

	.meta {
		margin-top: 8px;
		font-size: 12.5px;
		font-weight: 500;
	}
	.overlay-body .meta {
		color: rgba(255, 255, 255, 0.82);
	}

	.body {
		padding: 14px 16px 16px;
	}
	.body .meta {
		color: var(--text-3);
	}

	.more {
		display: inline-block;
		margin-top: 8px;
		font-size: 11px;
		font-weight: 700;
		padding: 2px 9px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent-ink);
		cursor: default;
	}
	.more--overlay {
		margin-top: 10px;
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
		backdrop-filter: blur(4px);
	}

	@media (max-width: 640px) {
		.tile--hero .title {
			font-size: 21px;
		}
	}
</style>
