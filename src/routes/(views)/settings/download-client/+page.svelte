<script lang="ts">
	import Setting from '../../../../lib/components/Setting.svelte';
	import SettingsChrome from '../../../../lib/components/SettingsChrome.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const downloadClient = $derived(data.downloadClient);
	const connection = $derived(data.connection);
</script>

<svelte:head><title>Download Client - Pacerr</title></svelte:head>

<SettingsChrome>
	<section>
		<h2>Download Client</h2>

		<form method="POST" action="?/saveDownloadClient">
			<Setting label="qBittorrent address" field="url">
				<input
					class="input"
					id="url"
					name="url"
					placeholder="http://localhost:8080"
					value={downloadClient.url}
				/>
			</Setting>

			<Setting label="Username" field="username">
				<input
					class="input"
					id="username"
					name="username"
					autocomplete="off"
					value={downloadClient.username}
				/>
			</Setting>

			<Setting label="Password" field="password">
				<input
					class="input"
					id="password"
					name="password"
					type="password"
					autocomplete="off"
					placeholder="Unchanged"
				/>
				{#snippet help()}
					Pacerr hands every Release to this client and never moves bytes over BitTorrent itself, so
					the seeding, ratio and VPN rules you already set there keep applying.
				{/snippet}
			</Setting>

			<div class="setting">
				<div class="control row">
					<button class="button" type="submit">Save</button>
					<button class="button" type="submit" formaction="?/testDownloadClient">Test</button>
				</div>
			</div>
		</form>

		{#if connection !== null}
			<div class="setting">
				<div class="control">
					<p class="connection" class:bad={!connection.ok}>{connection.detail}</p>
				</div>
			</div>
		{/if}
	</section>
</SettingsChrome>

<style>
	.connection {
		margin: 0;
		color: var(--ink-bright);
	}

	.connection.bad {
		color: var(--danger);
	}
</style>
