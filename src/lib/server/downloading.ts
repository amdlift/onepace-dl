import type { App } from './app';
import type { DownloadStatus } from './download/client';
import { readGrabs } from './download/store';

export type CurrentStatus = Pick<DownloadStatus, 'state' | 'progress'>;

/**
 * What the Download Client says about the Releases Pacerr handed it. Null where there is nothing
 * to ask about or nobody to ask: the client is the only thing that knows, so Pacerr reports that
 * it does not know rather than guessing.
 */
export async function currentStatuses(
	app: App,
	infohashes: string[]
): Promise<Map<string, CurrentStatus> | null> {
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

/**
 * The Parts the Download Client is working on right now, reached from the Release it was handed
 * through `grab_part` — per ADR-0004 the infohash is the only thing that joins the two. An
 * unreachable client yields nothing, so a view that shows state keeps showing the rest of it.
 */
export async function downloadingParts(app: App): Promise<Set<string>> {
	const grabs = readGrabs(app.db);
	const statuses = await currentStatuses(
		app,
		grabs.map((grab) => grab.infohash)
	);
	if (statuses === null) return new Set();
	return new Set(
		grabs
			.filter((grab) => statuses.get(grab.infohash)?.state === 'downloading')
			.flatMap((grab) => grab.partSlugs)
	);
}
