<script lang="ts">
	import Chrome from '../../../lib/components/Chrome.svelte';
	import { formatResolution, formatVariant, formatWantedState } from '../../../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const wanted = $derived(data.wanted);
</script>

<svelte:head><title>Wanted - Pacerr</title></svelte:head>

<Chrome title="Wanted">
	{#if wanted.length === 0}
		<p class="empty">Nothing is wanted. Monitor an Arc to fill this in.</p>
	{:else}
		<table class="table">
			<thead>
				<tr>
					<th>Arc</th>
					<th>Part</th>
					<th>Title</th>
					<th>Status</th>
					<th>Would grab</th>
					<th>Have it already</th>
				</tr>
			</thead>
			<tbody>
				{#each wanted as row (`${row.arcSlug}/${row.number}`)}
					<tr>
						<td><a href="/arcs/{row.arcSlug}">{row.arcTitle}</a></td>
						<td>{row.number}</td>
						<td>{row.title ?? ''}</td>
						<td
							class="state"
							class:missing={row.state === 'missing'}
							class:unreleased={row.state === 'unreleased'}
						>
							{formatWantedState(row.state)}
						</td>
						<td>
							{#if row.grab === null}
								<span class="none">Not released yet</span>
							{:else if row.grab.chosen}
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
						<td>
							{#if row.partSlug !== null}
								<a class="manual-import" href="/manual-import?part={row.partSlug}">Manual Import</a>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Chrome>

<style>
	.grab {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		color: var(--ink-dim);
	}

	.resolution {
		color: var(--ink-bright);
	}

	.flag {
		display: block;
		color: var(--ink-dim);
	}

	.none {
		color: var(--ink-dim);
		font-style: italic;
	}

	.state.missing {
		color: var(--warning);
	}

	.state.unreleased {
		color: var(--ink-dim);
		font-style: italic;
	}
</style>
