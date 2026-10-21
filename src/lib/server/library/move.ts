import { copyFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { Background, Pause } from '../background';
import type { Clock } from '../clock';
import { reasonOf } from '../failure';
import type { ConfigureOutcome, PathService } from '../paths/service';
import { crossesFilesystems } from './import';

const stoppedMidMove = 'Pacerr stopped while it was moving the Library.';

export type LibraryMoveState = 'planned' | 'moving' | 'done' | 'failed' | 'dismissed';

/** What a move of the Library would do, is doing, or did. */
export interface LibraryMove {
	source: string;
	destination: string;
	parts: number;
	bytes: number;
	sameFilesystem: boolean;
	state: LibraryMoveState;
	reason: string | null;
	moved: number;
	remaining: number;
}

interface MoveRow {
	id: number;
	source: string;
	destination: string;
	parts: number;
	bytes: number;
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
		let outcome: ConfigureOutcome = { ok: true };
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
		const remaining = strandedParts(this.#db).length;
		return {
			source: row.source,
			destination: row.destination,
			parts: row.parts,
			bytes: row.bytes,
			sameFilesystem: row.same_filesystem === 1,
			state: row.state as LibraryMoveState,
			reason: row.reason,
			moved: row.parts - remaining,
			remaining
		};
	}

	/** Starts the planned move and returns at once; it carries on in the background. */
	start(): void {
		const row = this.#latest();
		if (row === undefined || row.state !== 'planned') return;
		this.#db.prepare("update library_move set state = 'moving' where id = ?").run(row.id);
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

	dismiss(): void {
		this.#db
			.prepare(
				`update library_move set state = 'dismissed', finished_at = ?
				where state in ('planned', 'moving', 'done', 'failed')`
			)
			.run(this.#clock.now().toISOString());
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
				`select id, source, destination, parts, bytes, same_filesystem, state, reason
				from library_move order by id desc limit 1`
			)
			.get() as MoveRow | undefined;
	}

	#plan(from: string, to: string): void {
		if (to === from) return;
		pinTo(this.#db, from);
		const stranded = strandedParts(this.#db);
		if (stranded.length === 0) return;
		this.dismiss();
		this.#db
			.prepare(
				`insert into library_move
					(source, destination, parts, bytes, same_filesystem, state, planned_at)
				values (?, ?, ?, ?, ?, 'planned', ?)`
			)
			.run(
				from,
				to,
				stranded.length,
				totalBytes(stranded),
				shareAFilesystem(from, to) ? 1 : 0,
				this.#clock.now().toISOString()
			);
	}
}

/**
 * One Part's file, moved and then recorded as moved, so a move stopped partway leaves every Part
 * recorded where its file actually is rather than where the move was heading.
 */
function land(db: Database, part: StrandedRow, library: string): void {
	const source = join(part.library_root, part.library_path);
	const destination = join(library, part.library_path);
	mkdirSync(dirname(destination), { recursive: true });
	carry(source, destination);
	db.prepare('update had_part set library_root = null where part_slug = ?').run(part.part_slug);
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

const totalBytes = (parts: StrandedRow[]): number =>
	parts.reduce((total, part) => total + sizeOf(join(part.library_root, part.library_path)), 0);

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
