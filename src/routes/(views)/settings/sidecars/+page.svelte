<script lang="ts">
	import Chrome from '../../../../lib/components/Chrome.svelte';
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

<svelte:head><title>Sidecars - Pacerr</title></svelte:head>

<Chrome title="Sidecars">
	{#snippet actions()}
		<a class="button" href="/settings">Back to Settings</a>
	{/snippet}

	{#if form?.saved}
		<p class="note saved">Saved.</p>
	{/if}

	<p class="note">
		Sidecars are the metadata files Pacerr writes into the Library beside the media they describe, so
		a media server can read what only One Pace knows without consulting a provider that has never
		heard of it. Switch off any kind you would rather your own metadata agent owned. Pacerr then
		stops writing new ones and leaves every file already in your Library exactly where it is.
	</p>

	<form method="POST" action="?/saveSidecars">
		{#each kinds as kind (kind.name)}
			<label class="toggle">
				<input type="checkbox" name={kind.name} checked={switches[kind.name]} />
				<span>{kind.label}</span>
			</label>
			<p class="detail">{kind.detail}</p>
		{/each}
		<button class="button" type="submit">Save</button>
	</form>
</Chrome>

<style>
	form {
		display: grid;
		gap: var(--space-1);
		justify-items: start;
		max-width: var(--control-width);
	}

	label.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}

	label span {
		color: var(--ink-bright);
	}

	.detail {
		margin: 0 0 var(--space-1) var(--space-6);
		color: var(--ink-dim);
	}

	.note {
		max-width: var(--prose-width);
		margin: 0 0 var(--space-3);
	}

	.saved {
		color: var(--ink-bright);
	}

	button {
		margin-top: var(--space-4);
	}
</style>
