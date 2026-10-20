import type { Database } from 'better-sqlite3';

export type WantedState = 'missing' | 'available' | 'unreleased';

export interface WantedRow {
	arcSlug: string;
	arcTitle: string;
	number: number;
	/** Null for an Unreleased Part: the Catalogue announces its number and nothing else. */
	partSlug: string | null;
	title: string | null;
	state: WantedState;
}

interface Row {
	unreleased: number;
	arc_slug: string;
	arc_title: string;
	part_slug: string | null;
	number: number;
	title: string | null;
	has_release: number;
}

/**
 * Monitoring is a standing instruction rather than a list of Parts, so what is wanted is derived
 * from the Catalogue every time it is asked for: a Part that appeared upstream an hour ago is
 * covered without anything having to be written when it arrived.
 */
export function wantedView(db: Database): WantedRow[] {
	const rows = db
		.prepare(
			`select arc.position as arc_position, 0 as unreleased, part.position as part_position,
				arc.slug as arc_slug, arc.title as arc_title, part.slug as part_slug,
				part.number as number, part.title as title,
				exists(
					select 1 from catalogue_release_part covers
					join feed_release release on release.infohash = covers.infohash
					where covers.part_slug = part.slug
				) as has_release
			from part
			join arc on arc.slug = part.arc_slug
			join monitored_arc on monitored_arc.arc_slug = arc.slug
			where part.slug not in (select part_slug from not_wanted_part)
				and part.slug not in (select part_slug from had_part)
			union all
			select arc.position, 1, unreleased_part.number,
				arc.slug, arc.title, null, unreleased_part.number, null, 0
			from unreleased_part
			join arc on arc.slug = unreleased_part.arc_slug
			join monitored_arc on monitored_arc.arc_slug = arc.slug
			order by arc_position, unreleased, part_position`
		)
		.all() as Row[];

	return rows.map((row) => ({
		arcSlug: row.arc_slug,
		arcTitle: row.arc_title,
		number: row.number,
		partSlug: row.part_slug,
		title: row.title,
		state: stateOf(row)
	}));
}

function stateOf(row: Row): WantedState {
	if (row.unreleased === 1) return 'unreleased';
	return row.has_release === 1 ? 'available' : 'missing';
}
