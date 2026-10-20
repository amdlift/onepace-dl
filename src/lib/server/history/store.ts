import type { Database } from 'better-sqlite3';

/** What Pacerr did. Every slice that acts on a Part records one of these. */
export type HistoryEvent = 'grab' | 'import' | 'upgrade' | 'manualImport';

/** `warned` is for something that happened but not wholly as asked, and the user should see. */
export type HistoryOutcome = 'succeeded' | 'warned' | 'failed';

export interface HistoryEntry {
	event: HistoryEvent;
	outcome: HistoryOutcome;
	partSlug?: string | null;
	partTitle?: string | null;
	infohash?: string | null;
	releaseTitle?: string | null;
	/** The Release an Upgrade superseded. */
	replacedInfohash?: string | null;
	detail?: string | null;
	reason?: string | null;
}

export interface HistoryRecord extends HistoryEntry {
	id: number;
	at: Date;
}

interface Row {
	id: number;
	at: string;
	event: string;
	outcome: string;
	part_slug: string | null;
	part_title: string | null;
	infohash: string | null;
	release_title: string | null;
	replaced_infohash: string | null;
	detail: string | null;
	reason: string | null;
}

export function recordHistory(db: Database, at: Date, entries: HistoryEntry[]): void {
	const insert = db.prepare(
		`insert into history (at, event, outcome, part_slug, part_title, infohash, release_title,
			replaced_infohash, detail, reason)
		values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	db.transaction(() => {
		for (const entry of entries) {
			insert.run(
				at.toISOString(),
				entry.event,
				entry.outcome,
				entry.partSlug ?? null,
				entry.partTitle ?? null,
				entry.infohash ?? null,
				entry.releaseTitle ?? null,
				entry.replacedInfohash ?? null,
				entry.detail ?? null,
				entry.reason ?? null
			);
		}
	})();
}

export function countHistory(db: Database): number {
	return (db.prepare('select count(*) as n from history').get() as { n: number }).n;
}

export function readHistory(db: Database, limit = 200, offset = 0): HistoryRecord[] {
	const rows = db
		.prepare('select * from history order by at desc, id desc limit ? offset ?')
		.all(limit, offset) as Row[];
	return rows.map((row) => ({
		id: row.id,
		at: new Date(row.at),
		event: row.event as HistoryEvent,
		outcome: row.outcome as HistoryOutcome,
		partSlug: row.part_slug,
		partTitle: row.part_title,
		infohash: row.infohash,
		releaseTitle: row.release_title,
		replacedInfohash: row.replaced_infohash,
		detail: row.detail,
		reason: row.reason
	}));
}
