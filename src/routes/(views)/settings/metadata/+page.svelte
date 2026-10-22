<script lang="ts">
	import Setting from '../../../../lib/components/Setting.svelte';
	import SettingsChrome from '../../../../lib/components/SettingsChrome.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const switches = $derived(data.switches);

	const kinds = [
		{
			name: 'showNfo',
			label: 'Show NFO',
			detail: 'tvshow.nfo at the root of the Library, saying what One Pace is.'
		},
		{
			name: 'arcNfo',
			label: 'Season NFO',
			detail: "season.nfo in each season directory, carrying the Arc's title and description."
		},
		{
			name: 'partNfo',
			label: 'Episode NFO',
			detail:
				"A .nfo beside each video file, carrying the Part's title and description and the " +
				'manga chapters and anime episodes it covers.'
		},
		{
			name: 'arcPoster',
			label: 'Season Poster',
			detail: 'cover.jpg in each season directory, the portrait artwork for the Arc.'
		}
	] as const;
</script>

<svelte:head><title>Metadata - Pacerr</title></svelte:head>

<SettingsChrome>
	<section>
		<h2>Sidecars</h2>

		{#if form?.saved}
			<p class="note saved">Saved.</p>
		{/if}

		<p class="note">
			Sidecars are the metadata files Pacerr writes into the Library beside the media they describe,
			so a media server can read what only One Pace knows without consulting a provider that has
			never heard of it. Switch off any kind you would rather your own metadata agent owned. Pacerr
			then stops writing new ones and leaves every file already in your Library exactly where it is.
		</p>

		<form method="POST" action="?/saveSidecars">
			{#each kinds as kind (kind.name)}
				<Setting label={kind.label} field={kind.name}>
					<input type="checkbox" id={kind.name} name={kind.name} checked={switches[kind.name]} />
					{#snippet help()}{kind.detail}{/snippet}
				</Setting>
			{/each}

			<div class="setting">
				<div class="control">
					<button class="button" type="submit">Save</button>
				</div>
			</div>
		</form>
	</section>
</SettingsChrome>

<style>
	.note {
		max-width: var(--prose-width);
		margin: 0 0 var(--space-4);
	}

	.saved {
		color: var(--ink-bright);
	}
</style>
