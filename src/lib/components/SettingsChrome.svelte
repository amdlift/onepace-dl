<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import Chrome from './Chrome.svelte';

	let { children }: { children: Snippet } = $props();

	const categories = [
		{ href: '/settings', label: 'Profile' },
		{ href: '/settings/media-management', label: 'Media Management' },
		{ href: '/settings/download-client', label: 'Download Client' },
		{ href: '/settings/metadata', label: 'Metadata' },
		{ href: '/settings/manual-import', label: 'Manual Import' },
		{ href: '/settings/security', label: 'Security' }
	];

	const current = (href: string): 'page' | undefined =>
		page.url.pathname === href ? 'page' : undefined;
</script>

<Chrome title="Settings">
	{#snippet actions()}
		<nav class="categories" aria-label="Settings">
			{#each categories as category (category.href)}
				<a href={category.href} aria-current={current(category.href)}>{category.label}</a>
			{/each}
		</nav>
	{/snippet}

	{@render children()}
</Chrome>

<style>
	.categories {
		display: flex;
		flex-wrap: wrap;
	}

	.categories a {
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--accent-bar) solid transparent;
		color: var(--ink-dim);
	}

	.categories a:hover {
		background: var(--surface-hover);
		color: var(--ink-bright);
		text-decoration: none;
	}

	.categories a[aria-current='page'] {
		border-bottom-color: var(--nav-active);
		color: var(--ink-bright);
	}
</style>
