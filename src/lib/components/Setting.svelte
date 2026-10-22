<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		field,
		help,
		children
	}: { label: string; field: string; help?: Snippet; children: Snippet } = $props();
</script>

<div class="setting">
	<label class="label" for={field}>{label}</label>
	<div class="control">
		{@render children()}
		{#if help}
			<p class="help">{@render help()}</p>
		{/if}
	</div>
</div>
