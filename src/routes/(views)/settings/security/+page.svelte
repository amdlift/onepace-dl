<script lang="ts">
	import Setting from '../../../../lib/components/Setting.svelte';
	import SettingsChrome from '../../../../lib/components/SettingsChrome.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const authentication = $derived(data.authentication);
	const fromEnvironment = $derived(authentication.source === 'environment');
</script>

<svelte:head><title>Security - Pacerr</title></svelte:head>

<SettingsChrome>
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
				<Setting label="Require a login" field="enabled">
					<input type="checkbox" id="enabled" name="enabled" checked={authentication.enabled} />
				</Setting>

				<Setting label="Username" field="username">
					<input
						class="input"
						id="username"
						name="username"
						autocomplete="username"
						value={authentication.username ?? ''}
					/>
				</Setting>

				<Setting label="Password" field="password">
					<input
						class="input"
						id="password"
						name="password"
						type="password"
						autocomplete="new-password"
						placeholder="Unchanged"
					/>
					{#snippet help()}
						Pacerr has one account, and saving replaces it. Setting PACERR_AUTH_USERNAME and
						PACERR_AUTH_PASSWORD configures it from the environment instead.
					{/snippet}
				</Setting>

				<div class="setting">
					<div class="control">
						<button class="button" type="submit">Save</button>
					</div>
				</div>
			</form>
		{/if}

		{#if authentication.signedIn}
			<div class="setting">
				<div class="control">
					<form method="POST" action="?/logOut">
						<button class="button" type="submit">Log out</button>
					</form>
				</div>
			</div>
		{/if}
	</section>
</SettingsChrome>
