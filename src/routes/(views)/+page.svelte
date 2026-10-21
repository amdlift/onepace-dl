<script lang="ts">
	import Chrome from '../../lib/components/Chrome.svelte';
	import { formatResolution, formatTimestamp, pluralise } from '../../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const catalogue = $derived(data.catalogue);
	const feed = $derived(data.feed);
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
	{:else}
		<table class="table">
			<thead>
				<tr>
					<th class="poster"><span class="visually-hidden">Poster</span></th>
					<th>Arc</th>
					<th>Parts</th>
					<th>Had</th>
					<th class="monitoring">Monitoring</th>
				</tr>
			</thead>
			<tbody>
				{#each catalogue.arcs as arc (arc.slug)}
					<tr>
						<td class="poster">
							{#if arc.artwork.kind === 'placeholder'}
								<span class="no-poster" aria-hidden="true"></span>
							{:else}
								<img src={arc.artwork.url} alt="" width="40" height="60" loading="lazy" />
							{/if}
						</td>
						<td>
							<a href="/arcs/{arc.slug}">{arc.title}</a>
							{#if arc.special}<span class="badge">Special</span>{/if}
							{#if arc.unfinished}<span class="badge unfinished">Unfinished</span>{/if}
							{#if arc.batchOnly !== null}
								<span class="badge batch">
									Batch only{arc.batchOnly.resolution === null
										? ''
										: ` ${formatResolution(arc.batchOnly.resolution)}`}
								</span>
							{/if}
						</td>
						<td>
							{pluralise(arc.partCount, 'Part')}
							{#if arc.unreleasedPartCount > 0}
								<span class="badge">+{arc.unreleasedPartCount} unreleased</span>
							{/if}
						</td>
						<td class="had">
							<span class="pill" class:complete={arc.hadCount === arc.partCount}>
								{arc.hadCount} of {arc.partCount}
							</span>
						</td>
						<td class="monitoring">
							<form method="POST" action="?/toggleMonitoring">
								<input type="hidden" name="arc" value={arc.slug} />
								<button class="toggle" type="submit" aria-pressed={arc.monitored}>
									{arc.monitored ? 'Monitored' : 'Not monitored'}
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Chrome>

<style>
	.poster {
		width: var(--poster-width);
		padding-right: 0;
	}

	img,
	.no-poster {
		display: block;
		width: var(--poster-width);
		height: var(--poster-height);
		object-fit: cover;
		border-radius: var(--radius-card);
		background: var(--surface-panel);
	}

	.monitoring {
		width: 1%;
		white-space: nowrap;
	}
</style>
