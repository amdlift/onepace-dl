import {
	copyFileSync,
	existsSync,
	linkSync,
	mkdirSync,
	renameSync,
	rmSync,
	unlinkSync
} from 'node:fs';
import { dirname, extname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { Clock } from '../clock';
import type { DownloadClient } from '../download/client';
import { DownloadService, reasonOf } from '../download/service';
import { recordHistory, type HistoryEntry } from '../history/store';
import { renderLibraryPath, type NamingFields } from './naming';
import {
	readNamingTemplate,
	readPendingImports,
	recordHadPart,
	type ImportTarget,
	type PendingImport
} from './store';

const copiedInsteadOfLinked =
	'The Library and the download directory are on different filesystems, so Pacerr copied this ' +
	'file rather than hardlinking it. It occupies disk twice for as long as the Release seeds.';

/** Whether the source file survives the placement. Only Manual Import ever asks for `move`. */
export type Placing = 'hardlink' | 'move';

export interface Placement {
	libraryPath: string;
	copied: boolean;
}

/**
 * Puts one file in the Library under the rendered name. Every file in the Library arrives through
 * here, so downloaded and manually imported Parts land in one consistent tree.
 */
export function placeIntoLibrary(
	library: string,
	source: string,
	template: string,
	naming: NamingFields,
	placing: Placing = 'hardlink'
): Placement {
	const libraryPath = renderLibraryPath(template, naming) + extname(source);
	const destination = join(library, libraryPath);
	mkdirSync(dirname(destination), { recursive: true });
	rmSync(destination, { force: true });

	if (placing === 'move') {
		try {
			renameSync(source, destination);
		} catch (error) {
			if (!crossesFilesystems(error)) throw error;
			copyFileSync(source, destination);
			unlinkSync(source);
		}
		return { libraryPath, copied: false };
	}

	try {
		linkSync(source, destination);
		return { libraryPath, copied: false };
	} catch (error) {
		if (!crossesFilesystems(error)) throw error;
		copyFileSync(source, destination);
		return { libraryPath, copied: true };
	}
}

/**
 * Files completed downloads into the Library. Hardlinks by default so a Part does not occupy disk
 * twice while it seeds, and copies only where the filesystem leaves no choice.
 */
export class ImportService {
	#db: Database;
	#clock: Clock;
	#downloads: DownloadService;
	#library: string;

	constructor(db: Database, clock: Clock, downloads: DownloadService, library: string) {
		this.#db = db;
		this.#clock = clock;
		this.#downloads = downloads;
		this.#library = library;
	}

	async run(): Promise<void> {
		const pending = readPendingImports(this.#db);
		if (pending.length === 0) return;

		const client = this.#downloads.client();
		if (client === null) return;

		const completed = new Map<string, string>();
		try {
			for (const status of await client.statuses(pending.map((grab) => grab.infohash))) {
				if (status.state === 'completed' && status.contentPath !== null)
					completed.set(status.infohash, status.contentPath);
			}
			this.#downloads.noteSuccess();
		} catch (error) {
			this.#downloads.noteFailure(error);
			return;
		}

		const template = readNamingTemplate(this.#db);
		for (const grab of pending) {
			const contentPath = completed.get(grab.infohash);
			if (contentPath !== undefined) await this.#import(client, grab, contentPath, template);
		}
	}

	async #import(
		client: DownloadClient,
		grab: PendingImport,
		contentPath: string,
		template: string
	): Promise<void> {
		let sources: string[];
		try {
			sources = await this.#sourceFiles(client, grab, contentPath);
		} catch (error) {
			this.#record(
				grab.targets
					.filter((target) => !target.had)
					.map((target) => failed(grab, target, reasonOf(error)))
			);
			return;
		}

		const entries: HistoryEntry[] = [];
		for (const [position, source] of sources.entries()) {
			const target = grab.targets[position];
			if (target === undefined || target.had) continue;
			try {
				const placed = placeIntoLibrary(this.#library, source, template, target.naming);
				recordHadPart(
					this.#db,
					{
						partSlug: target.partSlug,
						libraryPath: placed.libraryPath,
						infohash: grab.infohash
					},
					this.#clock.now()
				);
				entries.push({
					event: 'import',
					outcome: placed.copied ? 'warned' : 'succeeded',
					partSlug: target.partSlug,
					partTitle: target.partTitle,
					infohash: grab.infohash,
					releaseTitle: grab.releaseTitle,
					detail: placed.libraryPath,
					reason: placed.copied ? copiedInsteadOfLinked : null
				});
			} catch (error) {
				entries.push(failed(grab, target, reasonOf(error)));
			}
		}
		this.#record(entries);
	}

	/**
	 * The downloaded file for each Part the grab was made for, in torrent order. Files the
	 * Download Client was told to skip were never written, so what is on disk is what was wanted.
	 */
	async #sourceFiles(
		client: DownloadClient,
		grab: PendingImport,
		contentPath: string
	): Promise<string[]> {
		// qBittorrent names a torrent's files relative to its save path, and reports the content
		// path as that save path plus the torrent's own root entry.
		const savePath = dirname(contentPath);
		const present = (await client.files(grab.infohash))
			.map((name) => join(savePath, name))
			.filter((path) => existsSync(path));
		if (present.length !== grab.targets.length)
			throw new Error(
				`The completed download under ${savePath} holds ${present.length} of the ` +
					`${grab.targets.length} files Pacerr expected, so it cannot tell which file belongs ` +
					'to which Part. Check that Pacerr can read the path the Download Client reports.'
			);
		return present;
	}

	#record(entries: HistoryEntry[]): void {
		if (entries.length > 0) recordHistory(this.#db, this.#clock.now(), entries);
	}
}

const failed = (grab: PendingImport, target: ImportTarget, reason: string): HistoryEntry => ({
	event: 'import',
	outcome: 'failed',
	partSlug: target.partSlug,
	partTitle: target.partTitle,
	infohash: grab.infohash,
	releaseTitle: grab.releaseTitle,
	reason
});

const crossesFilesystems = (error: unknown): boolean =>
	(error as NodeJS.ErrnoException | null)?.code === 'EXDEV';
