import {
	copyFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
	rmdirSync,
	statSync,
	unlinkSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { Background, Pause } from '../background';
import type { Clock } from '../clock';
import { reasonOf } from '../failure';
import type { ConfigureOutcome, PathService } from '../paths/service';
import { crossesFilesystems } from './import';
import { sharedSidecarPaths, sidecarPathFor } from './sidecars';

const stoppedMidMove = 'Pacerr stopped while it was moving the Library.';

export type LibraryMoveState = 'planned' | 'moving' | 'done' | 'failed' | 'dismissed';

/**
 * One directory some of the Library is still under. A move that stopped partway leaves Parts
 * behind, and a second move started before the first was finished leaves them behind in more than
 * one place, so what a plan names as its source is a list rather than the path Settings last held.
 */
export interface StrandedRoot {
	path: string;
	parts: number;
	bytes: number;
	/** Every file still under it, named so a move that stopped says what to go and fix. */
	files: string[];
}

/** What a move of the Library would do, is doing, or did. */
export interface LibraryMove {
	destination: string;
	parts: number;
	sameFilesystem: boolean;
	state: LibraryMoveState;
	reason: string | null;
	moved: number;
	sources: StrandedRoot[];
}

interface MoveRow {
	id: number;
	destination: string;
	parts: number;
	same_filesystem: number;
	state: string;
	reason: string | null;
}

interface StrandedRow {
	part_slug: string;
	library_path: string;
	library_root: string;
}

/**
 * Moves the Library when Settings points it somewhere else. Plans first and waits to be told to
 * go, because the plan is where a wrong path is caught while it is still free to catch.
 */
export class LibraryMoveService {
	#db: Database;
	#clock: Clock;
	#paths: PathService;
	#background: Background;

	constructor(db: Database, clock: Clock, paths: PathService, background: Background) {
		this.#db = db;
		this.#clock = clock;
		this.#paths = paths;
		this.#background = background;
	}

	/** Points the Library at `wanted` and plans the move of whatever the old one still holds. */
	relocate(wanted: string): ConfigureOutcome {
		if (this.#latest()?.state === 'moving') {
			return {
				ok: false,
				problem: 'Pacerr is moving the Library, so it cannot be pointed somewhere else yet.'
			};
		}
		const from = this.#paths.library().path;
		let outcome: ConfigureOutcome = { ok: true, problem: null };
		this.#db.transaction(() => {
			outcome = this.#paths.configure('library', wanted);
			if (!outcome.ok) return;
			this.#plan(from, this.#paths.library().path);
		})();
		return outcome;
	}

	current(): LibraryMove | null {
		const row = this.#latest();
		if (row === undefined) return null;
		const stranded = strandedParts(this.#db);
		return {
			destination: row.destination,
			parts: row.parts,
			sameFilesystem: row.same_filesystem === 1,
			state: row.state as LibraryMoveState,
			reason: row.reason,
			moved: row.parts - stranded.length,
			sources: rootsOf(stranded)
		};
	}

	/**
	 * Runs the move and returns at once; it carries on in the background. A move that stopped
	 * partway starts again here rather than being planned afresh, so it takes up the files still
	 * at the old Library and leaves the ones already moved alone.
	 */
	start(): void {
		const row = this.#latest();
		if (row === undefined || !canRun(row.state)) return;
		this.#db
			.prepare(
				`update library_move set state = 'moving', reason = null, finished_at = null
				where id = ?`
			)
			.run(row.id);
		this.#background.run('Library move', (pause) => this.#move(row.id, pause));
	}

	/**
	 * A move cannot outlive the process running it, so one still recorded as under way at boot
	 * stopped when that process did, and says so rather than appearing to still be going.
	 */
	recordInterruption(): void {
		this.#db
			.prepare(
				`update library_move set state = 'failed', reason = ?, finished_at = ?
				where state = 'moving'`
			)
			.run(stoppedMidMove, this.#clock.now().toISOString());
	}

	/**
	 * Gives up on the move. Where every Part Pacerr holds turns out to be under one directory —
	 * which is any move nothing has been moved by yet — the Library follows them there, so leaving
	 * them alone leaves Settings naming the directory they are in rather than pinning them to a
	 * root only a move plan would ever mention again. A move that got partway cannot be settled
	 * that way, and goes on saying where the files it left behind are.
	 */
	dismiss(): void {
		this.#db.transaction(() => {
			this.#supersede();
			this.#settle();
		})();
	}

	#supersede(): void {
		this.#db
			.prepare(
				`update library_move set state = 'dismissed', finished_at = ?
				where state in ('planned', 'moving', 'done', 'failed')`
			)
			.run(this.#clock.now().toISOString());
	}

	#settle(): void {
		const root = soleRoot(this.#db);
		if (root === null) return;
		this.#paths.configure('library', root);
		this.#db.prepare('update had_part set library_root = null').run();
	}

	async #move(id: number, pause: Pause): Promise<void> {
		const library = this.#paths.library().path;
		for (const part of strandedParts(this.#db)) {
			if (!(await pause())) return;
			try {
				land(this.#db, part, library);
			} catch (error) {
				this.#finish(id, 'failed', reasonOf(error));
				return;
			}
		}
		this.#finish(id, 'done', null);
	}

	#finish(id: number, state: LibraryMoveState, reason: string | null): void {
		this.#db
			.prepare('update library_move set state = ?, reason = ?, finished_at = ? where id = ?')
			.run(state, reason, this.#clock.now().toISOString(), id);
	}

	#latest(): MoveRow | undefined {
		return this.#db
			.prepare(
				`select id, destination, parts, same_filesystem, state, reason
				from library_move order by id desc limit 1`
			)
			.get() as MoveRow | undefined;
	}

	#plan(from: string, to: string): void {
		if (to === from) return;
		pinTo(this.#db, from);
		const sources = rootsOf(strandedParts(this.#db));
		if (sources.length === 0) return;
		this.#supersede();
		this.#db
			.prepare(
				`insert into library_move
					(destination, parts, same_filesystem, state, planned_at)
				values (?, ?, ?, 'planned', ?)`
			)
			.run(
				to,
				sources.reduce((total, source) => total + source.parts, 0),
				sources.every((source) => shareAFilesystem(source.path, to)) ? 1 : 0,
				this.#clock.now().toISOString()
			);
	}
}

const canRun = (state: string): boolean => state !== 'moving' && state !== 'done';

/**
 * The one directory every Part Pacerr holds sits under, when that is somewhere other than the
 * Library. Null where they are split across roots, because no single setting describes that.
 */
function soleRoot(db: Database): string | null {
	const roots = db.prepare('select distinct library_root from had_part').all() as {
		library_root: string | null;
	}[];
	return roots.length === 1 ? (roots[0]?.library_root ?? null) : null;
}

/**
 * One Part's file and the Sidecar that describes it, moved and then recorded as moved, so a move
 * stopped partway leaves every Part recorded where its file actually is rather than where the
 * move was heading. The pair and the record are one transaction: a Part whose video has moved
 * and whose Sidecar has not is a Library neither root describes correctly.
 */
function land(db: Database, part: StrandedRow, library: string): void {
	const destination = join(library, part.library_path);
	mkdirSync(dirname(destination), { recursive: true });
	db.transaction(() => {
		carry(join(part.library_root, part.library_path), destination);
		const sidecar = sidecarPathFor(part.library_path);
		carrySidecar(join(part.library_root, sidecar), join(library, sidecar));
		db.prepare('update had_part set library_root = null where part_slug = ?').run(part.part_slug);
	})();
	// After the Part lands rather than before, so a move that stops here never leaves the new
	// Library offering a season of artwork and metadata with no video under it.
	for (const shared of sharedSidecarPaths(part.library_path)) {
		duplicate(join(part.library_root, shared), join(library, shared));
	}
	discardShared(db, part);
}

/**
 * The Sidecars the old Library no longer describes anything with, dropped once the last Part
 * they covered has left, along with the directory they sat in. Until then both roots keep a copy,
 * because a Library split across a half-finished move is two Libraries a media server can read.
 */
function discardShared(db: Database, part: StrandedRow): void {
	const stranded = strandedParts(db);
	for (const shared of sharedSidecarPaths(part.library_path)) {
		if (stillCovered(shared, part.library_root, stranded)) continue;
		rmSync(join(part.library_root, shared), { force: true });
	}
	pruneEmptied(part.library_root, dirname(part.library_path));
}

const stillCovered = (shared: string, root: string, stranded: StrandedRow[]): boolean =>
	stranded.some(
		(part) => part.library_root === root && sharedSidecarPaths(part.library_path).includes(shared)
	);

/** Empties the directories a departed Part was filed under, never the Library root itself. */
function pruneEmptied(root: string, relative: string): void {
	let directory = relative;
	while (directory !== '.' && directory !== '/') {
		try {
			rmdirSync(join(root, directory));
		} catch {
			return;
		}
		directory = dirname(directory);
	}
}

function carry(source: string, destination: string): void {
	// Stopping between the file landing and the record of it leaves the file already at the
	// destination, so finishing the move has to read that as done rather than as a file gone.
	if (!existsSync(source) && existsSync(destination)) return;
	try {
		renameSync(source, destination);
		return;
	} catch (error) {
		if (!crossesFilesystems(error)) throw error;
	}
	copyFileSync(source, destination);
	unlinkSync(source);
}

// A Library filed before Pacerr wrote Sidecars has none to carry, and one carried already has
// none left behind: either way there is nothing here to fail the move over.
function carrySidecar(source: string, destination: string): void {
	if (existsSync(source)) carry(source, destination);
}

function duplicate(source: string, destination: string): void {
	if (existsSync(source)) copyFileSync(source, destination);
}

/**
 * Records every Part still in the old Library as being there, so that pointing Settings somewhere
 * else never makes Pacerr claim a file is where it has not been put yet.
 */
function pinTo(db: Database, root: string): void {
	const rows = db
		.prepare('select part_slug, library_path from had_part where library_root is null')
		.all() as { part_slug: string; library_path: string }[];
	const pin = db.prepare('update had_part set library_root = ? where part_slug = ?');
	for (const row of rows) {
		if (existsSync(join(root, row.library_path))) pin.run(root, row.part_slug);
	}
}

function strandedParts(db: Database): StrandedRow[] {
	return db
		.prepare(
			`select part_slug, library_path, library_root from had_part
			where library_root is not null order by library_path`
		)
		.all() as StrandedRow[];
}

/**
 * The Parts still to move, gathered under the directory each is actually in. Grouped rather than
 * summarised under one source, because a move that stopped and was then pointed somewhere else
 * again leaves the Library split across roots, and a plan that named only one of them would send
 * the user looking for files in a directory they are not in.
 */
function rootsOf(stranded: StrandedRow[]): StrandedRoot[] {
	const roots = new Map<string, StrandedRoot>();
	for (const part of stranded) {
		const path = join(part.library_root, part.library_path);
		const root = roots.get(part.library_root) ?? {
			path: part.library_root,
			parts: 0,
			bytes: 0,
			files: []
		};
		root.parts += 1;
		root.bytes += sizeOf(path);
		root.files.push(path);
		roots.set(part.library_root, root);
	}
	return [...roots.values()].sort((left, right) => left.path.localeCompare(right.path));
}

const sizeOf = (path: string): number => {
	try {
		return statSync(path).size;
	} catch {
		return 0;
	}
};

// Mirrors the hardlinking check: a path Pacerr cannot stat says nothing rather than inventing a
// second problem on top of the one validation is already reporting.
function shareAFilesystem(from: string, to: string): boolean {
	try {
		return statSync(from).dev === statSync(to).dev;
	} catch {
		return true;
	}
}
