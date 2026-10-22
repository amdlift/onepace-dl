<script lang="ts">
	import { formatResolution } from '../format';
	import type { ArcSummary } from '../server/arcs';

	let { arc }: { arc: ArcSummary } = $props();
</script>

{#if arc.special}<span class="badge">Special</span>{/if}
{#if arc.unfinished}<span class="badge unfinished">Unfinished</span>{/if}
{#if arc.batchOnly !== null}
	<span class="badge batch">
		Batch only{arc.batchOnly.resolution === null
			? ''
			: ` ${formatResolution(arc.batchOnly.resolution)}`}
	</span>
{/if}
