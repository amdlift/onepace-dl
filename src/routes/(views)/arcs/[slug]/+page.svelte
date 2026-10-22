<script lang="ts">
	import Chrome from '../../../../lib/components/Chrome.svelte';
	import {
		formatReleaseStatus,
		formatResolution,
		formatTimestamp,
		formatVariant
	} from '../../../../lib/format';
	import StateIcon from '../../../../lib/StateIcon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const arc = $derived(data.arc);
</script>

<svelte:head><title>{arc.title} - Pacerr</title></svelte:head>

<Chrome title={arc.title}>
	{#snippet actions()}
		<form class="monitoring" method="POST" action="?/toggleMonitoring">
			<button class="button" type="submit" aria-pressed={arc.monitored}>
				{arc.monitored ? 'Monitored' : 'Not monitored'}
			</button>
		</form>
	{/snippet}

	<table class="table">
		<thead>
			<tr>
				<th class="state-icon"><span class="visually-hidden">State</span></th>
				<th>Part</th>
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
					<StateIcon state={row.state} />
					<td>{row.number}</td>
					{#if row.released}
						<td>
							{row.title}
							{#if row.toBeRedone}<span class="badge redone">To Be Redone</span>{/if}
						</td>
						<td>
							{#if row.grab.chosen}
								<span class="grab">
									<span>{row.grab.title}</span>
									<span class="pill resolution">{formatResolution(row.grab.resolution)}</span>
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
									<span class="pill resolution">{formatResolution(row.had.resolution)}</span>
								{/if}
								{#if row.had.variant !== null}<span>{formatVariant(row.had.variant)}</span>{/if}
							{/if}
						</td>
						<td>
							{#if row.releases.length === 0}
								<span class="none">No Release</span>
							{:else}
								<ul class="releases">
									{#each row.releases as release (release.infohash)}
										<li>
											<span class="pill resolution">{formatResolution(release.resolution)}</span>
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
						<td colspan="5"><span class="none">Not released yet</span></td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</Chrome>

<style>
	.releases {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.releases li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		color: var(--ink-dim);
	}

	.grab {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		color: var(--ink-dim);
	}

	.have {
		color: var(--ink-dim);
		white-space: nowrap;
	}

	.flag {
		display: block;
		color: var(--ink-dim);
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
			transparent var(--space-1),
			var(--surface-panel) var(--space-1),
			var(--surface-panel) var(--space-2)
		);
	}
</style>
