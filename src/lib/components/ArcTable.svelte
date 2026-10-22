<script lang="ts">
	import { pluralise } from '../format';
	import type { ArcSummary } from '../server/arcs';
	import ArcBadges from './ArcBadges.svelte';
	import HadOfTotal from './HadOfTotal.svelte';
	import MonitorArc from './MonitorArc.svelte';

	let { arcs }: { arcs: ArcSummary[] } = $props();
</script>

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
		{#each arcs as arc (arc.slug)}
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
					<ArcBadges {arc} />
				</td>
				<td>
					{pluralise(arc.partCount, 'Part')}
					{#if arc.unreleasedPartCount > 0}
						<span class="badge">+{arc.unreleasedPartCount} unreleased</span>
					{/if}
				</td>
				<td class="had">
					<HadOfTotal hadCount={arc.hadCount} partCount={arc.partCount} />
				</td>
				<td class="monitoring">
					<MonitorArc slug={arc.slug} monitored={arc.monitored} />
				</td>
			</tr>
		{/each}
	</tbody>
</table>

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
