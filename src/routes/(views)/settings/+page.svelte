<script lang="ts">
	import Chrome from '../../../lib/components/Chrome.svelte';
	import { formatResolution, formatResolutionOrder, formatVariant } from '../../../lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const profile = $derived(data.profile);

	const resolutions = [1080, 720, 480] as const;
	const variants = ['regular', 'extended', 'alternate'] as const;
	const ranks = [0, 1, 2] as const;
	const rankLabels = ['First', 'Then', 'Then'];
</script>

<svelte:head><title>Settings - Pacerr</title></svelte:head>

<Chrome title="Settings">
	<section>
		<h2>Profile</h2>

		{#if form?.profileProblem}
			<p class="alert">{form.profileProblem}</p>
		{/if}

		<form method="POST" action="?/saveProfile">
			<fieldset>
				<legend>Resolution preference</legend>
				{#each ranks as rank (rank)}
					<label>
						<span>{rankLabels[rank]}</span>
						<select class="input" name="resolution-{rank + 1}">
							<option value="" selected={profile.resolutions[rank] === undefined}>None</option>
							{#each resolutions as resolution (resolution)}
								<option value={resolution} selected={profile.resolutions[rank] === resolution}>
									{formatResolution(resolution)}
								</option>
							{/each}
						</select>
					</label>
				{/each}
				<p class="order">{formatResolutionOrder(profile.resolutions)}</p>
			</fieldset>
			<label>
				<span>Preferred Variant</span>
				<select class="input" name="variant">
					{#each variants as variant (variant)}
						<option value={variant} selected={profile.variant === variant}>
							{formatVariant(variant)}
						</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Cutoff</span>
				<select class="input" name="cutoff">
					{#each resolutions as resolution (resolution)}
						<option value={resolution} selected={profile.cutoff === resolution}>
							{formatResolution(resolution)}
						</option>
					{/each}
				</select>
			</label>
			<p class="note">
				Pacerr takes the most recently published Release covering each Part that this Profile
				accepts, and stops looking for a better Resolution once a Part reaches the Cutoff.
			</p>
			<button class="button" type="submit">Save</button>
		</form>
	</section>

	<section class="sidecars">
		<h2>Sidecars</h2>

		<p class="note">
			The NFO documents and the Poster Pacerr writes into the Library beside the media they describe,
			so a media server reads what only One Pace knows. Each kind has a switch of its own.
		</p>
		<a class="button" href="/settings/sidecars">Sidecars</a>
	</section>
</Chrome>

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

	fieldset {
		display: grid;
		gap: var(--space-2);
		width: 100%;
		margin: 0;
		padding: var(--space-3);
		border: var(--hairline) solid var(--border);
		border-radius: var(--radius-control);
	}

	legend {
		padding: 0 var(--space-1);
		color: var(--ink-dim);
	}

	.order {
		margin: 0;
		color: var(--ink-bright);
	}

	.sidecars .note {
		max-width: var(--prose-width);
		margin-bottom: var(--space-3);
	}
</style>
