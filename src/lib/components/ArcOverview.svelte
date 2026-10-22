<script lang="ts">
	import { formatResolution, pluralise } from '../format';
	import type { ArcSummary } from '../server/arcs';
	import HadOfTotal from './HadOfTotal.svelte';
	import MonitorArc from './MonitorArc.svelte';

	let { arcs }: { arcs: ArcSummary[] } = $props();
</script>

<ul class="overview">
	{#each arcs as arc (arc.slug)}
		<li class="arc">
			<!-- The detail beside it carries the same link under the Arc's own name. -->
			<a class="artwork" href="/arcs/{arc.slug}" tabindex="-1" aria-hidden="true">
				{#if arc.artwork.kind === 'placeholder'}
					<span class="no-poster" aria-hidden="true"></span>
				{:else}
					<img src={arc.artwork.url} alt="" loading="lazy" />
				{/if}
			</a>
			<div class="detail">
				<div class="title">
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
				</div>
				<p class="counts">
					<span>{pluralise(arc.partCount, 'Part')}</span>
					{#if arc.unreleasedPartCount > 0}
						<span class="badge">+{arc.unreleasedPartCount} unreleased</span>
					{/if}
					<HadOfTotal hadCount={arc.hadCount} partCount={arc.partCount} />
				</p>
				{#if arc.description !== null}
					<p class="synopsis">{arc.description}</p>
				{/if}
				<div class="monitoring">
					<MonitorArc slug={arc.slug} monitored={arc.monitored} />
				</div>
			</div>
		</li>
	{/each}
</ul>

<style>
	.overview {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.arc {
		display: flex;
		gap: var(--space-5);
		padding: var(--space-3);
		border-radius: var(--radius-card);
		background: var(--surface-raised);
	}

	.artwork {
		display: block;
		flex: none;
		width: var(--backdrop-width);
		aspect-ratio: 16 / 9;
		border-radius: var(--radius-card);
		background: var(--surface-panel);
		overflow: hidden;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.no-poster {
		display: block;
		width: 100%;
		height: 100%;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.title {
		font-size: var(--type-modal-title);
		color: var(--ink-bright);
	}

	.counts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
		color: var(--ink-dim);
	}

	.monitoring {
		margin-top: var(--space-2);
	}

	.synopsis {
		max-width: var(--prose-width);
		margin: 0;
		color: var(--ink-dim);
	}
</style>
