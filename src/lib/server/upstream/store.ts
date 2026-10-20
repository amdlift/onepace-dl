import type { Database } from 'better-sqlite3';
import type { Validators } from './source';

/** The two documents One Pace publishes that Pacerr derives everything from. */
export type UpstreamName = 'catalogue' | 'feed';

/**
 * How the last attempt on one of them ended. `unparsed` is the one ADR-0002 warns about: One Pace
 * answered but the body no longer has the shape the parser knows, which without this reads exactly
 * like a quiet month upstream.
 */
export type UpstreamOutcome = 'updated' | 'unchanged' | 'unparsed' | 'unreachable';

export interface StoredUpstream extends Validators {
	/**
	 * What the document last said about its own age. The feed states a `lastBuildDate`; the watch
	 * page states nothing, so Pacerr hashes the body. Either way, unchanged means nothing to
	 * reparse — which is all that can be saved, because the bytes have already moved.
	 */
	freshness: string | null;
	checkedAt: Date | null;
	updatedAt: Date | null;
	outcome: UpstreamOutcome | null;
	failure: string | null;
}

interface UpstreamRow {
	freshness: string | null;
	etag: string | null;
	last_modified: string | null;
	checked_at: string | null;
	updated_at: string | null;
	outcome: string | null;
	failure: string | null;
}

export function readUpstream(db: Database, name: UpstreamName): StoredUpstream {
	const row = db.prepare('select * from upstream_source where name = ?').get(name) as UpstreamRow;
	return {
		freshness: row.freshness,
		etag: row.etag,
		lastModified: row.last_modified,
		checkedAt: parseTime(row.checked_at),
		updatedAt: parseTime(row.updated_at),
		outcome: row.outcome as UpstreamOutcome | null,
		failure: row.failure
	};
}

export function recordUpstreamCheck(
	db: Database,
	name: UpstreamName,
	at: Date,
	validators: Validators,
	freshness: string | null,
	outcome: UpstreamOutcome
): void {
	db.prepare(
		`update upstream_source
		set checked_at = ?, outcome = ?, failure = null, freshness = ?, etag = ?, last_modified = ?
		where name = ?`
	).run(at.toISOString(), outcome, freshness, validators.etag, validators.lastModified, name);
}

export function recordUpstreamFailure(
	db: Database,
	name: UpstreamName,
	at: Date,
	outcome: UpstreamOutcome,
	failure: string
): void {
	db.prepare(
		'update upstream_source set checked_at = ?, outcome = ?, failure = ? where name = ?'
	).run(at.toISOString(), outcome, failure, name);
}

/**
 * Called from inside the transaction that replaced what the document yields, so a document is
 * never recorded as updated without the rows to show for it.
 */
export function recordUpstreamUpdate(
	db: Database,
	name: UpstreamName,
	at: Date,
	validators: Validators,
	freshness: string | null
): void {
	recordUpstreamCheck(db, name, at, validators, freshness, 'updated');
	db.prepare('update upstream_source set updated_at = ? where name = ?').run(
		at.toISOString(),
		name
	);
}

const parseTime = (value: string | null): Date | null => (value === null ? null : new Date(value));
