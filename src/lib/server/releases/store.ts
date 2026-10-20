import type { Database } from 'better-sqlite3';
import type { BatchRelease } from '../batch/expansion';
import type { Coverage, Resolution, Variant } from '../catalogue/watch-page';
import type { FeedRelease, ReleaseStatus } from './feed';
import type { FeedValidators } from './source';

export interface StoredFeed extends FeedValidators {
	lastBuildDate: Date | null;
	checkedAt: Date | null;
	updatedAt: Date | null;
	failure: string | null;
}

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

interface FeedRow {
	last_build_date: string | null;
	etag: string | null;
	last_modified: string | null;
	checked_at: string | null;
	updated_at: string | null;
	failure: string | null;
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

export function readFeedSource(db: Database): StoredFeed {
	const row = db.prepare('select * from feed_source where id = 1').get() as FeedRow;
	return {
		lastBuildDate: parseTime(row.last_build_date),
		etag: row.etag,
		lastModified: row.last_modified,
		checkedAt: parseTime(row.checked_at),
		updatedAt: parseTime(row.updated_at),
		failure: row.failure
	};
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

export function recordFeedCheck(
	db: Database,
	at: Date,
	validators: FeedValidators,
	lastBuildDate: Date | null
): void {
	db.prepare(
		`update feed_source
		set checked_at = ?, failure = null, etag = ?, last_modified = ?, last_build_date = ?
		where id = 1`
	).run(
		at.toISOString(),
		validators.etag,
		validators.lastModified,
		lastBuildDate === null ? null : lastBuildDate.toISOString()
	);
}

export function recordFeedFailure(db: Database, at: Date, failure: string): void {
	db.prepare('update feed_source set checked_at = ?, failure = ? where id = 1').run(
		at.toISOString(),
		failure
	);
}

/** Replaces every Release in one transaction, only ever with a feed that parsed cleanly. */
export function replaceReleases(
	db: Database,
	releases: FeedRelease[],
	at: Date,
	validators: FeedValidators,
	lastBuildDate: Date | null
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
		recordFeedCheck(db, at, validators, lastBuildDate);
		db.prepare('update feed_source set updated_at = ? where id = 1').run(at.toISOString());
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
const parseTime = (value: string | null): Date | null => (value === null ? null : new Date(value));

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
