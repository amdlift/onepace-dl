<script lang="ts">
	// An Arc's completeness, stated the same way whichever layout the Arcs view is in: changing
	// layout is not allowed to cost the reader this.
	let { hadCount, partCount }: { hadCount: number; partCount: number } = $props();
</script>

<span class="pill" class:complete={hadCount === partCount}>{hadCount} of {partCount}</span>
