import type { Database } from 'better-sqlite3';

export function readMonitoredArcs(db: Database): Set<string> {
	const rows = db.prepare('select arc_slug from monitored_arc').all() as { arc_slug: string }[];
	return new Set(rows.map((row) => row.arc_slug));
}

export function writeArcMonitored(db: Database, arcSlug: string, monitored: boolean): void {
	if (monitored)
		db.prepare('insert or ignore into monitored_arc (arc_slug) values (?)').run(arcSlug);
	else db.prepare('delete from monitored_arc where arc_slug = ?').run(arcSlug);
}

export function writeEveryArcMonitored(db: Database): void {
	db.prepare('insert or ignore into monitored_arc (arc_slug) select slug from arc').run();
}

export function readNotWantedParts(db: Database): Set<string> {
	const rows = db.prepare('select part_slug from not_wanted_part').all() as { part_slug: string }[];
	return new Set(rows.map((row) => row.part_slug));
}

export function writePartWanted(db: Database, partSlug: string, wanted: boolean): void {
	if (wanted) db.prepare('delete from not_wanted_part where part_slug = ?').run(partSlug);
	else db.prepare('insert or ignore into not_wanted_part (part_slug) values (?)').run(partSlug);
}
