import type { Database } from 'better-sqlite3';
import type { Resolution } from '../catalogue/watch-page';
import { defaultNamingTemplate, type NamingFields } from './naming';

/**
 * A Part is had when Pacerr holds a file for it in the Library. Only Import writes here, so until
 * there is an importer every count this answers is legitimately zero.
 */
export function readHadPartCountsByArc(db: Database): Map<string, number> {
	const rows = db
		.prepare(
			`select part.arc_slug, count(*) as had
			from had_part join part on part.slug = had_part.part_slug
			group by part.arc_slug`
		)
		.all() as { arc_slug: string; had: number }[];
	return new Map(rows.map((row) => [row.arc_slug, row.had]));
}

/** The file Pacerr holds for a Part, and what the Release that satisfied it was. */
export interface HadPart {
	partSlug: string;
	/** Relative to the Library root, which is a mount point and may be remounted elsewhere. */
	libraryPath: string;
	infohash: string | null;
	releaseTitle: string | null;
	resolution: Resolution | null;
	hadAt: Date;
}

interface HadRow {
	part_slug: string;
	library_path: string;
	infohash: string | null;
	release_title: string | null;
	resolution: number | null;
	had_at: string;
}

export function readHadParts(db: Database): Map<string, HadPart> {
	const rows = db
		.prepare(
			`select h.part_slug, h.library_path, h.infohash, h.had_at,
				r.title as release_title, coalesce(c.resolution, r.resolution) as resolution
			from had_part h
			left join feed_release r on r.infohash = h.infohash
			left join catalogue_release c on c.infohash = h.infohash`
		)
		.all() as HadRow[];
	return new Map(
		rows.map((row) => [
			row.part_slug,
			{
				partSlug: row.part_slug,
				libraryPath: row.library_path,
				infohash: row.infohash,
				releaseTitle: row.release_title,
				resolution: row.resolution as Resolution | null,
				hadAt: new Date(row.had_at)
			}
		])
	);
}

export function recordHadPart(
	db: Database,
	had: { partSlug: string; libraryPath: string; infohash: string | null },
	at: Date
): void {
	db.prepare(
		`insert or replace into had_part (part_slug, library_path, infohash, had_at)
		values (?, ?, ?, ?)`
	).run(had.partSlug, had.libraryPath, had.infohash, at.toISOString());
}

/**
 * Fixes where each Arc, and each Part sharing an index with another Arc, sits in the Library the
 * first time Pacerr sees it, and never moves it again. Recomputing from Catalogue position would
 * let an entry inserted upstream renumber every entry after it, and with them every file already
 * in the Library.
 */
export function assignLibraryIndexes(db: Database): void {
	db.transaction(() => {
		placeArcs(db);
		placeSharedParts(db);
	})();
}

function placeArcs(db: Database): void {
	const unplaced = db
		.prepare(
			`select slug, special from arc
			where slug not in (select arc_slug from arc_library_index)
			order by position`
		)
		.all() as { slug: string; special: number }[];
	if (unplaced.length === 0) return;

	const highest = (
		db.prepare('select max(library_index) as highest from arc_library_index').get() as {
			highest: number | null;
		}
	).highest;
	const insert = db.prepare(
		'insert into arc_library_index (arc_slug, library_index) values (?, ?)'
	);

	let next = (highest ?? 0) + 1;
	// Specials and one-off entries all share index zero, which is where a media server expects
	// anything outside the numbered run.
	for (const arc of unplaced) insert.run(arc.slug, arc.special === 1 ? 0 : next++);
}

/**
 * Index zero is shared, so the Parts filed under it cannot take their place from their Arc the way
 * every other Part does: two one-Part specials would both be the first thing in it, and a media
 * server reading `S00E01` twice shows one of them and hides the other.
 */
function placeSharedParts(db: Database): void {
	const unplaced = db
		.prepare(
			`select part.slug from part
			join arc_library_index i on i.arc_slug = part.arc_slug
			join arc on arc.slug = part.arc_slug
			where i.library_index = 0 and part.slug not in (select part_slug from part_library_index)
			order by arc.position, part.position`
		)
		.all() as { slug: string }[];
	if (unplaced.length === 0) return;

	const highest = (
		db.prepare('select max(library_index) as highest from part_library_index').get() as {
			highest: number | null;
		}
	).highest;
	const insert = db.prepare(
		'insert into part_library_index (part_slug, library_index) values (?, ?)'
	);

	let next = (highest ?? 0) + 1;
	for (const part of unplaced) insert.run(part.slug, next++);
}

export function readNamingTemplate(db: Database): string {
	const row = db.prepare('select template from naming_template where id = 1').get() as {
		template: string | null;
	};
	return row.template ?? defaultNamingTemplate;
}

export function writeNamingTemplate(db: Database, template: string): void {
	const trimmed = template.trim();
	db.prepare('update naming_template set template = ? where id = 1').run(
		trimmed === '' ? null : trimmed
	);
}

/** One Part a completed download owes the Library, and everything its name is rendered from. */
export interface ImportTarget {
	partSlug: string;
	partTitle: string;
	had: boolean;
	naming: NamingFields;
}

export interface PendingImport {
	infohash: string;
	releaseTitle: string;
	/**
	 * Every Part the Release was grabbed for, in Catalogue order. A Part is found by its position
	 * among them, because per ADR-0004 the names inside the torrent are not Pacerr's to read.
	 */
	targets: ImportTarget[];
}

interface PendingRow {
	infohash: string;
	release_title: string;
	part_slug: string;
	part_title: string;
	part_number: number;
	arc_title: string;
	arc_part_count: number;
	library_index: number;
	part_library_index: number | null;
	resolution: number | null;
	had: number;
}

export function readPendingImports(db: Database): PendingImport[] {
	const rows = db
		.prepare(
			`select g.infohash, g.release_title, gp.part_slug,
				part.title as part_title, part.number as part_number,
				arc.title as arc_title, i.library_index, pi.library_index as part_library_index,
				(select count(*) from part sibling where sibling.arc_slug = arc.slug) as arc_part_count,
				coalesce(c.resolution, r.resolution) as resolution,
				exists(select 1 from had_part where had_part.part_slug = gp.part_slug) as had
			from grab g
			join grab_part gp on gp.infohash = g.infohash
			join part on part.slug = gp.part_slug
			join arc on arc.slug = part.arc_slug
			join arc_library_index i on i.arc_slug = arc.slug
			left join part_library_index pi on pi.part_slug = part.slug
			left join catalogue_release c on c.infohash = g.infohash
			left join feed_release r on r.infohash = g.infohash
			order by g.grabbed_at, g.infohash, part.position`
		)
		.all() as PendingRow[];

	const pending = new Map<string, PendingImport>();
	for (const row of rows) {
		const target: ImportTarget = {
			partSlug: row.part_slug,
			partTitle: row.part_title,
			had: row.had === 1,
			naming: {
				arcTitle: row.arc_title,
				arcLibraryIndex: row.library_index,
				partTitle: row.part_title,
				// An Arc of one Part has nothing to number, and a media server will not show an
				// episode zero where the Arc itself is the episode.
				partLibraryIndex:
					row.part_library_index ?? (row.arc_part_count === 1 ? 1 : row.part_number),
				resolution: row.resolution as Resolution | null
			}
		};
		const existing = pending.get(row.infohash);
		if (existing === undefined)
			pending.set(row.infohash, {
				infohash: row.infohash,
				releaseTitle: row.release_title,
				targets: [target]
			});
		else existing.targets.push(target);
	}

	return [...pending.values()].filter((grab) => grab.targets.some((target) => !target.had));
}
