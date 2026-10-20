import type {
	DownloadClient,
	DownloadRequest,
	DownloadStatus,
	FilePriority
} from '../../src/lib/server/download-client';

export interface FakeDownload extends DownloadRequest {
	infohash: string;
	filePriorities: Map<string, FilePriority>;
	state: DownloadStatus['state'];
	progress: number;
	contentPath: string | null;
}

export interface FakeRemoval {
	infohash: string;
	deleteData: boolean;
}

/**
 * Records what Pacerr asked the Download Client for, and lets a test drive a download to
 * completion. Stands in for qBittorrent at seam 1.
 */
export class FakeDownloadClient implements DownloadClient {
	readonly added: FakeDownload[] = [];
	readonly removed: FakeRemoval[] = [];
	reachable = true;

	async add(request: DownloadRequest): Promise<void> {
		this.#requireReachable();
		this.added.push({
			...request,
			infohash: request.infohash.toLowerCase(),
			filePriorities: new Map(),
			state: 'downloading',
			progress: 0,
			contentPath: null
		});
	}

	async setFilePriority(infohash: string, path: string, priority: FilePriority): Promise<void> {
		this.#requireReachable();
		this.#find(infohash).filePriorities.set(path, priority);
	}

	async statusOf(infohash: string): Promise<DownloadStatus | null> {
		this.#requireReachable();
		const download = this.added.find((it) => it.infohash === infohash.toLowerCase());
		if (download === undefined) return null;
		return {
			infohash: download.infohash,
			state: download.state,
			progress: download.progress,
			contentPath: download.contentPath
		};
	}

	async remove(infohash: string, deleteData: boolean): Promise<void> {
		this.#requireReachable();
		this.removed.push({ infohash: infohash.toLowerCase(), deleteData });
		const index = this.added.findIndex((it) => it.infohash === infohash.toLowerCase());
		if (index >= 0) this.added.splice(index, 1);
	}

	async test(): Promise<void> {
		this.#requireReachable();
	}

	/** Drive a download to "complete", as a torrent client eventually would. */
	complete(infohash: string, contentPath: string): void {
		const download = this.#find(infohash);
		download.state = 'completed';
		download.progress = 1;
		download.contentPath = contentPath;
	}

	#find(infohash: string): FakeDownload {
		const download = this.added.find((it) => it.infohash === infohash.toLowerCase());
		if (download === undefined) throw new Error(`no download was added for ${infohash}`);
		return download;
	}

	#requireReachable(): void {
		if (!this.reachable) throw new Error('the Download Client is unreachable');
	}
}
