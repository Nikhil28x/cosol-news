import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// `script: true` forces TypeScript in `<script lang="ts">` through esbuild,
	// which correctly strips all type syntax — including the `?` on optional
	// parameters. Without it, Svelte 5's built-in stripper handles the script and
	// removes `: Type` annotations but leaves the `?`, producing invalid JS.
	preprocess: vitePreprocess({ script: true }),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;
