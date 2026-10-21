<script lang="ts">
	import {
		formatBytes,
		formatResolution,
		formatResolutionOrder,
		formatVariant,
		pluralise
	} from '../../lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const authentication = $derived(data.authentication);
	const fromEnvironment = $derived(authentication.source === 'environment');
	const profile = $derived(data.profile);
	const downloadClient = $derived(data.downloadClient);
	const connection = $derived(data.connection);
	const namingTemplate = $derived(data.namingTemplate);
	const importSource = $derived(data.importSource);
	const remotePathMappings = $derived(data.remotePathMappings);
	const library = $derived(data.library);
	const libraryMove = $derived(data.libraryMove);
	const downloads = $derived(data.downloads);
	const paths = $derived(data.paths);

	const tokens = '{show}, {arc}, {seasonDirectory}, {season}, {part}, {episode}, {resolution}';
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
			Available tokens: {tokens}, where {'{seasonDirectory}'} is Specials for the one-off entries and
			Season followed by the number for everything else. A slash starts a new folder, and the file
			keeps the extension it was downloaded with. Leave this empty to go back to the default.
		</p>
		<button class="button" type="submit">Save</button>
	</form>
</section>

<section>
	<h2>Manual Import</h2>

	<form method="POST" action="?/saveImportSource">
		<label>
			<span>Import Source</span>
			<input name="importSource" autocomplete="off" value={importSource ?? ''} />
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

<section class="paths">
	<h2>Directories</h2>

	{#if form?.libraryProblem}
		<p class="alert">{form.libraryProblem}</p>
	{/if}

	{#if library.source === 'environment'}
		<div class="pinned">
			<label>
				<span>Library</span>
				<input name="library" value={library.path} readonly />
			</label>
			<p class="note">
				The Library is configured by {library.variable}, and cannot be changed here.
			</p>
		</div>
	{:else}
		<form method="POST" action="?/saveLibrary">
			<label>
				<span>Library</span>
				<input name="library" autocomplete="off" value={library.path} />
			</label>
			<p class="note">
				Where Pacerr files every import. Setting {library.variable} pins it from the environment
				instead and makes this field read-only.
			</p>
			<div class="row">
				<button class="button" type="submit">Save</button>
				<a class="button" href="/settings/browse?for=library">Browse</a>
			</div>
		</form>
	{/if}

	{#if libraryMove !== null && libraryMove.state !== 'dismissed'}
		<div class="move">
			{#if libraryMove.state === 'planned'}
				<p>
					{pluralise(libraryMove.parts, 'Part')}, {formatBytes(libraryMove.bytes)}, are still under
					{libraryMove.source}. Pacerr will move them to {libraryMove.destination}.
				</p>
				{#if libraryMove.sameFilesystem}
					<p class="note">
						The two are on the same filesystem, so Pacerr renames each file and the move costs no
						disk.
					</p>
				{:else}
					<p class="note">
						The two are on different filesystems, so Pacerr copies each file rather than renaming
						it. That breaks the hardlinks to your seeding downloads, and the disk anything still
						seeding occupies roughly doubles.
					</p>
				{/if}
				<div class="row">
					<form method="POST" action="?/startLibraryMove">
						<button class="button" type="submit">Move</button>
					</form>
					<form method="POST" action="?/dismissLibraryMove">
						<button class="button" type="submit">Leave them where they are</button>
					</form>
				</div>
			{:else if libraryMove.state === 'moving'}
				<p>
					Moving the Library to {libraryMove.destination}: {libraryMove.moved} of {libraryMove.parts}
					Parts moved, {libraryMove.stranded.length} still under {libraryMove.source}.
				</p>
			{:else if libraryMove.state === 'failed'}
				<p class="alert">
					Moving the Library stopped after {libraryMove.moved} of {libraryMove.parts} Parts: {libraryMove.reason}
				</p>
				<p>
					{pluralise(libraryMove.stranded.length, 'Part')} are still under {libraryMove.source}:
				</p>
				<ul class="stranded">
					{#each libraryMove.stranded as path (path)}
						<li>{path}</li>
					{/each}
				</ul>
				<div class="row">
					<form method="POST" action="?/startLibraryMove">
						<button class="button" type="submit">Try again</button>
					</form>
					<form method="POST" action="?/dismissLibraryMove">
						<button class="button" type="submit">Dismiss</button>
					</form>
				</div>
			{:else}
				<p>Moved {pluralise(libraryMove.parts, 'Part')} to {libraryMove.destination}.</p>
				<form method="POST" action="?/dismissLibraryMove">
					<button class="button" type="submit">Dismiss</button>
				</form>
			{/if}
		</div>
	{/if}

	{#if form?.downloadsProblem}
		<p class="alert">{form.downloadsProblem}</p>
	{/if}

	{#if downloads.source === 'environment'}
		<div class="pinned">
			<label>
				<span>Download directory</span>
				<input name="downloads" value={downloads.path} readonly />
			</label>
			<p class="note">
				The download directory is configured by {downloads.variable}, and cannot be changed here.
			</p>
		</div>
	{:else}
		<form method="POST" action="?/saveDownloads">
			<label>
				<span>Download directory</span>
				<input name="downloads" autocomplete="off" value={downloads.path} />
			</label>
			<p class="note">
				Where this container sees the completed downloads the Download Client writes. Setting
				{downloads.variable} pins it from the environment instead and makes this field read-only.
			</p>
			<div class="row">
				<button class="button" type="submit">Save</button>
				<a class="button" href="/settings/browse?for=downloads">Browse</a>
			</div>
		</form>
	{/if}

	<ul>
		{#each paths.directories as directory (directory.directory)}
			<li class:bad={directory.condition !== 'ok'}>{directory.diagnostic}</li>
		{/each}
		<li class:warned={!paths.hardlinking.sameFilesystem}>{paths.hardlinking.diagnostic}</li>
	</ul>

	<form method="POST" action="?/testPaths">
		<button class="button" type="submit">Test</button>
	</form>
</section>

<section class="mappings">
	<h2>Remote Path Mappings</h2>

	{#if form?.mappingProblem}
		<p class="alert">{form.mappingProblem}</p>
	{/if}

	{#if remotePathMappings.length > 0}
		<ul class="mapping-list">
			{#each remotePathMappings as mapping (mapping.id)}
				<li>
					<code>{mapping.remotePath}</code>
					<span aria-hidden="true">&rarr;</span>
					<code>{mapping.localPath}</code>
					<form method="POST" action="?/removeRemotePathMapping">
						<input type="hidden" name="id" value={mapping.id} />
						<button class="button" type="submit">Remove</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="POST" action="?/addRemotePathMapping">
		<label>
			<span>Path on the Download Client</span>
			<input name="remotePath" autocomplete="off" placeholder="/data/torrents" />
		</label>
		<label>
			<span>The same place as Pacerr sees it</span>
			<input name="localPath" autocomplete="off" placeholder="/downloads" />
		</label>
		<p class="note">
			Only needed when the two do not share a mount layout. The Download Client reports where it
			put a completed download using its own paths; a mapping rewrites that prefix to the
			equivalent path inside this container.
		</p>
		<button class="button" type="submit">Add</button>
	</form>
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

	.pinned {
		display: grid;
		gap: 0.75rem;
		max-width: 20rem;
		margin-bottom: 0.75rem;
	}

	.move {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
		max-width: 44rem;
		margin: 0 0 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 2px;
	}

	.move p {
		margin: 0;
		font-size: 0.8rem;
	}

	.stranded {
		max-height: 12rem;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--ink-bright);
		font-size: 0.8rem;
		word-break: break-all;
	}

	.paths ul {
		display: grid;
		gap: 0.35rem;
		max-width: 44rem;
		margin: 0 0 0.75rem;
		padding: 0;
		list-style: none;
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	.paths li.warned {
		color: var(--ink-bright);
	}

	.paths li.bad {
		color: var(--danger);
	}

	.mapping-list {
		display: grid;
		gap: 0.35rem;
		margin: 0 0 0.75rem;
		padding: 0;
		list-style: none;
	}

	.mapping-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
	}

	.mapping-list code {
		color: var(--ink-bright);
	}

	.mapping-list form {
		display: inline;
		max-width: none;
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
	input[name='template'],
	input[name='library'],
	input[name='downloads'],
	input[name='remotePath'],
	input[name='localPath'] {
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
