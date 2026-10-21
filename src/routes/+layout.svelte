<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import '../app.css';

	let { children, data }: LayoutProps = $props();

	const failing = $derived(data.failing);

	const sections = [
		{ href: '/', label: 'Arcs' },
		{ href: '/activity', label: 'Activity' },
		{ href: '/wanted', label: 'Wanted' },
		{ href: '/manual-import', label: 'Manual Import' },
		{ href: '/settings', label: 'Settings' },
		{ href: '/system', label: 'System' }
	];

	function current(href: string): 'page' | undefined {
		const path = page.url.pathname;
		const here = href === '/' ? path === '/' : path.startsWith(href);
		return here ? 'page' : undefined;
	}
</script>

<div class="shell">
	<header>
		<a class="brand" href="/">Pacerr</a>
		<span class="subject">One Pace</span>
	</header>
	<nav aria-label="Sections">
		<ul>
			{#each sections as section (section.href)}
				<li>
					<a href={section.href} aria-current={current(section.href)}>{section.label}</a>
				</li>
			{/each}
		</ul>
	</nav>
	<main>
		{#each failing as check (check.name)}
			<p class="banner">
				<strong>{check.subject}</strong>
				{check.summary}
				{#if check.detail !== null}<span class="detail">{check.detail}</span>{/if}
				<a href="/system">System</a>
			</p>
		{/each}
		{@render children()}
	</main>
</div>

<style>
	.shell {
		display: grid;
		grid-template-areas: 'header header' 'nav main';
		grid-template-columns: var(--sidebar-width) 1fr;
		grid-template-rows: var(--header-height) 1fr;
		min-height: 100vh;
	}

	header {
		grid-area: header;
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: 0 var(--space-4);
		background: var(--surface-raised);
		border-bottom: var(--hairline) solid var(--border);
		line-height: var(--header-height);
	}

	.brand {
		color: var(--brand);
		font-size: var(--type-modal-title);
		letter-spacing: var(--type-tracking);
		text-transform: uppercase;
	}

	.brand:hover {
		text-decoration: none;
	}

	.subject {
		color: var(--ink-dim);
	}

	nav {
		grid-area: nav;
		background: var(--surface-raised);
		border-right: var(--hairline) solid var(--border);
		padding-top: var(--space-2);
	}

	nav ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	nav a {
		display: block;
		padding: var(--space-2) var(--space-4);
		border-left: var(--accent-bar) solid transparent;
		color: var(--ink);
	}

	nav a:hover {
		background: var(--surface-hover);
		text-decoration: none;
	}

	nav a[aria-current='page'] {
		border-left-color: var(--nav-active);
		color: var(--ink-bright);
		background: var(--surface-hover);
	}

	main {
		grid-area: main;
		padding: var(--content-padding);
	}

	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
		padding: var(--space-2) var(--space-3);
		border-left: var(--accent-bar) solid var(--danger);
		background: var(--surface-panel);
	}

	.banner strong {
		color: var(--ink-bright);
		font-weight: var(--weight-medium);
	}

	.banner .detail {
		color: var(--ink-dim);
	}
</style>
