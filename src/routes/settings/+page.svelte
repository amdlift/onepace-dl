<script lang="ts">
	import { formatResolution, formatResolutionOrder, formatVariant } from '../../lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const authentication = $derived(data.authentication);
	const fromEnvironment = $derived(authentication.source === 'environment');
	const profile = $derived(data.profile);
	const downloadClient = $derived(data.downloadClient);
	const connection = $derived(data.connection);
	const namingTemplate = $derived(data.namingTemplate);

	const tokens = '{arc}, {season}, {part}, {episode}, {resolution}';
	const resolutions = [1080, 720, 480] as const;
	const variants = ['regular', 'extended', 'alternate'] as const;
	const ranks = [0, 1, 2] as const;
	const rankLabels = ['First', 'Then', 'Then'];
</script>

<svelte:head><title>Settings - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>Settings</h1>
</div>

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
					<select name="resolution-{rank + 1}">
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
			<select name="variant">
				{#each variants as variant (variant)}
					<option value={variant} selected={profile.variant === variant}>
						{formatVariant(variant)}
					</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Cutoff</span>
			<select name="cutoff">
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

<section>
	<h2>Library</h2>

	<form method="POST" action="?/saveNamingTemplate">
		<label>
			<span>Naming template</span>
			<input name="template" autocomplete="off" value={namingTemplate} />
		</label>
		<p class="note">
			Arcs render as seasons and Parts as episodes, which is what Jellyfin and Plex parse.
			Available tokens: {tokens}. A slash starts a new folder, and the file keeps the extension it
			was downloaded with. Leave this empty to go back to the default.
		</p>
		<button class="button" type="submit">Save</button>
	</form>
</section>

<section>
	<h2>Download Client</h2>

	<form method="POST" action="?/saveDownloadClient">
		<label>
			<span>qBittorrent address</span>
			<input name="url" placeholder="http://localhost:8080" value={downloadClient.url} />
		</label>
		<label>
			<span>Username</span>
			<input name="username" autocomplete="off" value={downloadClient.username} />
		</label>
		<label>
			<span>Password</span>
			<input name="password" type="password" autocomplete="off" placeholder="Unchanged" />
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

<section>
	<h2>Security</h2>

	{#if form?.problem}
		<p class="alert">{form.problem}</p>
	{/if}

	{#if fromEnvironment}
		<p class="note">
			Authentication is configured by environment variable as <strong
				>{authentication.username}</strong
			>, and cannot be changed here.
		</p>
	{:else}
		<form method="POST" action="?/saveAuthentication">
			<label class="toggle">
				<input type="checkbox" name="enabled" checked={authentication.enabled} />
				<span>Require a login</span>
			</label>
			<label>
				<span>Username</span>
				<input name="username" autocomplete="username" value={authentication.username ?? ''} />
			</label>
			<label>
				<span>Password</span>
				<input name="password" type="password" autocomplete="new-password" placeholder="Unchanged" />
			</label>
			<p class="note">
				Pacerr has one account, and saving replaces it. Setting PACERR_AUTH_USERNAME and
				PACERR_AUTH_PASSWORD configures it from the environment instead.
			</p>
			<button class="button" type="submit">Save</button>
		</form>
	{/if}

	{#if authentication.signedIn}
		<form method="POST" action="?/logOut">
			<button class="button" type="submit">Log out</button>
		</form>
	{/if}
</section>

<style>
	h2 {
		margin: 1rem 0 0.5rem;
		font-size: 0.9rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-dim);
	}

	form {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		max-width: 20rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
		width: 100%;
	}

	label.toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	label span {
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	fieldset {
		display: grid;
		gap: 0.5rem;
		width: 100%;
		margin: 0;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 2px;
	}

	legend {
		padding: 0 0.35rem;
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	.order {
		margin: 0;
		color: var(--ink-bright);
		font-size: 0.8rem;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	.connection {
		margin: 0.5rem 0 0;
		color: var(--ink-bright);
		font-size: 0.8rem;
	}

	.connection.bad {
		color: var(--danger);
	}

	select,
	input[name='url'],
	input[name='username'],
	input[name='password'],
	input[name='template'] {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 2px;
		background: var(--surface-raised);
		color: var(--ink);
	}

	.note {
		margin: 0;
		color: var(--ink-dim);
		font-size: 0.8rem;
	}
</style>
