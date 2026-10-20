<script lang="ts">
	import { formatTimestamp, pluralise } from '../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const catalogue = $derived(data.catalogue);
</script>

<svelte:head><title>Arcs - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>Arcs</h1>
	<form method="POST" action="?/refreshCatalogue">
		<button class="button" type="submit">Refresh Catalogue</button>
	</form>
</div>

<p class="status">
	<span>{pluralise(catalogue.arcs.length, 'Arc')}</span>
	<span>Checked {formatTimestamp(catalogue.checkedAt)}</span>
	<span>Updated {formatTimestamp(catalogue.updatedAt)}</span>
</p>

{#if catalogue.failure !== null}
	<p class="alert">The last Catalogue scrape failed: {catalogue.failure}</p>
{/if}

{#if catalogue.arcs.length === 0}
	<p class="empty">No Catalogue yet. One Pace has not been scraped successfully.</p>
{:else}
	<table class="table">
		<thead>
			<tr>
				<th class="cover"><span class="visually-hidden">Cover</span></th>
				<th>Arc</th>
				<th class="numeric">Parts</th>
			</tr>
		</thead>
		<tbody>
			{#each catalogue.arcs as arc (arc.slug)}
				<tr>
					<td class="cover">
						{#if arc.coverImageUrl !== null}
							<img src={arc.coverImageUrl} alt="" width="64" height="36" loading="lazy" />
						{:else}
							<span class="no-cover" aria-hidden="true"></span>
						{/if}
					</td>
					<td>
						{arc.title}
						{#if arc.special}<span class="badge">Special</span>{/if}
						{#if arc.unfinished}<span class="badge unfinished">Unfinished</span>{/if}
					</td>
					<td class="numeric">
						{pluralise(arc.partCount, 'Part')}
						{#if arc.unreleasedPartCount > 0}
							<span class="badge">+{arc.unreleasedPartCount} unreleased</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.cover {
		width: 64px;
		padding-right: 0;
	}

	img,
	.no-cover {
		display: block;
		width: 64px;
		height: 36px;
		object-fit: cover;
		border-radius: 2px;
		background: var(--surface-hover);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
