import type { Database } from 'better-sqlite3';
import type { Catalogue } from './watch-page';
import type { SourceValidators } from './source';

export interface StoredSource extends SourceValidators {
	checkedAt: Date | null;
	updatedAt: Date | null;
	failure: string | null;
}

export interface StoredArc {
	slug: string;
	title: string;
	special: boolean;
	unfinished: boolean;
	partCount: number;
	unreleasedPartCount: number;
	coverImagePath: string | null;
}

interface SourceRow {
	body_sha256: string | null;
	etag: string | null;
	last_modified: string | null;
	checked_at: string | null;
	updated_at: string | null;
	failure: string | null;
}

interface ArcRow {
	slug: string;
	title: string;
	special: number;
	unfinished: number;
	cover_image_url: string | null;
	part_count: number;
	unreleased_part_count: number;
}

export function readSource(db: Database): StoredSource {
	const row = db.prepare('select * from catalogue_source where id = 1').get() as SourceRow;
	return {
		bodySha256: row.body_sha256,
		etag: row.etag,
		lastModified: row.last_modified,
		checkedAt: parseTime(row.checked_at),
		updatedAt: parseTime(row.updated_at),
		failure: row.failure
	};
}

export function readArcs(db: Database): StoredArc[] {
	const rows = db
		.prepare(
			`select arc.slug, arc.title, arc.special, arc.unfinished, arc.cover_image_url,
				(select count(*) from part where part.arc_slug = arc.slug) as part_count,
				(select count(*) from unreleased_part where unreleased_part.arc_slug = arc.slug)
					as unreleased_part_count
			from arc order by arc.position`
		)
		.all() as ArcRow[];
	return rows.map((row) => ({
		slug: row.slug,
		title: row.title,
		special: row.special === 1,
		unfinished: row.unfinished === 1,
		partCount: row.part_count,
		unreleasedPartCount: row.unreleased_part_count,
		coverImagePath: row.cover_image_url
	}));
}

export function recordCheck(db: Database, at: Date, validators: SourceValidators): void {
	db.prepare(
		`update catalogue_source
		set checked_at = ?, failure = null, body_sha256 = ?, etag = ?, last_modified = ?
		where id = 1`
	).run(at.toISOString(), validators.bodySha256, validators.etag, validators.lastModified);
}

export function recordFailure(db: Database, at: Date, failure: string): void {
	db.prepare('update catalogue_source set checked_at = ?, failure = ? where id = 1').run(
		at.toISOString(),
		failure
	);
}

/**
 * Replaces the whole Catalogue in one transaction. Only ever reached with a Catalogue that parsed
 * cleanly, so a broken upstream leaves the previous one standing rather than truncating it.
 */
export function replaceCatalogue(
	db: Database,
	catalogue: Catalogue,
	at: Date,
	validators: SourceValidators
): void {
	const insertArc = db.prepare(
		`insert into arc (slug, position, title, description, special, unfinished, chapters, episodes,
			cover_image_url) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const insertPart = db.prepare(
		`insert into part (slug, arc_slug, position, number, title, description, chapters, episodes,
			to_be_redone) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const insertUnreleased = db.prepare(
		'insert into unreleased_part (arc_slug, number) values (?, ?)'
	);
	const insertRelease = db.prepare(
		`insert into catalogue_release (infohash, arc_slug, resolution, variant, size_label,
			batch_complete, batch_part_count, batch_part_range) values (?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const insertReleasePart = db.prepare(
		'insert into catalogue_release_part (infohash, part_slug) values (?, ?)'
	);

	db.transaction(() => {
		db.exec(
			`delete from catalogue_release_part;
			delete from catalogue_release;
			delete from unreleased_part;
			delete from part;
			delete from arc;`
		);
		for (const [position, arc] of catalogue.arcs.entries()) {
			insertArc.run(
				arc.slug,
				position,
				arc.title,
				arc.description,
				flag(arc.special),
				flag(arc.unfinished),
				json(arc.chapters),
				json(arc.episodes),
				arc.coverImageUrl
			);
			for (const [partPosition, part] of arc.parts.entries()) {
				insertPart.run(
					part.slug,
					arc.slug,
					partPosition,
					part.number,
					part.title,
					part.description,
					json(part.chapters),
					json(part.episodes),
					flag(part.toBeRedone)
				);
			}
			for (const unreleased of arc.unreleasedParts) {
				insertUnreleased.run(arc.slug, unreleased.number);
			}
		}
		for (const release of catalogue.releases) {
			insertRelease.run(
				release.infohash,
				release.arcSlug,
				release.resolution,
				release.variant,
				release.sizeLabel,
				release.batchScope === null ? null : flag(release.batchScope.complete),
				release.batchScope?.partCount ?? null,
				release.batchScope?.partRange ?? null
			);
			for (const partSlug of release.partSlugs) insertReleasePart.run(release.infohash, partSlug);
		}
		recordCheck(db, at, validators);
		db.prepare('update catalogue_source set updated_at = ? where id = 1').run(at.toISOString());
	})();
}

const flag = (value: boolean): number => (value ? 1 : 0);
const json = (value: unknown): string | null => (value === null ? null : JSON.stringify(value));
const parseTime = (value: string | null): Date | null => (value === null ? null : new Date(value));

export interface StoredPart {
	slug: string;
	number: number;
	title: string;
}

export interface StoredArcDetail extends StoredArc {
	parts: StoredPart[];
	unreleasedPartNumbers: number[];
}

interface PartRow {
	slug: string;
	number: number;
	title: string;
}

export function readArcDetail(db: Database, slug: string): StoredArcDetail | null {
	const arc = readArcs(db).find((candidate) => candidate.slug === slug);
	if (arc === undefined) return null;

	const parts = db
		.prepare('select slug, number, title from part where arc_slug = ? order by position')
		.all(slug) as PartRow[];
	const unreleased = db
		.prepare('select number from unreleased_part where arc_slug = ? order by number')
		.all(slug) as { number: number }[];

	return {
		...arc,
		parts: parts.map((row) => ({
			slug: row.slug,
			number: row.number,
			title: row.title
		})),
		unreleasedPartNumbers: unreleased.map((row) => row.number)
	};
}
