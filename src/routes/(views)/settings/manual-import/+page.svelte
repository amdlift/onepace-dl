<script lang="ts">
	import Setting from '../../../../lib/components/Setting.svelte';
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
			<Setting label="Import Source" field="importSource">
				<input
					class="input"
					id="importSource"
					name="importSource"
					autocomplete="off"
					value={importSource ?? ''}
				/>
				{#snippet help()}
					The directory Manual Import browses for One Pace files you already have. Pacerr reads this
					directory and the Library and nowhere else, and never scans either on its own. Leave this
					empty to give Manual Import nowhere to look.
				{/snippet}
			</Setting>

			<div class="setting">
				<div class="control row">
					<button class="button" type="submit">Save</button>
					<a class="button" href="/settings/browse?for=importSource">Browse</a>
					<a class="button" href="/manual-import">Manual Import</a>
				</div>
			</div>
		</form>
	</section>
</SettingsChrome>
