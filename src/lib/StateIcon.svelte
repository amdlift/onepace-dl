<script lang="ts">
	import { formatState, type State } from './state';

	// The Queue names the same treatments in the Download Client's words, so the word is separable
	// from the colour and the glyph that carry it.
	let { state, label = formatState(state) }: { state: State; label?: string } = $props();
</script>

<td class="state-icon {state}">
	<svg viewBox="0 0 14 14" role="img" aria-label={label}>
		{#if state === 'had'}
			<path d="M2.5 7.25 5.75 10.5 11.5 3.75" />
		{:else if state === 'downloading'}
			<path d="M7 2v6.5M4 5.75 7 8.75l3-3M2.75 11.5h8.5" />
		{:else if state === 'missing'}
			<path d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5" />
		{:else if state === 'unmonitored'}
			<circle cx="7" cy="7" r="4.25" />
		{:else if state === 'unreleased'}
			<path d="M2.75 7h8.5" />
		{:else}
			<path d="M11.25 7a4.25 4.25 0 1 1-1.25-3" />
			<path d="M11.25 1.75v2.75H8.5" />
		{/if}
	</svg>
</td>
