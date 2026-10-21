<script lang="ts">
	import {
		formatDownloadState,
		formatHistoryEvent,
		formatProgress,
		formatTimestamp
	} from '../../lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const activity = $derived(data.activity);
	const connection = $derived(activity.connection);
	const problem = $derived(connection !== null && !connection.ok ? connection.detail : null);
</script>

<svelte:head><title>Activity - Pacerr</title></svelte:head>

<div class="toolbar">
	<h1>Activity</h1>
</div>

{#if problem !== null}
	<p class="alert">{problem}</p>
{/if}

<section>
	<h2>Queue</h2>

	{#if activity.queue.length === 0}
		<p class="empty">Nothing is downloading.</p>
	{:else}
		<table class="table">
			<thead>
				<tr>
					<th>Release</th>
					<th>Parts</th>
					<th>Status</th>
					<th class="numeric">Progress</th>
				</tr>
			</thead>
			<tbody>
				{#each activity.queue as row (row.infohash)}
					<tr>
						<td>
							{row.releaseTitle}
							{#if row.batch}<span class="badge">Batch</span>{/if}
						</td>
						<td class="parts">{row.partTitles.join(', ')}</td>
						<td class="state">{formatDownloadState(row.state)}</td>
						<td class="numeric progress">{formatProgress(row.progress)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<section class="history">
	<h2>History</h2>

	{#if activity.history.length === 0}
		<p class="empty">Pacerr has not done anything yet.</p>
	{:else}
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
				{#each activity.history as entry (entry.id)}
					<tr>
						<td class="numeric">{formatTimestamp(new Date(entry.at))}</td>
						<td class="event" class:bad={entry.outcome === 'failed'}>
							{formatHistoryEvent(entry.event, entry.outcome)}
						</td>
						<td>{entry.partTitle ?? ''}</td>
						<td>
							{entry.releaseTitle ?? ''}
							{#if entry.detail}<span class="detail">{entry.detail}</span>{/if}
							{#if entry.replacedInfohash}
								<span class="replaced">
									Replaced {entry.replacedReleaseTitle ?? 'an earlier Release'} · {entry.replacedInfohash}
								</span>
							{/if}
							{#if entry.reason}<span class="reason">{entry.reason}</span>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.parts,
	.reason,
	.replaced,
	.detail {
		display: block;
		color: var(--ink-dim);
	}

	.event.bad {
		color: var(--danger);
	}
</style>
