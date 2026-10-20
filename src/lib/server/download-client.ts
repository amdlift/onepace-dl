export type FilePriority = 'skip' | 'normal';

export interface DownloadRequest {
	infohash: string;
	magnetUri?: string;
	torrentUrl?: string;
}

export interface DownloadStatus {
	infohash: string;
	state: 'downloading' | 'completed' | 'failed';
	progress: number;
	contentPath: string | null;
}

/**
 * The external BitTorrent daemon Pacerr delegates every transfer to. Per ADR-0001 Pacerr never
 * speaks BitTorrent itself; qBittorrent is the only implementation.
 */
export interface DownloadClient {
	add(request: DownloadRequest): Promise<void>;
	setFilePriority(infohash: string, path: string, priority: FilePriority): Promise<void>;
	statusOf(infohash: string): Promise<DownloadStatus | null>;
	remove(infohash: string, deleteData: boolean): Promise<void>;
	test(): Promise<void>;
}
