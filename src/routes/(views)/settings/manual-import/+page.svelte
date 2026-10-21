<script lang="ts">
	import SettingsChrome from '../../../../lib/components/SettingsChrome.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const importSource = $derived(data.importSource);
</script>

<svelte:head><title>Manual Import - Pacerr</title></svelte:head>

<SettingsChrome>
	<section>
		<h2>Manual Import</h2>

		<form method="POST" action="?/saveImportSource">
			<label>
				<span>Import Source</span>
				<input class="input" name="importSource" autocomplete="off" value={importSource ?? ''} />
			</label>
			<p class="note">
				The directory Manual Import browses for One Pace files you already have. Pacerr reads this
				directory and the Library and nowhere else, and never scans either on its own. Leave this
				empty to give Manual Import nowhere to look.
			</p>
			<div class="row">
				<button class="button" type="submit">Save</button>
				<a class="button" href="/settings/browse?for=importSource">Browse</a>
				<a class="button" href="/manual-import">Manual Import</a>
			</div>
		</form>
	</section>
</SettingsChrome>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		justify-items: start;
		max-width: var(--form-width);
	}

	label {
		display: grid;
		gap: var(--space-1);
		width: 100%;
	}

	label span {
		color: var(--ink-dim);
	}

	.row {
		display: flex;
		gap: var(--space-2);
	}
</style>
