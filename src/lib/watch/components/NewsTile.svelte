<script lang="ts">
	import type { FeedItem } from '$lib/watch/types';
	import { segmentDef } from '$lib/watch/segments';
	import { newsImage, relativeTime } from '$lib/watch/format';

	let { item, variant = 'card' }: { item: FeedItem; variant?: 'hero' | 'wide' | 'card' } = $props();

	const seg = $derived(segmentDef(item.account.segment));
	const overlay = $derived(variant !== 'card');
	const when = $derived(relativeTime(item.publishedAt ?? item.fetchedAt));

	function hideBroken(e: Event) {
		(e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
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
		<img src={newsImage(item)} alt="" loading="lazy" onerror={hideBroken} />
		<span class="chip">{seg.icon} {seg.label}</span>
		{#if overlay}
			<div class="scrim"></div>
			<div class="overlay-body">
				<h3 class="title">{item.title}</h3>
				<p class="meta">
					📍 {item.account.name} · {when}{#if item.source}
						· {item.source}{/if}
				</p>
			</div>
		{/if}
	</div>
	{#if !overlay}
		<div class="body">
			<h3 class="title">{item.title}</h3>
			<p class="meta">📍 {item.account.name} · {when}</p>
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

	@media (max-width: 640px) {
		.tile--hero .title {
			font-size: 21px;
		}
	}
</style>
