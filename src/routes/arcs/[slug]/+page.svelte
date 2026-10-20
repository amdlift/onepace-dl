<script lang="ts">
	import {
		formatReleaseStatus,
		formatResolution,
		formatTimestamp,
		formatVariant
	} from '../../../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const arc = $derived(data.arc);
</script>

<svelte:head><title>{arc.title} - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>{arc.title}</h1>
</div>

<table class="table">
	<thead>
		<tr>
			<th class="numeric">Part</th>
			<th>Title</th>
			<th>Releases</th>
		</tr>
	</thead>
	<tbody>
		{#each arc.rows as row (row.number)}
			<tr class={{ gap: !row.released }}>
				<td class="numeric">{row.number}</td>
				{#if row.released}
					<td>
						{row.title}
						{#if row.toBeRedone}<span class="badge redone">To Be Redone</span>{/if}
					</td>
					<td>
						{#if row.releases.length === 0}
							<span class="none">No Release</span>
						{:else}
							<ul class="releases">
								{#each row.releases as release (release.infohash)}
									<li>
										<span class="resolution">{formatResolution(release.resolution)}</span>
										<span>{formatVariant(release.variant)}</span>
										<span>{formatReleaseStatus(release.status)}</span>
										<span>{formatTimestamp(new Date(release.publishedAt))}</span>
										{#if release.sizeLabel !== null}<span>{release.sizeLabel}</span>{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</td>
				{:else}
					<td colspan="2"><span class="none">Not released yet</span></td>
				{/if}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.releases {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.releases li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	.resolution {
		color: var(--ink-bright);
	}

	.none {
		color: var(--ink-dim);
		font-style: italic;
	}

	.gap td {
		background: repeating-linear-gradient(
			135deg,
			transparent,
			transparent 6px,
			var(--surface-raised) 6px,
			var(--surface-raised) 12px
		);
	}

	.badge.redone {
		color: var(--warning);
	}
</style>
