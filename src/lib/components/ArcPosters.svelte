<script lang="ts">
	import type { ArcSummary } from '../server/arcs';

	let { arcs }: { arcs: ArcSummary[] } = $props();
</script>

<ul class="poster-grid">
	{#each arcs as arc (arc.slug)}
		<li class="arc">
			<a class="artwork" href="/arcs/{arc.slug}">
				{#if arc.artwork.kind === 'placeholder'}
					<span class="no-poster">{arc.title}</span>
				{:else}
					<img src={arc.artwork.url} alt="" loading="lazy" />
				{/if}
			</a>
			<a class="title" href="/arcs/{arc.slug}">{arc.title}</a>
		</li>
	{/each}
</ul>

<style>
	.poster-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--poster-card-width), 1fr));
		gap: var(--space-5);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.arc {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.artwork {
		display: block;
		aspect-ratio: 2 / 3;
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
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: var(--space-3);
		color: var(--ink-dim);
		text-align: center;
	}
</style>
