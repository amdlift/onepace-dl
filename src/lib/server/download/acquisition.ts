import type { Database } from 'better-sqlite3';
import type { Clock } from '../clock';
import { recordHistory, type HistoryEntry } from '../history/store';
import { select, type SelectedRelease } from '../selection/selection';
import { readDueUpgrades, recordUpgrades } from '../upgrade/store';
import type { DownloadClient, DownloadSource } from './client';
import { DownloadService, reasonOf } from './service';
import {
	linkGrabToPart,
	readGrabbedInfohashes,
	readReleaseSources,
	readWantedPartTitles,
	recordGrab
} from './store';

interface TargetPart {
	slug: string;
	title: string;
}

interface PendingGrab {
	release: SelectedRelease;
	source: DownloadSource;
	/** The Parts this Release is being grabbed for, in Catalogue order. */
	forParts: TargetPart[];
}

/**
 * Hands every monitored Part's selected Release to the Download Client, once each. Runs after
 * anything that could change the answer: a scrape, a poll, a Profile or a Monitoring change.
 */
export class AcquisitionService {
	#db: Database;
	#clock: Clock;
	#downloads: DownloadService;

	constructor(db: Database, clock: Clock, downloads: DownloadService) {
		this.#db = db;
		this.#clock = clock;
		this.#downloads = downloads;
	}

	async run(): Promise<void> {
		const pending = this.#pending();
		if (pending.length === 0) return;

		const client = this.#downloads.client();
		if (client === null) return;

		for (const grab of pending) {
			try {
				await this.#grab(client, grab);
				this.#downloads.noteSuccess();
			} catch (error) {
				this.#record([
					{
						event: 'grab',
						outcome: 'failed',
						infohash: grab.release.infohash,
						releaseTitle: grab.release.title,
						reason: reasonOf(error)
					}
				]);
				this.#downloads.noteFailure(error);
				// A daemon that refused one Release will refuse the next twenty the same way, and
				// History should say so once rather than once per Release.
				return;
			}
		}
	}

	async #grab(client: DownloadClient, grab: PendingGrab): Promise<void> {
		const { release, forParts } = grab;
		await client.add({ infohash: release.infohash, ...grab.source });

		const entries: HistoryEntry[] = forParts.map((part) => ({
			event: 'grab',
			outcome: 'succeeded',
			partSlug: part.slug,
			partTitle: part.title,
			infohash: release.infohash,
			releaseTitle: release.title
		}));

		const needed = new Set(forParts.map((part) => part.slug));
		if (release.coveredParts.some((part) => !needed.has(part)))
			entries.push(...(await this.#deselect(client, release, needed)));

		recordGrab(
			this.#db,
			{
				infohash: release.infohash,
				releaseTitle: release.title,
				batch: release.batch,
				partSlugs: forParts.map((part) => part.slug)
			},
			this.#clock.now()
		);
		this.#record(entries);
	}

	/**
	 * A Batch wanted for only some of its Parts downloads only those files. The torrent carries no
	 * names Pacerr may trust — ADR-0004 — so a Part is found by its position among the covered
	 * Parts, which only holds while the Download Client reports exactly as many files as the Batch
	 * covers. When it does not, Pacerr says so and takes the whole Batch: wasting bandwidth is
	 * recoverable, skipping a file Pacerr needed is a permanent gap.
	 */
	async #deselect(
		client: DownloadClient,
		release: SelectedRelease,
		needed: Set<string>
	): Promise<HistoryEntry[]> {
		const files = await client.files(release.infohash);
		if (files.length !== release.coveredParts.length)
			return [
				{
					event: 'grab',
					outcome: 'warned',
					infohash: release.infohash,
					releaseTitle: release.title,
					reason:
						`The Download Client reports ${files.length} files for a Batch covering ` +
						`${release.coveredParts.length} Parts, so Pacerr took all of them rather than ` +
						`risk leaving out one it needs.`
				}
			];

		await client.setFilePriority(
			release.infohash,
			release.coveredParts.flatMap((part, position) => (needed.has(part) ? [] : [position])),
			'skip'
		);
		return [];
	}

	#pending(): PendingGrab[] {
		const selection = select(this.#db);
		const wanted = readWantedPartTitles(this.#db);
		const grabbed = readGrabbedInfohashes(this.#db);

		// A Part due an Upgrade is already had, so it is not wanted; it still needs grabbing.
		const upgrades = readDueUpgrades(this.#db, selection);
		recordUpgrades(this.#db, upgrades);
		for (const upgrade of upgrades) {
			wanted.set(upgrade.partSlug, upgrade.partTitle);
			// The replacement may already be downloading for another Part of the Arc, in which case
			// nothing below grabs it again and only this Part's claim on it is missing.
			if (grabbed.has(upgrade.replacementInfohash))
				linkGrabToPart(this.#db, upgrade.replacementInfohash, upgrade.partSlug);
		}
		if (wanted.size === 0) return [];

		const sources = readReleaseSources(this.#db);

		const pending = new Map<string, PendingGrab>();
		for (const [slug, title] of wanted) {
			const chosen = selection.parts.get(slug);
			if (chosen === undefined || !chosen.chosen) continue;
			if (grabbed.has(chosen.release.infohash)) continue;

			const source = sources.get(chosen.release.infohash);
			if (source === undefined) continue;

			const existing = pending.get(chosen.release.infohash);
			if (existing === undefined)
				pending.set(chosen.release.infohash, {
					release: chosen.release,
					source,
					forParts: [{ slug, title }]
				});
			else existing.forParts.push({ slug, title });
		}

		for (const grab of pending.values())
			grab.forParts.sort(
				(left, right) =>
					grab.release.coveredParts.indexOf(left.slug) -
					grab.release.coveredParts.indexOf(right.slug)
			);
		return [...pending.values()];
	}

	#record(entries: HistoryEntry[]): void {
		recordHistory(this.#db, this.#clock.now(), entries);
	}
}
