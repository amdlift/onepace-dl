<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const authentication = $derived(data.authentication);
	const fromEnvironment = $derived(authentication.source === 'environment');
</script>

<svelte:head><title>Settings - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>Settings</h1>
</div>

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

	input[name='username'],
	input[name='password'] {
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
