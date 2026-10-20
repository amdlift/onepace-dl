import type { Database } from 'better-sqlite3';

/**
 * Monitoring is stored as the set of Arcs a user has said yes to, and Parts within them they have
 * said no to. Nothing is enumerated: a Part One Pace published an hour ago is covered by the
 * standing instruction without anything having been written when it arrived.
 */
export function readMonitoredArcs(db: Database): Set<string> {
	const rows = db.prepare('select arc_slug from monitored_arc').all() as { arc_slug: string }[];
	return new Set(rows.map((row) => row.arc_slug));
}

export function toggleArcMonitored(db: Database, arcSlug: string): void {
	if (readMonitoredArcs(db).has(arcSlug))
		db.prepare('delete from monitored_arc where arc_slug = ?').run(arcSlug);
	else db.prepare('insert or ignore into monitored_arc (arc_slug) values (?)').run(arcSlug);
}

export function monitorEveryArc(db: Database): void {
	db.prepare('insert or ignore into monitored_arc (arc_slug) select slug from arc').run();
}

export function readNotWantedParts(db: Database): Set<string> {
	const rows = db.prepare('select part_slug from not_wanted_part').all() as { part_slug: string }[];
	return new Set(rows.map((row) => row.part_slug));
}

export function togglePartWanted(db: Database, partSlug: string): void {
	if (readNotWantedParts(db).has(partSlug))
		db.prepare('delete from not_wanted_part where part_slug = ?').run(partSlug);
	else db.prepare('insert or ignore into not_wanted_part (part_slug) values (?)').run(partSlug);
}
