import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// `script: true` forces TypeScript in `<script lang="ts">` through esbuild,
	// which correctly strips all type syntax — including the `?` on optional
	// parameters. Without it, Svelte 5's built-in stripper handles the script and
	// removes `: Type` annotations but leaves the `?`, producing invalid JS.
	preprocess: vitePreprocess({ script: true }),

	kit: {
		adapter: adapter({ runtime: 'nodejs24.x' })
	}
};

export default config;
