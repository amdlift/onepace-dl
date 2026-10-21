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
		<input name="at" autocomplete="off" value={directory} />
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
		gap: 0.75rem;
		justify-items: start;
		max-width: 32rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
		width: 100%;
	}

	label span {
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	input {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 2px;
		background: var(--surface-panel);
		color: var(--ink);
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	.note {
		margin: 0;
		color: var(--ink-dim);
		font-size: 0.8rem;
	}

	.directories {
		display: grid;
		gap: 0.25rem;
		max-width: 32rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}

	.directories a {
		display: block;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 2px;
		background: var(--surface-panel);
		color: var(--ink);
		text-decoration: none;
	}

	.directories .up {
		color: var(--ink-dim);
	}

	.empty {
		color: var(--ink-dim);
		font-size: 0.8rem;
	}
</style>
