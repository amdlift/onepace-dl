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
		<input class="input" name="username" autocomplete="username" required />
	</label>
	<label>
		<span>Password</span>
		<input class="input" name="password" type="password" autocomplete="current-password" required />
	</label>
	<button class="button" type="submit">Log in</button>
</form>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		max-width: var(--form-width);
		margin-top: var(--space-4);
	}

	label {
		display: grid;
		gap: var(--space-1);
	}

	span {
		color: var(--ink-dim);
	}
</style>
