<script lang="ts">
	let { slug, monitored }: { slug: string; monitored: boolean } = $props();
</script>

<form method="POST" action="?/toggleMonitoring">
	<input type="hidden" name="arc" value={slug} />
	<button class="toggle" type="submit" aria-pressed={monitored}>
		{monitored ? 'Monitored' : 'Not monitored'}
	</button>
</form>
