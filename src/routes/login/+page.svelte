<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Log in - Pacerr</title></svelte:head>

<div class="screen">
	<div class="panel">
		<p class="brand">Pacerr</p>
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
				<input
					class="input"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</label>
			<button class="button" type="submit">Log in</button>
		</form>
	</div>
</div>

<style>
	.screen {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--content-padding);
	}

	.panel {
		width: 100%;
		max-width: var(--form-width);
		padding: var(--space-6);
		border-radius: var(--radius-control);
		background: var(--surface-raised);
	}

	.brand {
		margin: 0 0 var(--space-2);
		color: var(--brand);
		font-size: var(--type-modal-title);
		letter-spacing: var(--type-tracking);
		text-transform: uppercase;
	}

	form {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	label {
		display: grid;
		gap: var(--space-1);
	}

	label span {
		color: var(--ink-dim);
	}
</style>
