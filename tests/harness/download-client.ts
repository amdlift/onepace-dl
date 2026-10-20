import { rmSync } from 'node:fs';
import type {
	ConnectionFailure,
	ConnectionTest,
	DownloadClient,
	DownloadRequest,
	DownloadStatus,
	FilePriority
} from '../../src/lib/server/download/client';

export type FakeDownload = DownloadRequest & {
	infohash: string;
	filePriorities: Map<number, FilePriority>;
	fileCount: number;
	state: DownloadStatus['state'];
	progress: number;
	contentPath: string | null;
};

export interface FakeRemoval {
	infohash: string;
	deleteData: boolean;
}

const failureDetails: Record<ConnectionFailure, string> = {
	unconfigured: 'No Download Client is configured.',
	unreachable: 'The Download Client did not answer.',
	credentials: 'The Download Client rejected that username and password.',
	banned: 'The Download Client has banned this address after too many failed logins.',
	rejected: 'That address answered, but not like a Download Client.'
};

/**
 * Records what Pacerr asked the Download Client for, and lets a test drive a download to
 * completion. Stands in for qBittorrent at seam 1.
 */
export class FakeDownloadClient implements DownloadClient {
	readonly added: FakeDownload[] = [];
	readonly removed: FakeRemoval[] = [];
	reachable = true;
	/** What the daemon is doing wrong, when it is answering at all. */
	failing: ConnectionFailure | null = null;
	/** How many files every torrent added from here turns out to contain. */
	filesPerTorrent = 1;

	async add(request: DownloadRequest): Promise<void> {
		this.#requireReachable();
		this.added.push({
			...request,
			infohash: request.infohash.toLowerCase(),
			filePriorities: new Map(),
			fileCount: this.filesPerTorrent,
			state: 'downloading',
			progress: 0,
			contentPath: null
		});
	}

	async files(infohash: string): Promise<string[]> {
		this.#requireReachable();
		const download = this.#find(infohash);
		return Array.from(
			{ length: download.fileCount },
			(_, position) => `${download.infohash}/${position + 1}.mkv`
		);
	}

	async setFilePriority(
		infohash: string,
		positions: number[],
		priority: FilePriority
	): Promise<void> {
		this.#requireReachable();
		const download = this.#find(infohash);
		for (const position of positions) download.filePriorities.set(position, priority);
	}

	async statuses(infohashes: string[]): Promise<DownloadStatus[]> {
		this.#requireReachable();
		const wanted = new Set(infohashes.map((it) => it.toLowerCase()));
		return this.added
			.filter((download) => wanted.has(download.infohash))
			.map((download) => ({
				infohash: download.infohash,
				state: download.state,
				progress: download.progress,
				contentPath: download.contentPath
			}));
	}

	async remove(infohash: string, deleteData: boolean): Promise<void> {
		this.#requireReachable();
		this.removed.push({ infohash: infohash.toLowerCase(), deleteData });
		const index = this.added.findIndex((it) => it.infohash === infohash.toLowerCase());
		if (index < 0) return;
		const [download] = this.added.splice(index, 1);
		// A real daemon deletes the files, and whether what Pacerr put in the Library survives
		// that is the whole question an Upgrade asks of the filesystem.
		if (deleteData && download?.contentPath != null)
			rmSync(download.contentPath, { recursive: true, force: true });
	}

	async test(): Promise<ConnectionTest> {
		this.#requireReachable();
		if (this.failing !== null)
			return { ok: false, failure: this.failing, detail: failureDetails[this.failing] };
		return { ok: true, detail: 'Connected to qBittorrent 5.0.3.' };
	}

	/** Drive a download to "complete", as a torrent client eventually would. */
	complete(infohash: string, contentPath: string): void {
		const download = this.#find(infohash);
		download.state = 'completed';
		download.progress = 1;
		download.contentPath = contentPath;
	}

	progressed(infohash: string, progress: number): void {
		this.#find(infohash).progress = progress;
	}

/** Every torrent Pacerr asked to leave files out of, and which positions it left out. */
	deselected(): { infohash: string; positions: number[] }[] {
		return this.added
			.map((download) => ({
				infohash: download.infohash,
				positions: [...download.filePriorities]
					.filter(([, priority]) => priority === 'skip')
					.map(([position]) => position)
					.sort((left, right) => left - right)
			}))
			.filter((download) => download.positions.length > 0);
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
