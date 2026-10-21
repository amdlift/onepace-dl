<script lang="ts">
	import Setting from '../../../lib/components/Setting.svelte';
	import SettingsChrome from '../../../lib/components/SettingsChrome.svelte';
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

<SettingsChrome>
	<section>
		<h2>Profile</h2>

		{#if form?.profileProblem}
			<p class="alert">{form.profileProblem}</p>
		{/if}

		<form method="POST" action="?/saveProfile">
			<Setting label="Resolution preference" field="resolution-1">
				{#each ranks as rank (rank)}
					<select
						class="input"
						id="resolution-{rank + 1}"
						name="resolution-{rank + 1}"
						aria-label={rankLabels[rank]}
					>
						<option value="" selected={profile.resolutions[rank] === undefined}>None</option>
						{#each resolutions as resolution (resolution)}
							<option value={resolution} selected={profile.resolutions[rank] === resolution}>
								{formatResolution(resolution)}
							</option>
						{/each}
					</select>
				{/each}
				{#snippet help()}<span class="order">{formatResolutionOrder(profile.resolutions)}</span
					>{/snippet}
			</Setting>

			<Setting label="Preferred Variant" field="variant">
				<select class="input" id="variant" name="variant">
					{#each variants as variant (variant)}
						<option value={variant} selected={profile.variant === variant}>
							{formatVariant(variant)}
						</option>
					{/each}
				</select>
			</Setting>

			<Setting label="Cutoff" field="cutoff">
				<select class="input" id="cutoff" name="cutoff">
					{#each resolutions as resolution (resolution)}
						<option value={resolution} selected={profile.cutoff === resolution}>
							{formatResolution(resolution)}
						</option>
					{/each}
				</select>
				{#snippet help()}
					Pacerr takes the most recently published Release covering each Part that this Profile
					accepts, and stops looking for a better Resolution once a Part reaches the Cutoff.
				{/snippet}
			</Setting>

			<div class="setting">
				<div class="control">
					<button class="button" type="submit">Save</button>
				</div>
			</div>
		</form>
	</section>
</SettingsChrome>
