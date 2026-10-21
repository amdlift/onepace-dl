<script lang="ts">
	import Chrome from '../../../../lib/components/Chrome.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const downloadClient = $derived(data.downloadClient);
	const connection = $derived(data.connection);
</script>

<svelte:head><title>Download Client - Pacerr</title></svelte:head>

<Chrome title="Settings">
	<section>
		<h2>Download Client</h2>

		<form method="POST" action="?/saveDownloadClient">
			<label>
				<span>qBittorrent address</span>
				<input class="input" name="url" placeholder="http://localhost:8080" value={downloadClient.url} />
			</label>
			<label>
				<span>Username</span>
				<input class="input" name="username" autocomplete="off" value={downloadClient.username} />
			</label>
			<label>
				<span>Password</span>
				<input class="input" name="password" type="password" autocomplete="off" placeholder="Unchanged" />
			</label>
			<p class="note">
				Pacerr hands every Release to this client and never moves bytes over BitTorrent itself, so
				the seeding, ratio and VPN rules you already set there keep applying.
			</p>
			<div class="row">
				<button class="button" type="submit">Save</button>
				<button class="button" type="submit" formaction="?/testDownloadClient">Test</button>
			</div>
		</form>

		{#if connection !== null}
			<p class="connection" class:bad={!connection.ok}>{connection.detail}</p>
		{/if}
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

	.row {
		display: flex;
		gap: var(--space-2);
	}

	.connection {
		margin: var(--space-2) 0 0;
		color: var(--ink-bright);
	}

	.connection.bad {
		color: var(--danger);
	}
</style>
