<script lang="ts">
	import Chrome from '../../../lib/components/Chrome.svelte';
	import {
		formatCoverage,
		formatHistoryEvent,
		formatReleaseStatus,
		formatResolution,
		formatTimestamp,
		formatVariant,
		pluralise
	} from '../../../lib/format';
	import type { PageProps } from './$types';

	type UnmatchedRelease = PageProps['data']['unmatched']['current'][number];

	let { data }: PageProps = $props();

	const checks = $derived(data.checks);
	const unmatched = $derived(data.unmatched);
	const history = $derived(data.history);
</script>

{#snippet releases(rows: UnmatchedRelease[])}
	<table class="table">
		<thead>
			<tr>
				<th>Release</th>
				<th>Covers</th>
				<th>Published</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as release (release.infohash)}
				<tr>
					<td>
						{release.title}
						<span class="facts">
							{formatResolution(release.resolution)} · {formatVariant(release.variant)} · {formatReleaseStatus(
								release.status
							)}
						</span>
						<span class="infohash">{release.infohash}</span>
					</td>
					<td class="covers">
						{#if formatCoverage(release.chapters) !== null}
							<span>Chapters {formatCoverage(release.chapters)}</span>
						{/if}
						{#if formatCoverage(release.episodes) !== null}
							<span>Episodes {formatCoverage(release.episodes)}</span>
						{/if}
					</td>
					<td class="numeric">{formatTimestamp(new Date(release.publishedAt))}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<svelte:head><title>System - Pacerr</title></svelte:head>

<Chrome title="System">
	<section class="checks">
		<h2>Health</h2>
		<ul>
			{#each checks as check (check.name)}
				<li class={check.status}>
					<span class="subject">{check.subject}</span>
					<span class="outcome">{check.outcome}</span>
					{#if check.at !== null}<span class="when">{formatTimestamp(new Date(check.at))}</span>{/if}
					<span class="summary">{check.summary}</span>
					{#if check.detail !== null}<span class="detail">{check.detail}</span>{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="unmatched">
		<h2>Unmatched Releases</h2>
		<p class="status">
			<span>{pluralise(unmatched.total, 'Unmatched Release')}</span>
			<span>{unmatched.current.length} the feed still calls current</span>
			<span>{unmatched.delisted.length} One Pace has delisted</span>
		</p>

		{#if unmatched.current.length === 0}
			<p class="empty">Every current Release in the feed is accounted for in the Catalogue.</p>
		{:else}
			<div class="current-unmatched">
				{@render releases(unmatched.current)}
			</div>
		{/if}

		{#if unmatched.delisted.length > 0}
			<details class="delisted">
				<summary>
					{pluralise(unmatched.delisted.length, 'superseded Release')} One Pace dropped from the watch
					page but still publishes in the feed
				</summary>
				{@render releases(unmatched.delisted)}
			</details>
		{/if}
	</section>

	<section class="history">
		<h2>History</h2>

		{#if history.total === 0}
			<p class="empty">Pacerr has not done anything yet.</p>
		{:else}
			<p class="status">
				<span>{pluralise(history.total, 'event')}</span>
				<span>Showing {history.from + 1} to {history.from + history.entries.length}</span>
			</p>
			<table class="table">
				<thead>
					<tr>
						<th>When</th>
						<th>Event</th>
						<th>Part</th>
						<th>Release</th>
					</tr>
				</thead>
				<tbody>
					{#each history.entries as entry (entry.id)}
						<tr>
							<td class="numeric">{formatTimestamp(new Date(entry.at))}</td>
							<td class="event {entry.outcome}">{formatHistoryEvent(entry.event, entry.outcome)}</td>
							<td>{entry.partTitle ?? ''}</td>
							<td>
								{entry.releaseTitle ?? ''}
								{#if entry.replacedInfohash !== null}
									<span class="infohash">replacing {entry.replacedInfohash}</span>
								{/if}
								{#if entry.reason !== null}<span class="reason">{entry.reason}</span>{/if}
								{#if entry.detail !== null}<span class="reason">{entry.detail}</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="pages">
				{#if history.newer !== null}<a href="/system?from={history.newer}">Newer</a>{/if}
				{#if history.older !== null}<a href="/system?from={history.older}">Older</a>{/if}
			</p>
		{/if}
	</section>
</Chrome>

<style>
	.checks ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.checks li {
		display: grid;
		grid-template-columns: var(--column-narrow) var(--column-narrow) 1fr;
		gap: var(--space-1) var(--space-4);
		padding: var(--space-2) var(--space-3);
		border-left: var(--accent-bar) solid var(--border);
		border-bottom: var(--hairline) solid var(--border);
	}

	.checks li.warned {
		border-left-color: var(--warning);
	}

	.checks li.failed {
		border-left-color: var(--danger);
	}

	.checks .subject {
		color: var(--ink-bright);
	}

	.checks .when {
		grid-column: 3;
		color: var(--ink-dim);
	}

	.checks .summary,
	.checks .detail {
		grid-column: 1 / -1;
		color: var(--ink-dim);
	}

	.history .event.failed {
		color: var(--danger);
	}

	.history .event.warned {
		color: var(--warning);
	}

	.history .reason {
		display: block;
		color: var(--ink-dim);
	}

	.pages {
		display: flex;
		gap: var(--space-4);
		margin: var(--space-3) 0 0;
	}

	.delisted summary {
		padding: var(--space-2) 0;
		color: var(--ink-dim);
		cursor: pointer;
	}

	.facts,
	.covers,
	.infohash {
		color: var(--ink-dim);
	}

	.covers span,
	.infohash {
		display: block;
	}

	.infohash {
		font-family: var(--font-mono);
	}
</style>
