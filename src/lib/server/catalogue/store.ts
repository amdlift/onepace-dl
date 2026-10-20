import type { Database } from 'better-sqlite3';
import type {
	Catalogue,
	Coverage,
	Part,
	Resolution,
	UnreleasedPart,
	Variant
} from './watch-page';
import { recordUpstreamUpdate } from '../upstream/store';
import type { Validators } from '../upstream/source';

export interface StoredArc {
	slug: string;
	title: string;
	special: boolean;
	unfinished: boolean;
	partCount: number;
	unreleasedPartCount: number;
	coverImagePath: string | null;
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

/**
 * Replaces the whole Catalogue in one transaction. Only ever reached with a Catalogue that parsed
 * cleanly, so a broken upstream leaves the previous one standing rather than truncating it.
 */
export function replaceCatalogue(
	db: Database,
	catalogue: Catalogue,
	at: Date,
	validators: Validators,
	freshness: string | null
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
		recordUpstreamUpdate(db, 'catalogue', at, validators, freshness);
	})();
}

const flag = (value: boolean): number => (value ? 1 : 0);
const json = (value: unknown): string | null => (value === null ? null : JSON.stringify(value));

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

interface FullArcRow {
	slug: string;
	title: string;
	description: string | null;
	special: number;
	unfinished: number;
	chapters: string | null;
	episodes: string | null;
	cover_image_url: string | null;
}

interface FullPartRow {
	slug: string;
	arc_slug: string;
	number: number;
	title: string;
	description: string | null;
	chapters: string | null;
	episodes: string | null;
	to_be_redone: number;
}

interface CatalogueReleaseRow {
	infohash: string;
	arc_slug: string;
	resolution: number;
	variant: string;
	size_label: string | null;
	batch_complete: number | null;
	batch_part_count: number | null;
	batch_part_range: string | null;
}

/** The Catalogue as `parseCatalogue` produced it, rebuilt from storage. */
export function readCatalogue(db: Database): Catalogue {
	const parts = new Map<string, Part[]>();
	for (const row of db
		.prepare('select * from part order by arc_slug, position')
		.all() as FullPartRow[]) {
		const arcParts = parts.get(row.arc_slug) ?? [];
		arcParts.push({
			slug: row.slug,
			arcSlug: row.arc_slug,
			number: row.number,
			title: row.title,
			description: row.description,
			chapters: parseCoverage(row.chapters),
			episodes: parseCoverage(row.episodes),
			toBeRedone: row.to_be_redone === 1
		});
		parts.set(row.arc_slug, arcParts);
	}

	const unreleased = new Map<string, UnreleasedPart[]>();
	for (const row of db.prepare('select * from unreleased_part order by number').all() as {
		arc_slug: string;
		number: number;
	}[]) {
		const arcUnreleased = unreleased.get(row.arc_slug) ?? [];
		arcUnreleased.push({ arcSlug: row.arc_slug, number: row.number });
		unreleased.set(row.arc_slug, arcUnreleased);
	}

	const partSlugs = new Map<string, string[]>();
	for (const row of db
		.prepare('select * from catalogue_release_part order by part_slug')
		.all() as { infohash: string; part_slug: string }[]) {
		const slugs = partSlugs.get(row.infohash) ?? [];
		slugs.push(row.part_slug);
		partSlugs.set(row.infohash, slugs);
	}

	const arcs = (
		db.prepare('select * from arc order by position').all() as FullArcRow[]
	).map((row) => ({
		slug: row.slug,
		title: row.title,
		description: row.description,
		special: row.special === 1,
		unfinished: row.unfinished === 1,
		chapters: parseCoverage(row.chapters),
		episodes: parseCoverage(row.episodes),
		coverImageUrl: row.cover_image_url,
		parts: parts.get(row.slug) ?? [],
		unreleasedParts: unreleased.get(row.slug) ?? []
	}));

	const releases = (
		db.prepare('select * from catalogue_release').all() as CatalogueReleaseRow[]
	).map((row) => ({
		infohash: row.infohash,
		arcSlug: row.arc_slug,
		partSlugs: partSlugs.get(row.infohash) ?? [],
		resolution: row.resolution as Resolution,
		variant: row.variant as Variant,
		sizeLabel: row.size_label,
		batchScope:
			row.batch_part_count === null
				? null
				: {
						complete: row.batch_complete === 1,
						partCount: row.batch_part_count,
						partRange: row.batch_part_range
					}
	}));

	return { arcs, releases };
}

const parseCoverage = (value: string | null): Coverage | null =>
	value === null ? null : (JSON.parse(value) as Coverage);
