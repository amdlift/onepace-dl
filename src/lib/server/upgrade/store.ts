import type { Database } from 'better-sqlite3';
import type { Resolution } from '../catalogue/watch-page';
import type { Selection } from '../selection/selection';

export interface DueUpgrade {
	partSlug: string;
	partTitle: string;
	replacedInfohash: string;
	replacedReleaseTitle: string;
	replacedLibraryPath: string;
	replacementInfohash: string;
}

interface HeldRow {
	part_slug: string;
	part_title: string;
	library_path: string;
	infohash: string;
	release_title: string;
	resolution: number | null;
	current: number;
}

/**
 * Every held Part whose Release should be replaced, decided fresh from what the watch page says
 * now. A Part with no infohash was manually imported, so per ADR-0004 Pacerr does not know what it
 * holds and has no Upgrade path for it; the query leaves those out.
 */
export function readDueUpgrades(db: Database, selection: Selection): DueUpgrade[] {
	const rows = db
		.prepare(
			`select h.part_slug, h.library_path, h.infohash, part.title as part_title,
				coalesce(g.release_title, r.title, h.infohash) as release_title,
				coalesce(c.resolution, r.resolution) as resolution,
				(c.infohash is not null) as current
			from had_part h
			join part on part.slug = h.part_slug
			join monitored_arc on monitored_arc.arc_slug = part.arc_slug
			left join grab g on g.infohash = h.infohash
			left join feed_release r on r.infohash = h.infohash
			left join catalogue_release c on c.infohash = h.infohash
			where h.infohash is not null
				and h.part_slug not in (select part_slug from not_wanted_part)`
		)
		.all() as HeldRow[];

	const due: DueUpgrade[] = [];
	for (const row of rows) {
		const chosen = selection.parts.get(row.part_slug);
		if (chosen === undefined || !chosen.chosen) continue;
		if (chosen.release.infohash === row.infohash) continue;

		if (!dueOn(row, chosen.release.resolution, selection.profile.cutoff)) continue;
		due.push({
			partSlug: row.part_slug,
			partTitle: row.part_title,
			replacedInfohash: row.infohash,
			replacedReleaseTitle: row.release_title,
			replacedLibraryPath: row.library_path,
			replacementInfohash: chosen.release.infohash
		});
	}
	return due;
}

/**
 * The two grounds for an Upgrade. Dropping out of the watch page's current set is the
 * authoritative one of ADR-0002 and overrides the Cutoff; the Cutoff withholds only the other,
 * so a Part Pacerr is already happy with is not churned for Resolution alone.
 */
function dueOn(row: HeldRow, offered: Resolution, cutoff: Resolution): boolean {
	if (row.current === 0) return true;
	const held = row.resolution;
	return held !== null && held < cutoff && offered > held;
}

/**
 * Fixes the set of Upgrades in flight. An imported one is left standing, because it is what still
 * owes a removal: a Part waits for that to clear before a further Upgrade is recorded against it,
 * so a Release Pacerr has stopped holding can never be forgotten before it has been removed.
 */
export function recordUpgrades(db: Database, due: DueUpgrade[]): void {
	const insert = db.prepare(
		`insert or ignore into upgrade (part_slug, replaced_infohash, replaced_release_title,
			replaced_library_path, replacement_infohash, imported_at)
		values (?, ?, ?, ?, ?, null)`
	);
	db.transaction(() => {
		db.prepare('delete from upgrade where imported_at is null').run();
		for (const upgrade of due) {
			insert.run(
				upgrade.partSlug,
				upgrade.replacedInfohash,
				upgrade.replacedReleaseTitle,
				upgrade.replacedLibraryPath,
				upgrade.replacementInfohash
			);
		}
	})();
}

export function recordUpgradeImported(db: Database, partSlug: string, at: Date): void {
	db.prepare('update upgrade set imported_at = ? where part_slug = ?').run(
		at.toISOString(),
		partSlug
	);
}

/**
 * The Releases an Upgrade has finished superseding: every Part that held one now holds its
 * replacement in the Library, so the torrent and its download-directory copy are Pacerr's to
 * remove. This is the only removal Pacerr performs.
 */
export function readSupersededReleases(db: Database): string[] {
	const rows = db
		.prepare(
			`select distinct u.replaced_infohash as infohash
			from upgrade u
			where u.imported_at is not null
				and not exists (select 1 from upgrade inflight
					where inflight.replaced_infohash = u.replaced_infohash
						and inflight.imported_at is null)
				and not exists (select 1 from had_part where had_part.infohash = u.replaced_infohash)`
		)
		.all() as { infohash: string }[];
	return rows.map((row) => row.infohash);
}

export function forgetSupersededRelease(db: Database, infohash: string): void {
	db.transaction(() => {
		db.prepare('delete from upgrade where replaced_infohash = ?').run(infohash);
		db.prepare('delete from grab where infohash = ?').run(infohash);
	})();
}
