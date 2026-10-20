<script lang="ts">
	import {
		formatCoverage,
		formatReleaseStatus,
		formatResolution,
		formatTimestamp,
		formatVariant,
		pluralise
	} from '../../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const unmatched = $derived(data.unmatched);
</script>

<svelte:head><title>System - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>System</h1>
</div>

<p class="status">
	<span>{pluralise(unmatched.length, 'Unmatched Release')}</span>
</p>

{#if unmatched.length === 0}
	<p class="empty">Every Release in the feed is accounted for in the Catalogue.</p>
{:else}
	<table class="table">
		<thead>
			<tr>
				<th>Release</th>
				<th>Covers</th>
				<th>Published</th>
			</tr>
		</thead>
		<tbody>
			{#each unmatched as release (release.infohash)}
				<tr>
					<td>
						{release.title}
						<span class="facts">
							{formatResolution(release.resolution)} · {formatVariant(release.variant)} · {formatReleaseStatus(
								release.status
							)}
						</span>
					</td>
					<td class="covers">
						{#if formatCoverage(release.chapters) !== null}
							<span>Chapters {formatCoverage(release.chapters)}</span>
						{/if}
						{#if formatCoverage(release.episodes) !== null}
							<span>Episodes {formatCoverage(release.episodes)}</span>
						{/if}
					</td>
					<td class="numeric">{formatTimestamp(new Date(release.publishedAt))}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.facts,
	.covers {
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	.covers span {
		display: block;
	}
</style>
