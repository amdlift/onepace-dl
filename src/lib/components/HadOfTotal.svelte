<script lang="ts">
	let { hadCount, partCount }: { hadCount: number; partCount: number } = $props();
</script>

<span class="pill" class:complete={hadCount === partCount}>{hadCount} of {partCount}</span>
