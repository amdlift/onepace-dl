<script lang="ts">
	import { formatWantedState } from '../../lib/format';
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
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.state.missing {
		color: var(--warning);
	}

	.state.unreleased {
		color: var(--ink-dim);
		font-style: italic;
	}
</style>
