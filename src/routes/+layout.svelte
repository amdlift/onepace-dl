<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';
	import '../app.css';

	let { children }: LayoutProps = $props();

	const sections = [
		{ href: '/', label: 'Arcs' },
		{ href: '/activity', label: 'Activity' },
		{ href: '/wanted', label: 'Wanted' },
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
		{@render children()}
	</main>
</div>

<style>
	.shell {
		display: grid;
		grid-template-areas: 'header header' 'nav main';
		grid-template-columns: 11rem 1fr;
		grid-template-rows: 3rem 1fr;
		min-height: 100vh;
	}

	header {
		grid-area: header;
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0 1rem;
		background: var(--surface-raised);
		border-bottom: 1px solid var(--border);
		line-height: 3rem;
	}

	.brand {
		color: var(--ink-bright);
		font-size: 1.1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.brand:hover {
		text-decoration: none;
	}

	.subject {
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	nav {
		grid-area: nav;
		background: var(--surface-raised);
		border-right: 1px solid var(--border);
		padding-top: 0.5rem;
	}

	nav ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	nav a {
		display: block;
		padding: 0.4rem 1rem;
		border-left: 3px solid transparent;
		color: var(--ink);
	}

	nav a:hover {
		background: var(--surface-hover);
		text-decoration: none;
	}

	nav a[aria-current='page'] {
		border-left-color: var(--accent);
		color: var(--ink-bright);
		background: var(--surface-hover);
	}

	main {
		grid-area: main;
		padding: 1rem;
	}
</style>
