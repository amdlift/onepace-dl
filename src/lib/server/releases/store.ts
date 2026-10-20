import type { Database } from 'better-sqlite3';
import type { BatchRelease } from '../batch/expansion';
import type { Coverage, Resolution, Variant } from '../catalogue/watch-page';
import type { FeedRelease, ReleaseStatus } from './feed';
import { recordUpstreamUpdate } from '../upstream/store';
import type { Validators } from '../upstream/source';

/** A Release as the Arc detail view shows it: feed facts, plus the size only the Catalogue states. */
export interface ReleaseListing {
	infohash: string;
	title: string;
	publishedAt: Date;
	variant: Variant;
	status: ReleaseStatus;
	resolution: Resolution | null;
	sizeLabel: string | null;
}

export interface UnmatchedRelease extends ReleaseListing {
	chapters: Coverage | null;
	episodes: Coverage | null;
}

interface ReleaseRow {
	infohash: string;
	title: string;
	published_at: string;
	variant: string;
	status: string;
	resolution: number | null;
	size_label: string | null;
	part_slug: string;
}

interface BatchRow {
	infohash: string;
	arc_slug: string;
	chapters: string | null;
	episodes: string | null;
}

interface UnmatchedRow extends Omit<ReleaseRow, 'part_slug'> {
	chapters: string | null;
	episodes: string | null;
}

export function readInfohashes(db: Database): Set<string> {
	const rows = db.prepare('select infohash from feed_release').all() as { infohash: string }[];
	return new Set(rows.map((row) => row.infohash));
}

export function readUnknownInfohashes(db: Database): string[] {
	const rows = db
		.prepare(
			`select infohash from feed_release
			where infohash not in (select infohash from catalogue_release)`
		)
		.all() as { infohash: string }[];
	return rows.map((row) => row.infohash);
}

/** Every Release the Catalogue says covers one of these Parts, newest first. Joined on infohash. */
export function readReleasesCovering(
	db: Database,
	partSlugs: string[]
): Map<string, ReleaseListing[]> {
	const covering = new Map<string, ReleaseListing[]>();
	if (partSlugs.length === 0) return covering;

	const rows = db
		.prepare(
			`select r.infohash, r.title, r.published_at, r.variant, r.status, r.resolution,
				c.size_label, p.part_slug
			from catalogue_release_part p
			join catalogue_release c on c.infohash = p.infohash
			join feed_release r on r.infohash = p.infohash
			where p.part_slug in (${partSlugs.map(() => '?').join(', ')})
			order by r.published_at desc, r.infohash`
		)
		.all(...partSlugs) as ReleaseRow[];

	for (const row of rows) {
		const listings = covering.get(row.part_slug) ?? [];
		listings.push(toListing(row));
		covering.set(row.part_slug, listings);
	}
	return covering;
}

export interface UnmatchedCounts {
	total: number;
	current: number;
}

/**
 * All of them are Unmatched Releases by the glossary's definition, but One Pace drops a superseded
 * Release from the watch page while keeping it in the feed forever, so most of them are ordinary
 * delisted history. Only the ones the feed still calls current are a Release Pacerr cannot place.
 */
export function readUnmatchedCounts(db: Database): UnmatchedCounts {
	const row = db
		.prepare(
			`select count(*) as total,
				coalesce(sum(case when status <> 'outdated' then 1 else 0 end), 0) as current
			from feed_release
			where infohash not in (select infohash from catalogue_release)`
		)
		.get() as UnmatchedCounts;
	return row;
}

export function readUnmatchedReleases(db: Database): UnmatchedRelease[] {
	const rows = db
		.prepare(
			`select infohash, title, published_at, variant, status, resolution, null as size_label,
				chapters, episodes
			from feed_release
			where infohash not in (select infohash from catalogue_release)
			order by published_at desc, infohash`
		)
		.all() as UnmatchedRow[];
	return rows.map((row) => ({
		...toListing(row),
		chapters: parseCoverage(row.chapters),
		episodes: parseCoverage(row.episodes)
	}));
}

/**
 * The contract batch expansion consumes. The covered terms come from the feed; the Arc a Batch
 * belongs to comes from the Catalogue, because per ADR-0004 nothing else may identify it.
 */
export function readBatchReleases(db: Database): BatchRelease[] {
	const rows = db
		.prepare(
			`select r.infohash, c.arc_slug, r.chapters, r.episodes
			from feed_release r
			join catalogue_release c on c.infohash = r.infohash
			where c.batch_part_count is not null`
		)
		.all() as BatchRow[];
	return rows.map((row) => ({
		infohash: row.infohash,
		arcSlug: row.arc_slug,
		chapters: parseCoverage(row.chapters),
		episodes: parseCoverage(row.episodes)
	}));
}

/** Replaces every Release in one transaction, only ever with a feed that parsed cleanly. */
export function replaceReleases(
	db: Database,
	releases: FeedRelease[],
	at: Date,
	validators: Validators,
	freshness: string | null
): void {
	const insert = db.prepare(
		`insert into feed_release (infohash, title, published_at, variant, status, resolution,
			chapters, episodes, magnet_uri, torrent_url) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);

	db.transaction(() => {
		db.exec('delete from feed_release');
		for (const release of releases) {
			insert.run(
				release.infohash,
				release.title,
				release.publishedAt.toISOString(),
				release.variant,
				release.status,
				release.resolution,
				json(release.chapters),
				json(release.episodes),
				release.magnetUri,
				release.torrentUrl
			);
		}
		recordUpstreamUpdate(db, 'feed', at, validators, freshness);
	})();
}

function toListing(row: Omit<ReleaseRow, 'part_slug'>): ReleaseListing {
	return {
		infohash: row.infohash,
		title: row.title,
		publishedAt: new Date(row.published_at),
		variant: row.variant as Variant,
		status: row.status as ReleaseStatus,
		resolution: row.resolution as Resolution | null,
		sizeLabel: row.size_label
	};
}

const json = (value: unknown): string | null => (value === null ? null : JSON.stringify(value));
const parseCoverage = (value: string | null): Coverage | null =>
	value === null ? null : (JSON.parse(value) as Coverage);

export interface PublishedRelease {
	title: string;
	publishedAt: Date;
}

/** What the feed says about each Release the Catalogue explains: how Selection names and ranks it. */
export function readPublishedReleases(db: Database): Map<string, PublishedRelease> {
	const rows = db
		.prepare(
			`select r.infohash, r.title, r.published_at
			from feed_release r join catalogue_release c on c.infohash = r.infohash`
		)
		.all() as { infohash: string; title: string; published_at: string }[];
	return new Map(
		rows.map((row) => [row.infohash, { title: row.title, publishedAt: new Date(row.published_at) }])
	);
}
