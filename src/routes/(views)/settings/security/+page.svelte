<script lang="ts">
	import Chrome from '../../../../lib/components/Chrome.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const authentication = $derived(data.authentication);
	const fromEnvironment = $derived(authentication.source === 'environment');
</script>

<svelte:head><title>Security - Pacerr</title></svelte:head>

<Chrome title="Settings">
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
					<input class="input" name="username" autocomplete="username" value={authentication.username ?? ''} />
				</label>
				<label>
					<span>Password</span>
					<input class="input" name="password" type="password" autocomplete="new-password" placeholder="Unchanged" />
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

	label.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	label span {
		color: var(--ink-dim);
	}
</style>
