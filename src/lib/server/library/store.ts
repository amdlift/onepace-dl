import type { Database } from 'better-sqlite3';

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
