import { copyFileSync, existsSync, linkSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { Clock } from '../clock';
import type { DownloadClient } from '../download/client';
import { DownloadService, reasonOf } from '../download/service';
import { recordHistory, type HistoryEntry } from '../history/store';
import {
	forgetSupersededRelease,
	readSupersededReleases,
	recordUpgradeImported
} from '../upgrade/store';
import { renderLibraryPath } from './naming';
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

interface Placement {
	libraryPath: string;
	copied: boolean;
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
		const client = this.#downloads.client();
		if (client === null) return;

		const pending = readPendingImports(this.#db);
		if (pending.length > 0 && !(await this.#importAll(client, pending))) return;
		await this.#removeSuperseded(client);
	}

	async #importAll(client: DownloadClient, pending: PendingImport[]): Promise<boolean> {
		const completed = new Map<string, string>();
		try {
			for (const status of await client.statuses(pending.map((grab) => grab.infohash))) {
				if (status.state === 'completed' && status.contentPath !== null)
					completed.set(status.infohash, status.contentPath);
			}
			this.#downloads.noteSuccess();
		} catch (error) {
			this.#downloads.noteFailure(error);
			return false;
		}

		const template = readNamingTemplate(this.#db);
		for (const grab of pending) {
			const contentPath = completed.get(grab.infohash);
			if (contentPath !== undefined) await this.#import(client, grab, contentPath, template);
		}
		return true;
	}

	/**
	 * The one removal Pacerr performs. Everything else seeds under the Download Client's own rules,
	 * and a Release only reaches here once every Part that held it holds its replacement instead.
	 */
	async #removeSuperseded(client: DownloadClient): Promise<void> {
		for (const infohash of readSupersededReleases(this.#db)) {
			try {
				await client.remove(infohash, true);
				this.#downloads.noteSuccess();
			} catch (error) {
				this.#downloads.noteFailure(error);
				// The record stays, so a daemon that refused is asked again rather than leaving the
				// superseded copy on disk forever.
				return;
			}
			forgetSupersededRelease(this.#db, infohash);
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
				const placed = this.#place(source, template, target);
				recordHadPart(
					this.#db,
					{
						partSlug: target.partSlug,
						libraryPath: placed.libraryPath,
						infohash: grab.infohash
					},
					this.#clock.now()
				);
				// Only once the Library holds the replacement does the superseded Release become
				// Pacerr's to remove; a failed import must leave it exactly where it was.
				if (target.replaces !== null)
					recordUpgradeImported(this.#db, target.partSlug, this.#clock.now());
				entries.push({
					event: target.replaces === null ? 'import' : 'upgrade',
					outcome: placed.copied ? 'warned' : 'succeeded',
					partSlug: target.partSlug,
					partTitle: target.partTitle,
					infohash: grab.infohash,
					releaseTitle: grab.releaseTitle,
					replacedInfohash: target.replaces?.infohash ?? null,
					replacedReleaseTitle: target.replaces?.releaseTitle ?? null,
					detail: placed.libraryPath,
					reason: placed.copied ? copiedInsteadOfLinked : null
				});
			} catch (error) {
				entries.push(failed(grab, target, reasonOf(error)));
			}
		}
		this.#record(entries);
	}

	#place(source: string, template: string, target: ImportTarget): Placement {
		const libraryPath = renderLibraryPath(template, target.naming) + extname(source);
		const destination = join(this.#library, libraryPath);
		mkdirSync(dirname(destination), { recursive: true });
		rmSync(destination, { force: true });
		const copied = linkOrCopy(source, destination);

		// An Upgrade that changed the Resolution renders a different name, so overwriting the
		// destination is not on its own enough to leave one file per Part.
		const replaced = target.replaces?.libraryPath;
		if (replaced !== undefined && replaced !== libraryPath)
			rmSync(join(this.#library, replaced), { force: true });

		return { libraryPath, copied };
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
	event: target.replaces === null ? 'import' : 'upgrade',
	outcome: 'failed',
	partSlug: target.partSlug,
	partTitle: target.partTitle,
	infohash: grab.infohash,
	releaseTitle: grab.releaseTitle,
	replacedInfohash: target.replaces?.infohash ?? null,
	replacedReleaseTitle: target.replaces?.releaseTitle ?? null,
	reason
});

/** True where the filesystem left no choice but to copy. */
function linkOrCopy(source: string, destination: string): boolean {
	try {
		linkSync(source, destination);
		return false;
	} catch (error) {
		if ((error as NodeJS.ErrnoException | null)?.code !== 'EXDEV') throw error;
		copyFileSync(source, destination);
		return true;
	}
}
