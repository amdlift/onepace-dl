<script lang="ts">
	import Chrome from '../../../../lib/components/Chrome.svelte';
	import { formatBytes, pluralise } from '../../../../lib/format';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const namingTemplate = $derived(data.namingTemplate);
	const remotePathMappings = $derived(data.remotePathMappings);
	const library = $derived(data.library);
	const libraryMove = $derived(data.libraryMove);
	const downloads = $derived(data.downloads);
	const paths = $derived(data.paths);

	const tokens = '{show}, {arc}, {seasonDirectory}, {season}, {part}, {episode}, {resolution}';
</script>

<svelte:head><title>Media Management - Pacerr</title></svelte:head>

<Chrome title="Settings">
	<section>
		<h2>Library</h2>

		<form method="POST" action="?/saveNamingTemplate">
			<label>
				<span>Naming template</span>
				<input class="input" name="template" autocomplete="off" value={namingTemplate} />
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

	<section class="paths">
		<h2>Directories</h2>

		{#if form?.libraryProblem}
			<p class="alert">{form.libraryProblem}</p>
		{/if}

		{#if library.source === 'environment'}
			<div class="pinned">
				<label>
					<span>Library</span>
					<input class="input" name="library" value={library.path} readonly />
				</label>
				<p class="note">
					The Library is configured by {library.variable}, and cannot be changed here.
				</p>
			</div>
		{:else}
			<form method="POST" action="?/saveLibrary">
				<label>
					<span>Library</span>
					<input class="input" name="library" autocomplete="off" value={library.path} />
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

		{#if libraryMove !== null && (libraryMove.state !== 'dismissed' || libraryMove.sources.length > 0)}
			<div class="move">
				{#if libraryMove.state === 'planned'}
					{#each libraryMove.sources as source (source.path)}
						<p>
							{pluralise(source.parts, 'Part')}, {formatBytes(source.bytes)}, {source.parts === 1
								? 'is'
								: 'are'} still under {source.path}.
						</p>
					{/each}
					<p>Pacerr will move them to {libraryMove.destination}.</p>
					{#if libraryMove.sameFilesystem}
						<p class="note">
							Source and destination are on the same filesystem, so Pacerr renames each file and the
							move costs no disk.
						</p>
					{:else}
						<p class="note">
							Source and destination are on different filesystems, so Pacerr copies each file rather
							than renaming it. That breaks the hardlinks to your seeding downloads, and the disk
							anything still seeding occupies roughly doubles.
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
						Parts moved.
					</p>
					{#each libraryMove.sources as source (source.path)}
						<p>{pluralise(source.parts, 'Part')} still under {source.path}.</p>
					{/each}
				{:else if libraryMove.state === 'failed'}
					<p class="alert">
						Moving the Library stopped after {libraryMove.moved} of {libraryMove.parts} Parts: {libraryMove.reason}
					</p>
					{#each libraryMove.sources as source (source.path)}
						<p>{pluralise(source.parts, 'Part')} are still under {source.path}:</p>
						<ul class="stranded">
							{#each source.files as path (path)}
								<li>{path}</li>
							{/each}
						</ul>
					{/each}
					<div class="row">
						<form method="POST" action="?/startLibraryMove">
							<button class="button" type="submit">Try again</button>
						</form>
						<form method="POST" action="?/dismissLibraryMove">
							<button class="button" type="submit">Dismiss</button>
						</form>
					</div>
				{:else if libraryMove.state === 'dismissed'}
					{#each libraryMove.sources as source (source.path)}
						<p>{pluralise(source.parts, 'Part')} are still under {source.path}:</p>
						<ul class="stranded">
							{#each source.files as path (path)}
								<li>{path}</li>
							{/each}
						</ul>
					{/each}
					<p class="note">
						A move that stopped partway left your Library in more than one place, so Pacerr goes on
						saying where each Part is until one of them holds all of it.
					</p>
					<form method="POST" action="?/startLibraryMove">
						<button class="button" type="submit">Move them to {libraryMove.destination}</button>
					</form>
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
					<input class="input" name="downloads" value={downloads.path} readonly />
				</label>
				<p class="note">
					The download directory is configured by {downloads.variable}, and cannot be changed here.
				</p>
			</div>
		{:else}
			<form method="POST" action="?/saveDownloads">
				<label>
					<span>Download directory</span>
					<input class="input" name="downloads" autocomplete="off" value={downloads.path} />
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
				<input class="input" name="remotePath" autocomplete="off" placeholder="/data/torrents" />
			</label>
			<label>
				<span>The same place as Pacerr sees it</span>
				<input class="input" name="localPath" autocomplete="off" placeholder="/downloads" />
			</label>
			<p class="note">
				Only needed when the two do not share a mount layout. The Download Client reports where it
				put a completed download using its own paths; a mapping rewrites that prefix to the
				equivalent path inside this container.
			</p>
			<button class="button" type="submit">Add</button>
		</form>
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

	.pinned {
		display: grid;
		gap: var(--space-3);
		max-width: var(--form-width);
		margin-bottom: var(--space-3);
	}

	.move {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
		max-width: var(--prose-width);
		margin: 0 0 var(--space-3);
		padding: var(--space-3);
		border: var(--hairline) solid var(--border);
		border-radius: var(--radius-control);
	}

	.move p {
		margin: 0;
	}

	.stranded {
		max-height: var(--scroll-height);
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--ink-bright);
		word-break: break-all;
	}

	.paths ul {
		display: grid;
		gap: var(--space-1);
		max-width: var(--prose-width);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
		color: var(--ink-dim);
	}

	.paths li.warned {
		color: var(--ink-bright);
	}

	.paths li.bad {
		color: var(--danger);
	}

	.mapping-list {
		display: grid;
		gap: var(--space-1);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}

	.mapping-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}

	.mapping-list code {
		color: var(--ink-bright);
	}

	.mapping-list form {
		display: inline;
		max-width: none;
	}
</style>
