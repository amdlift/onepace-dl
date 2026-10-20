import type { Database } from 'better-sqlite3';
import type { DownloadClient, DownloadStatus } from '../download/client';

/** A rewrite from a path as the Download Client reports it to the equivalent path here. */
export interface RemotePathMapping {
	id: number;
	remotePath: string;
	localPath: string;
}

export function readRemotePathMappings(db: Database): RemotePathMapping[] {
	const rows = db
		.prepare('select id, remote_path, local_path from remote_path_mapping order by remote_path')
		.all() as { id: number; remote_path: string; local_path: string }[];
	return rows.map((row) => ({
		id: row.id,
		remotePath: row.remote_path,
		localPath: row.local_path
	}));
}

export function addRemotePathMapping(db: Database, remotePath: string, localPath: string): void {
	db.prepare('insert into remote_path_mapping (remote_path, local_path) values (?, ?)').run(
		trimTrailingSlash(remotePath),
		trimTrailingSlash(localPath)
	);
}

export function removeRemotePathMapping(db: Database, id: number): void {
	db.prepare('delete from remote_path_mapping where id = ?').run(id);
}

/**
 * The longest matching remote prefix wins, so a mapping for a subdirectory beats the one for the
 * root it sits under rather than depending on insertion order.
 */
function applyRemotePathMappings(
	mappings: RemotePathMapping[],
	reported: string
): string {
	const match = mappings
		.filter((mapping) => covers(mapping.remotePath, reported))
		.sort((left, right) => right.remotePath.length - left.remotePath.length)[0];
	return match === undefined
		? reported
		: match.localPath + reported.slice(match.remotePath.length);
}

/** Every path a Download Client reports, rewritten before anything above it sees one. */
export function throughRemotePathMappings(
	client: DownloadClient,
	mappings: RemotePathMapping[]
): DownloadClient {
	if (mappings.length === 0) return client;
	return {
		add: (request) => client.add(request),
		files: (infohash) => client.files(infohash),
		setFilePriority: (infohash, positions, priority) =>
			client.setFilePriority(infohash, positions, priority),
		remove: (infohash, deleteData) => client.remove(infohash, deleteData),
		test: () => client.test(),
		statuses: async (infohashes): Promise<DownloadStatus[]> =>
			(await client.statuses(infohashes)).map((status) => ({
				...status,
				contentPath:
					status.contentPath === null
						? null
						: applyRemotePathMappings(mappings, status.contentPath)
			}))
	};
}

const trimTrailingSlash = (path: string): string =>
	path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

const covers = (prefix: string, path: string): boolean =>
	path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
