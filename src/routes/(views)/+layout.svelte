<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const failing = $derived(data.failing);

	type Section = { href: string; label: string; covers?: string[] };

	const sections: Section[] = [
		{ href: '/', label: 'Arcs', covers: ['/', '/arcs'] },
		{ href: '/activity', label: 'Activity' },
		{ href: '/wanted', label: 'Wanted' },
		{ href: '/manual-import', label: 'Manual Import' },
		{ href: '/settings', label: 'Settings' },
		{ href: '/system', label: 'System' }
	];

	function current(section: Section): 'page' | undefined {
		const path = page.url.pathname;
		const covers = section.covers ?? [section.href];
		return covers.some((root) => path === root || path.startsWith(`${root}/`))
			? 'page'
			: undefined;
	}
</script>

<div class="shell">
	<header>
		<a class="recall" href="#sections">Sections</a>
		<a class="brand" href="/">Pacerr</a>
		<span class="subject">One Pace</span>
	</header>
	<nav id="sections" aria-label="Sections">
		<ul>
			{#each sections as section (section.href)}
				<li>
					<a href={section.href} aria-current={current(section)}>{section.label}</a>
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
		color: var(--ink-bright);
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
		min-width: 0;
	}

	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-2);
		margin: 0;
		padding: var(--space-2) var(--content-padding);
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

	.recall {
		display: none;
	}

	/* A media query is evaluated before custom properties resolve, so the breakpoint cannot be one. */
	@media (max-width: 768px) {
		.shell {
			grid-template-areas: 'header' 'nav' 'main';
			grid-template-columns: 1fr;
			grid-template-rows: var(--header-height) auto 1fr;
		}

		nav {
			display: none;
			border-right: none;
			border-bottom: var(--hairline) solid var(--border);
		}

		nav:target {
			display: block;
		}

		.recall {
			display: block;
			border: var(--hairline) solid var(--border);
			border-radius: var(--radius-control);
			padding: 0 var(--space-2);
			color: var(--ink-bright);
			line-height: var(--input-height);
		}

		.recall:hover {
			text-decoration: none;
			background: var(--surface-hover);
		}
	}
</style>
