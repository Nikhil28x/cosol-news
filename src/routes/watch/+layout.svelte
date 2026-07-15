<script lang="ts">
	import '$lib/watch/watch.css';
	let { children } = $props();
</script>

<div class="watch">
	{@render children()}
</div>
