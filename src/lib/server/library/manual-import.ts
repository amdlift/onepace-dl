import { readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { Posters } from '../artwork';
import type { Clock } from '../clock';
import { reasonOf } from '../failure';
import { recordHistory, type HistoryEntry } from '../history/store';
import { hidesNothing, permit, type BrowsePolicy } from '../paths/browse';
import { copiedInsteadOfLinked, placeIntoLibrary, type Placing } from './import';
import type { NamingFields } from './naming';
import {
	writeEpisodeSidecar,
	writeSeasonPoster,
	writeSeasonSidecar,
	writeShowSidecar
} from './sidecars';
import { partLibraryIndex, readNamingTemplate, recordHadPart } from './store';

const videoExtensions = new Set([
	'.mkv',
	'.mp4',
	'.avi',
	'.m4v',
	'.mov',
	'.mpg',
	'.mpeg',
	'.ts',
	'.webm',
	'.wmv'
]);

/**
 * Every video file the policy reaches, however deep, named relative to its root. A relative name is
 * the only form the rest of Manual Import accepts, so nothing it lists can later be read as a path
 * elsewhere.
 */
export function importableFiles(policy: BrowsePolicy): string[] {
	const found: string[] = [];
	walk(policy, policy.root, found);
	return found.sort((left, right) => left.localeCompare(right));
}

function walk(policy: BrowsePolicy, directory: string, found: string[]): void {
	let entries: string[];
	try {
		entries = readdirSync(directory);
	} catch {
		return;
	}
	for (const entry of entries) {
		const path = join(directory, entry);
		// A symlink out of the root would widen what Manual Import can read past what was
		// configured, so the walk only descends into what the policy would let an import read.
		if (permit(policy, path) === null) continue;
		const stats = statSync(path, { throwIfNoEntry: false });
		if (stats === undefined) continue;
		if (stats.isDirectory()) walk(policy, path, found);
		else if (videoExtensions.has(extname(entry).toLowerCase()))
			found.push(relative(policy.root, path));
	}
}

/** A Part the user can file a video file against, as the Manual Import view offers it. */
export interface SelectablePart {
	slug: string;
	arcSlug: string;
	arcTitle: string;
	number: number;
	title: string;
}

interface SelectableRow {
	slug: string;
	arc_slug: string;
	arc_title: string;
	number: number;
	title: string;
}

export function readSelectableParts(db: Database): SelectablePart[] {
	const rows = db
		.prepare(
			`select part.slug, part.arc_slug, arc.title as arc_title, part.number, part.title
			from part join arc on arc.slug = part.arc_slug
			order by arc.position, part.position`
		)
		.all() as SelectableRow[];
	return rows.map((row) => ({
		slug: row.slug,
		arcSlug: row.arc_slug,
		arcTitle: row.arc_title,
		number: row.number,
		title: row.title
	}));
}

/**
 * The Part a filename names, or null where Pacerr is not sure.
 *
 * ADR-0004 forbids deriving identity from a filename everywhere except here, and permits it here
 * only because the answer is pre-filled for a human to confirm or override. That exception holds
 * exactly as long as "not sure" stays a real answer: anything short of an Arc title followed by a
 * Part number the Catalogue actually lists returns null, which the view renders as a blank field.
 * A blank asks the user to choose; a confident-looking wrong guess gets accepted.
 */
export function suggestPart(fileName: string, parts: SelectablePart[]): string | null {
	const spelled = spell(basename(fileName, extname(fileName)));

	let arcSlug: string | null = null;
	let arcAt = -1;
	let arcLength = 0;
	for (const arc of new Map(parts.map((part) => [part.arcSlug, part])).values()) {
		const spelledArc = spell(arc.arcTitle).trim();
		const at = spelledArc === '' ? -1 : spelled.lastIndexOf(` ${spelledArc} `);
		if (at === -1 || spelledArc.length < arcLength) continue;
		// Two Arcs whose titles both fit leave Pacerr unable to say which, unless one of them is
		// the longer: "Post-Enies Lobby 02" names Post-Enies Lobby, not Enies Lobby.
		if (spelledArc.length === arcLength) arcSlug = null;
		else {
			arcSlug = arc.arcSlug;
			arcAt = at + spelledArc.length + 1;
			arcLength = spelledArc.length;
		}
	}
	if (arcSlug === null) return null;

	const withinArc = parts.filter((part) => part.arcSlug === arcSlug);
	const numbered = /^ (\d{1,3})\b/.exec(spelled.slice(arcAt));
	if (numbered === null) return withinArc.length === 1 ? (withinArc[0]?.slug ?? null) : null;
	return withinArc.find((part) => part.number === Number(numbered[1]))?.slug ?? null;
}

// Punctuation is where the two naming systems disagree hardest, so comparison happens with none of
// it: ` romance dawn 01 1080p `, bounded by spaces so a title only matches on whole words.
const spell = (value: string): string =>
	` ${value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()} `;

/** One file the user confirmed, and the Part they confirmed it against. */
export interface ConfirmedImport {
	/** Relative to the browsed root. An absolute or escaping path is refused, not resolved. */
	path: string;
	partSlug: string;
}

interface NamingRow {
	slug: string;
	part_title: string;
	part_number: number;
	arc_slug: string;
	arc_title: string;
	library_index: number;
	part_library_index: number | null;
	arc_part_count: number;
}

interface NamingTarget {
	arcSlug: string;
	partSlug: string;
	partTitle: string;
	naming: NamingFields;
}

function readNamingFields(db: Database, slugs: string[]): Map<string, NamingTarget> {
	if (slugs.length === 0) return new Map();
	const rows = db
		.prepare(
			`select part.slug, part.title as part_title, part.number as part_number,
				arc.slug as arc_slug, arc.title as arc_title,
				i.library_index, pi.library_index as part_library_index,
				(select count(*) from part sibling where sibling.arc_slug = arc.slug) as arc_part_count
			from part
			join arc on arc.slug = part.arc_slug
			join arc_library_index i on i.arc_slug = arc.slug
			left join part_library_index pi on pi.part_slug = part.slug
			where part.slug in (${slugs.map(() => '?').join(', ')})`
		)
		.all(...slugs) as NamingRow[];
	return new Map(
		rows.map((row) => [
			row.slug,
			{
				arcSlug: row.arc_slug,
				partSlug: row.slug,
				partTitle: row.part_title,
				naming: {
					arcTitle: row.arc_title,
					arcLibraryIndex: row.library_index,
					partTitle: row.part_title,
					partLibraryIndex: partLibraryIndex({
						assigned: row.part_library_index,
						number: row.part_number,
						arcPartCount: row.arc_part_count
					}),
					// Pacerr holds no Release for a manually imported Part, so it does not know the
					// Resolution either, and the template renders what it was given.
					resolution: null
				}
			}
		])
	);
}

/**
 * Files what the user confirmed, through the same importer and the same naming a download gets.
 *
 * Nothing here runs on a schedule: a Manual Import happens because a person pressed a button on a
 * page they were reading, which is the whole basis of ADR-0004's exception for this path.
 */
export function manualImport(
	db: Database,
	clock: Clock,
	posters: Posters,
	library: string,
	policy: BrowsePolicy | null,
	confirmed: ConfirmedImport[],
	placing: Placing
): void {
	if (confirmed.length === 0) return;

	const template = readNamingTemplate(db);
	const targets = readNamingFields(
		db,
		confirmed.map((one) => one.partSlug)
	);
	const entries: HistoryEntry[] = [];

	for (const one of confirmed) {
		const target = targets.get(one.partSlug);
		if (target === undefined) continue;
		const source = policy === null ? null : permit(policy, one.path);
		if (source === null) {
			entries.push({
				event: 'manualImport',
				outcome: 'failed',
				partSlug: target.partSlug,
				partTitle: target.partTitle,
				detail: one.path,
				reason: outsideWhatPacerrReads
			});
			continue;
		}

		try {
			const placed = placeIntoLibrary(library, source, template, target.naming, placing);
			writeShowSidecar(library);
			writeSeasonSidecar(db, library, target.arcSlug, placed.libraryPath);
			writeSeasonPoster(posters, library, placed.libraryPath, target.arcSlug);
			writeEpisodeSidecar(db, library, target.partSlug, placed.libraryPath);
			// No infohash: Pacerr did not download this file and has no Release to attribute it to,
			// so it records having the Part and claims nothing further about it.
			recordHadPart(
				db,
				{ partSlug: target.partSlug, libraryPath: placed.libraryPath, infohash: null },
				clock.now()
			);
			entries.push({
				event: 'manualImport',
				outcome: placed.copied ? 'warned' : 'succeeded',
				partSlug: target.partSlug,
				partTitle: target.partTitle,
				detail: placed.libraryPath,
				reason: placed.copied ? copiedInsteadOfLinked.fromImportSource : null
			});
		} catch (error) {
			entries.push({
				event: 'manualImport',
				outcome: 'failed',
				partSlug: target.partSlug,
				partTitle: target.partTitle,
				detail: one.path,
				reason: reasonOf(error)
			});
		}
	}

	if (entries.length > 0) recordHistory(db, clock.now(), entries);
}

const outsideWhatPacerrReads =
	'Pacerr refused to read that path, because it is not inside the directory being browsed. ' +
	'Manual Import reads the Import Source and the Library and nothing else.';

export function readImportSource(db: Database): string | null {
	const row = db.prepare('select path from import_source where id = 1').get() as {
		path: string | null;
	};
	return row.path;
}

/**
 * The two directories Manual Import will read: the one the user configured as the Import Source,
 * and the Library, so a file already filed can be reorganised. Everything else on the filesystem
 * is out of reach, whatever a request asks for.
 */
export type BrowsableRoot = 'source' | 'library';

export const browsableRoot = (requested: unknown): BrowsableRoot =>
	requested === 'library' ? 'library' : 'source';

export function importPolicy(
	db: Database,
	library: string,
	root: BrowsableRoot
): BrowsePolicy | null {
	const directory = root === 'library' ? library : readImportSource(db);
	// Nothing is hidden within either root: the Import Source is the user's own directory, and the
	// Library is what Pacerr itself writes.
	return directory === null
		? null
		: { root: directory, hidden: hidesNothing, refusal: outsideWhatPacerrReads };
}

export function writeImportSource(db: Database, path: string): void {
	const trimmed = path.trim();
	db.prepare('update import_source set path = ? where id = 1').run(
		trimmed === '' ? null : resolve(trimmed)
	);
}
