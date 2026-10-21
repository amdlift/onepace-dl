<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const target = $derived(data.target);
	const directory = $derived(data.directory);
	const parent = $derived(data.parent);
	const directories = $derived(data.directories);

	const at = (path: string): string =>
		`/settings/browse?for=${target}&at=${encodeURIComponent(path)}`;
</script>

<svelte:head><title>Browse - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>Choose the {data.subject}</h1>
	<a class="button" href="/settings">Back to Settings</a>
</div>

{#if data.problem}
	<p class="alert">{data.problem}</p>
{/if}

{#if form?.problem}
	<p class="alert">{form.problem}</p>
{/if}

<form method="POST" action="?/select">
	<input type="hidden" name="for" value={target} />
	<label>
		<span>Path</span>
		<input class="input" name="at" autocomplete="off" value={directory} />
	</label>
	<p class="note">
		Type or paste a path to open it, or click down to one below. Pacerr shows the directories this
		container can see and hides its own system directories, so what is left is your mounts.
	</p>
	<div class="row">
		<button class="button" type="submit" formmethod="get" formaction="/settings/browse">
			Open
		</button>
		<button class="button" type="submit">Use this directory</button>
	</div>
</form>

<ul class="directories">
	{#if parent !== null}
		<li><a class="up" href={at(parent)}>Up one level</a></li>
	{/if}
	{#each directories as entry (entry.path)}
		<li><a class="name" href={at(entry.path)}>{entry.name}</a></li>
	{/each}
</ul>

{#if directories.length === 0}
	<p class="empty">Nothing inside {directory} that Pacerr can show you.</p>
{/if}

<style>
	form {
		display: grid;
		gap: var(--space-3);
		justify-items: start;
		max-width: var(--control-width);
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

	.directories {
		display: grid;
		gap: var(--space-1);
		max-width: var(--control-width);
		margin: var(--space-4) 0 0;
		padding: 0;
		list-style: none;
	}

	.directories a {
		display: block;
		padding: var(--space-2);
		border: var(--hairline) solid var(--border);
		border-radius: var(--radius-control);
		background: var(--surface-panel);
		color: var(--ink);
		text-decoration: none;
	}

	.directories .up {
		color: var(--ink-dim);
	}
</style>
