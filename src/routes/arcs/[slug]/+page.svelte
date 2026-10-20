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
	<form class="monitoring" method="POST" action="?/toggleMonitoring">
		<button class="button" type="submit" aria-pressed={arc.monitored}>
			{arc.monitored ? 'Monitored' : 'Not monitored'}
		</button>
	</form>
</div>

<table class="table">
	<thead>
		<tr>
			<th class="numeric">Part</th>
			<th>Title</th>
			<th>Would grab</th>
			<th>Have</th>
			<th>Releases</th>
			<th class="wanted">Wanted</th>
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
						{#if row.grab.chosen}
							<span class="grab">
								<span>{row.grab.title}</span>
								<span class="resolution">{formatResolution(row.grab.resolution)}</span>
								<span>{formatVariant(row.grab.variant)}</span>
							</span>
							{#if row.grab.batch}
								<span class="flag">
									Batch, needed for {row.grab.neededPartCount} of {row.grab.coveredPartCount} Parts
								</span>
							{/if}
							{#if row.grab.belowCutoff}<span class="flag">Below Cutoff</span>{/if}
						{:else}
							<span class="none">{row.grab.reason}</span>
						{/if}
					</td>
					<td class="have">
						{#if row.had === null}
							<span class="none">Missing</span>
						{:else}
							{row.had.releaseTitle ?? 'Imported'}
							{#if row.had.resolution !== null}
								<span class="resolution">{formatResolution(row.had.resolution)}</span>
							{/if}
						{/if}
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
					<td class="wanted">
						{#if arc.monitored}
							<form method="POST" action="?/togglePartWanted">
								<input type="hidden" name="part" value={row.slug} />
								<button class="toggle" type="submit" aria-pressed={row.wanted}>
									{row.wanted ? 'Wanted' : 'Not wanted'}
								</button>
							</form>
						{/if}
					</td>
				{:else}
					<td colspan="4"><span class="none">Not released yet</span></td>
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

	.grab {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	.have {
		color: var(--ink-dim);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.flag {
		display: block;
		color: var(--ink-dim);
		font-size: 0.75rem;
	}

	.wanted {
		width: 1%;
		white-space: nowrap;
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
