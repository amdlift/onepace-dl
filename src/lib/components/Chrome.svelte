<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		actions,
		controls,
		children
	}: {
		title: string;
		actions?: Snippet;
		controls?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="page-header">
	<h1>{title}</h1>
</div>

<div class="page-toolbar">
	<div class="actions">{@render actions?.()}</div>
	<div class="controls">{@render controls?.()}</div>
</div>

<div class="page-content">
	{@render children()}
</div>

<style>
	.page-header {
		display: flex;
		align-items: center;
		min-height: var(--header-height);
		padding: 0 var(--content-padding);
		background: var(--surface-raised);
		border-bottom: var(--hairline) solid var(--border);
	}

	.page-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: var(--toolbar-height);
		padding: var(--space-2) var(--toolbar-padding);
		background: var(--surface-toolbar);
		border-bottom: var(--hairline) solid var(--border);
		color: var(--ink-bright);
		font-size: var(--type-small);
	}

	.actions,
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.page-content {
		padding: var(--content-padding);
	}
</style>
