<script lang="ts">
	import { arcsLayouts, formatArcsLayout } from '../../lib/arcs-layout';
	import ArcOverview from '../../lib/components/ArcOverview.svelte';
	import ArcPosters from '../../lib/components/ArcPosters.svelte';
	import ArcTable from '../../lib/components/ArcTable.svelte';
	import Chrome from '../../lib/components/Chrome.svelte';
	import { formatTimestamp, pluralise } from '../../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const catalogue = $derived(data.catalogue);
	const feed = $derived(data.feed);
	const layout = $derived(data.layout);
</script>

<svelte:head><title>Arcs - Pacerr</title></svelte:head>

<Chrome title="Arcs">
	{#snippet actions()}
		<form method="POST" action="?/monitorAllArcs">
			<button class="button" type="submit">Monitor all Arcs</button>
		</form>
		<form method="POST" action="?/refreshCatalogue">
			<button class="button" type="submit">Refresh Catalogue</button>
		</form>
		<form method="POST" action="?/refreshReleases">
			<button class="button" type="submit">Refresh Releases</button>
		</form>
	{/snippet}

	{#snippet controls()}
		<form class="layouts" method="POST" action="?/chooseLayout">
			{#each arcsLayouts as option (option)}
				<button
					class="toggle"
					type="submit"
					name="layout"
					value={option}
					aria-pressed={option === layout}
				>
					{formatArcsLayout(option)}
				</button>
			{/each}
		</form>
	{/snippet}

	<p class="status">
		<span>{pluralise(catalogue.arcs.length, 'Arc')}</span>
		<span>Checked {formatTimestamp(catalogue.checkedAt)}</span>
		<span>Updated {formatTimestamp(catalogue.updatedAt)}</span>
		<span>{pluralise(feed.releaseCount, 'Release')}</span>
		<span>Feed checked {formatTimestamp(feed.checkedAt)}</span>
		<span>Feed updated {formatTimestamp(feed.updatedAt)}</span>
	</p>

	{#if catalogue.failure !== null}
		<p class="alert">The last Catalogue scrape failed: {catalogue.failure}</p>
	{/if}

	{#if feed.failure !== null}
		<p class="alert">The last release feed poll failed: {feed.failure}</p>
	{/if}

	{#if catalogue.arcs.length === 0}
		<p class="empty">No Catalogue yet. One Pace has not been scraped successfully.</p>
	{:else if layout === 'poster'}
		<ArcPosters arcs={catalogue.arcs} />
	{:else if layout === 'overview'}
		<ArcOverview arcs={catalogue.arcs} />
	{:else}
		<ArcTable arcs={catalogue.arcs} />
	{/if}
</Chrome>

<style>
	.layouts {
		display: flex;
		gap: var(--space-1);
	}
</style>
