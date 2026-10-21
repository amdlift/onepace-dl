<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Log in - Pacerr</title></svelte:head>

<h1>Log in</h1>

{#if form?.problem}
	<p class="alert">{form.problem}</p>
{/if}

<form method="POST" action="?/logIn">
	<label>
		<span>Username</span>
		<input name="username" autocomplete="username" required />
	</label>
	<label>
		<span>Password</span>
		<input name="password" type="password" autocomplete="current-password" required />
	</label>
	<button class="button" type="submit">Log in</button>
</form>

<style>
	form {
		display: grid;
		gap: 0.75rem;
		max-width: 18rem;
		margin-top: 1rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
	}

	span {
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
</style>
