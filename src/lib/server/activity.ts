import type { App } from './app';
import type { ConnectionTest } from './download/client';
import { readGrabs } from './download/store';
import { readHistory, type HistoryRecord } from './history/store';

export interface QueueRow {
	infohash: string;
	releaseTitle: string;
	batch: boolean;
	partTitles: string[];
	/** Unknown while the Download Client is not saying; it is the one that knows. */
	state: 'downloading' | 'completed' | 'failed' | 'unknown';
	progress: number | null;
}

export interface ActivityView {
	queue: QueueRow[];
	history: HistoryRecord[];
	connection: ConnectionTest | null;
}

/** What Pacerr is doing now and what it has done, both read from the Download Client live. */
export async function activityView(app: App): Promise<ActivityView> {
	const grabs = readGrabs(app.db);
	const statuses = await currentStatuses(
		app,
		grabs.map((grab) => grab.infohash)
	);

	return {
		queue: grabs.map((grab) => {
			const status = statuses?.get(grab.infohash);
			return {
				infohash: grab.infohash,
				releaseTitle: grab.releaseTitle,
				batch: grab.batch,
				partTitles: grab.partTitles,
				state: status?.state ?? 'unknown',
				progress: status?.progress ?? null
			};
		}),
		history: readHistory(app.db),
		connection: app.downloads.health()
	};
}

async function currentStatuses(
	app: App,
	infohashes: string[]
): Promise<Map<string, { state: QueueRow['state']; progress: number }> | null> {
	const client = app.downloads.client();
	if (client === null || infohashes.length === 0) return null;
	try {
		const statuses = await client.statuses(infohashes);
		app.downloads.noteSuccess();
		return new Map(
			statuses.map((status) => [status.infohash, { state: status.state, progress: status.progress }])
		);
	} catch (error) {
		app.downloads.noteFailure(error);
		return null;
	}
}
