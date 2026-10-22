import type { PartState } from '../state';
import type { App } from './app';
import { downloadingParts } from './downloading';
import { grabRow, type GrabRow } from './selection/grab-row';
import { select } from './selection/selection';

/**
 * Why a wanted Part is not had yet. `missing` is story 23's "missing rather than failed": the
 * Catalogue lists the Part as released and no Release in the feed covers it, so there is nothing
 * for Pacerr to have failed at. `unreleased` is an Unreleased Part, which the glossary keeps
 * deliberately apart from that — One Pace has announced a number and published nothing.
 */
export type WantedState = 'missing' | 'available' | 'unreleased';

export interface WantedRow {
	arcSlug: string;
	arcTitle: string;
	number: number;
	/** Null for an Unreleased Part: the Catalogue announces its number and nothing else. */
	partSlug: string | null;
	title: string | null;
	state: WantedState;
	/** Which of the six legend states the row is in, which `state` alone cannot say. */
	legend: PartState;
	toBeRedone: boolean;
	/** Null for an Unreleased Part: there is nothing yet for Selection to choose between. */
	grab: GrabRow | null;
}

/** One gap in a monitored Arc: a Part with no file yet, or a number One Pace has only announced. */
interface GapRow {
	unreleased: number;
	arc_slug: string;
	arc_title: string;
	part_slug: string | null;
	number: number;
	title: string | null;
	has_release: number;
	to_be_redone: number;
}

/**
 * Monitoring is a standing instruction rather than a list of Parts, so what is wanted is derived
 * from the Catalogue every time it is asked for: a Part that appeared upstream an hour ago is
 * covered without anything having to be written when it arrived.
 */
export async function wantedView(app: App): Promise<WantedRow[]> {
	const db = app.db;
	const rows = db
		.prepare(
			`select arc.position as arc_position, 0 as unreleased, part.position as part_position,
				arc.slug as arc_slug, arc.title as arc_title, part.slug as part_slug,
				part.number as number, part.title as title,
				exists(
					select 1 from catalogue_release_part covers
					join feed_release release on release.infohash = covers.infohash
					where covers.part_slug = part.slug
				) as has_release,
				exists(
					select 1 from catalogue_release_part covers
					join feed_release release on release.infohash = covers.infohash
					where covers.part_slug = part.slug and release.status = 'to-be-redone'
				) as to_be_redone
			from part
			join arc on arc.slug = part.arc_slug
			join monitored_arc on monitored_arc.arc_slug = arc.slug
			where part.slug not in (select part_slug from not_wanted_part)
				and part.slug not in (select part_slug from had_part)
			union all
			select arc.position, 1, unreleased_part.number,
				arc.slug, arc.title, null, unreleased_part.number, null, 0, 0
			from unreleased_part
			join arc on arc.slug = unreleased_part.arc_slug
			join monitored_arc on monitored_arc.arc_slug = arc.slug
			order by arc_position, unreleased, part_position`
		)
		.all() as GapRow[];

	const selection = select(db);
	const downloading = await downloadingParts(app);
	return rows.map((row) => {
		const state = stateOf(row);
		return {
			arcSlug: row.arc_slug,
			arcTitle: row.arc_title,
			number: row.number,
			partSlug: row.part_slug,
			title: row.title,
			state,
			toBeRedone: row.to_be_redone === 1,
			legend: legendOf(state, row.part_slug !== null && downloading.has(row.part_slug)),
			grab: row.part_slug === null ? null : grabRow(selection.parts.get(row.part_slug))
		};
	});
}

function stateOf(row: GapRow): WantedState {
	if (row.unreleased === 1) return 'unreleased';
	return row.has_release === 1 ? 'available' : 'missing';
}

// Wanted lists only monitored Arcs, so every gap it shows is one the user asked Pacerr to fill.
const legendOf = (state: WantedState, downloading: boolean): PartState => {
	if (state === 'unreleased') return 'unreleased';
	return downloading ? 'downloading' : 'missing';
};
