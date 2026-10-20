<script lang="ts">
	import { formatResolution, formatVariant, formatWantedState } from '../../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const wanted = $derived(data.wanted);
</script>

<svelte:head><title>Wanted - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>Wanted</h1>
</div>

{#if wanted.length === 0}
	<p class="empty">Nothing is wanted. Monitor an Arc to fill this in.</p>
{:else}
	<table class="table">
		<thead>
			<tr>
				<th>Arc</th>
				<th class="numeric">Part</th>
				<th>Title</th>
				<th>Status</th>
				<th>Would grab</th>
			</tr>
		</thead>
		<tbody>
			{#each wanted as row (`${row.arcSlug}/${row.number}`)}
				<tr>
					<td><a href="/arcs/{row.arcSlug}">{row.arcTitle}</a></td>
					<td class="numeric">{row.number}</td>
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
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.grab {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	.resolution {
		color: var(--ink-bright);
	}

	.flag {
		display: block;
		color: var(--ink-dim);
		font-size: 0.75rem;
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
