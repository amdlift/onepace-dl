export type FilePriority = 'skip' | 'normal';

/** Per ADR-0001 a Release resolves to one of these; a Release with neither cannot be grabbed. */
export type DownloadSource =
	| { magnetUri: string; torrentUrl?: string }
	| { magnetUri?: string; torrentUrl: string };

export type DownloadRequest = { infohash: string } & DownloadSource;

export interface DownloadStatus {
	infohash: string;
	state: 'downloading' | 'completed' | 'failed';
	progress: number;
	contentPath: string | null;
}

export type ConnectionFailure =
	| 'unconfigured'
	| 'unreachable'
	| 'credentials'
	| 'banned'
	| 'rejected';

export type ConnectionTest =
	| { ok: true; detail: string }
	| { ok: false; failure: ConnectionFailure; detail: string };

/**
 * The external BitTorrent daemon Pacerr delegates every transfer to. Per ADR-0001 Pacerr never
 * speaks BitTorrent itself; qBittorrent is the only implementation.
 */
export interface DownloadClient {
	add(request: DownloadRequest): Promise<void>;
	/**
	 * The torrent's files in torrent order, waiting out the metadata a magnet link does not carry
	 * until the swarm supplies it.
	 */
	files(infohash: string): Promise<string[]>;
	/**
	 * Files are addressed by their position in that list, because ADR-0004 leaves Pacerr nothing
	 * else: matching a file to a Part by name is the filename parsing that decision rejects.
	 */
	setFilePriority(infohash: string, positions: number[], priority: FilePriority): Promise<void>;
	statuses(infohashes: string[]): Promise<DownloadStatus[]>;
	/**
	 * The directory the daemon says it writes completed downloads into. This, not the mount Pacerr
	 * was configured with, is the path an import will actually read. Null where it states none.
	 */
	saveDirectory(): Promise<string | null>;
	remove(infohash: string, deleteData: boolean): Promise<void>;
	test(): Promise<ConnectionTest>;
}

/** How Pacerr reaches the Download Client. Stored in Settings, never in the environment. */
export interface DownloadClientConnection {
	url: string;
	username: string;
	password: string;
}

export type DownloadClientFactory = (connection: DownloadClientConnection) => DownloadClient;
