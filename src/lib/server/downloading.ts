import type { App } from './app';
import type { ConnectionTest, DownloadStatus } from './download/client';
import { answered, unreachable } from './download/service';
import { readGrabs } from './download/store';

export type CurrentStatus = Pick<DownloadStatus, 'state' | 'progress'>;

export interface StatusReading {
	/** Empty where nobody was asked, so a view keeps saying everything else it knows. */
	statuses: Map<string, CurrentStatus>;
	/** How this read went. Null where there was nothing to ask about or nobody to ask. */
	outcome: ConnectionTest | null;
}

/**
 * What the Download Client says about the Releases Pacerr handed it. The client is the only thing
 * that knows, so Pacerr reports that it does not know rather than guessing — and rendering a view
 * records nothing, because opening one is not an attempt to use the Download Client.
 */
export async function currentStatuses(app: App, infohashes: string[]): Promise<StatusReading> {
	const client = app.downloads.client();
	if (client === null || infohashes.length === 0) return { statuses: new Map(), outcome: null };
	try {
		const statuses = await client.statuses(infohashes);
		return {
			statuses: new Map(
				statuses.map((status) => [
					status.infohash,
					{ state: status.state, progress: status.progress }
				])
			),
			outcome: answered
		};
	} catch (error) {
		return { statuses: new Map(), outcome: unreachable(error) };
	}
}

/**
 * The Parts the Download Client is working on right now, reached from the Release it was handed
 * through `grab_part` — per ADR-0004 the infohash is the only thing that joins the two. An
 * unreachable client yields nothing, so a view that shows state keeps showing the rest of it.
 */
export async function downloadingParts(app: App): Promise<Set<string>> {
	const grabs = readGrabs(app.db);
	const { statuses } = await currentStatuses(
		app,
		grabs.map((grab) => grab.infohash)
	);
	return new Set(
		grabs
			.filter((grab) => statuses.get(grab.infohash)?.state === 'downloading')
			.flatMap((grab) => grab.partSlugs)
	);
}
