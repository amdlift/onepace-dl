<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const root = $derived(data.root);
	const directory = $derived(data.directory);
	const importSource = $derived(data.importSource);
	const files = $derived(data.files);
	const parts = $derived(data.parts);
	const fillingPart = $derived(data.fillingPart);
</script>

<svelte:head><title>Manual Import - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>Manual Import</h1>
	<nav class="roots" aria-label="Directory">
		<a href="/manual-import" aria-current={root === 'source' ? 'page' : undefined}>Import Source</a>
		<a href="/manual-import?root=library" aria-current={root === 'library' ? 'page' : undefined}>
			Library
		</a>
	</nav>
</div>

{#if directory === null}
	<p class="empty">
		Pacerr has no Import Source configured, so there is nowhere to look. Set one in Settings.
	</p>
{:else if files.length === 0}
	<p class="empty">No video files under {directory}.</p>
{:else if fillingPart !== null}
	<p class="note">
		Pick the file you already have for
		<strong>{fillingPart.arcTitle} {fillingPart.number} - {fillingPart.title}</strong>. Pacerr
		pre-selects the one whose name says so, and selects nothing where it is not sure.
	</p>

	<form method="POST" action="?/importOne">
		<input type="hidden" name="root" value={root} />
		<input type="hidden" name="part" value={fillingPart.slug} />
		<table class="table">
			<thead>
				<tr>
					<th></th>
					<th>File</th>
				</tr>
			</thead>
			<tbody>
				{#each files as file (file.path)}
					<tr>
						<td>
							<input
								type="radio"
								name="file"
								value={file.path}
								checked={file.suggestedPartSlug === fillingPart.slug}
							/>
						</td>
						<td class="file">{file.path}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<label class="placing">
			<input type="checkbox" name="placing" value="move" />
			<span>Move this file into the Library instead of hardlinking it.</span>
		</label>

		<button class="button" type="submit">Import</button>
	</form>
{:else}
	<p class="note">
		Pacerr suggests a Part where a filename names one plainly, and leaves the field blank where it
		is not sure rather than guessing. Nothing is filed until you press Import, and a file left
		blank is left alone. Only {importSource ?? 'the Import Source'} and the Library are read.
	</p>

	<form method="POST" action="?/import">
		<input type="hidden" name="root" value={root} />
		<table class="table">
			<thead>
				<tr>
					<th>File</th>
					<th>Part</th>
				</tr>
			</thead>
			<tbody>
				{#each files as file (file.path)}
					<tr>
						<td class="file">{file.path}</td>
						<td>
							<select class="input" name="part:{file.path}">
								<option value="" selected={file.suggestedPartSlug === null}>Choose a Part</option>
								{#each parts as part (part.slug)}
									<option value={part.slug} selected={file.suggestedPartSlug === part.slug}>
										{part.arcTitle}
										{part.number} - {part.title}
									</option>
								{/each}
							</select>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<label class="placing">
			<input type="checkbox" name="placing" value="move" />
			<span>
				Move these files into the Library instead of hardlinking them, leaving nothing behind
				where they came from.
			</span>
		</label>

		<button class="button" type="submit">Import</button>
	</form>
{/if}

<style>
	.roots {
		display: flex;
		gap: var(--space-3);
	}

	.roots a[aria-current='page'] {
		color: var(--ink-bright);
	}

	.file {
		color: var(--ink-dim);
	}

	.placing {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		margin: var(--space-3) 0;
		color: var(--ink-dim);
	}
</style>
