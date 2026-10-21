import type { Database } from 'better-sqlite3';
import type { State } from '../state';
import { readArcDetail } from './catalogue/store';
import { readHadParts, type HadPart } from './library/store';
import { readMonitoredArcs, readNotWantedParts } from './monitoring/store';
import { readReleasesCovering, type ReleaseListing } from './releases/store';
import { grabRow, type GrabRow } from './selection/grab-row';
import { select } from './selection/selection';

export interface PartRow {
	slug: string;
	number: number;
	title: string;
	releases: ReleaseListing[];
	toBeRedone: boolean;
	/** What Pacerr holds for this Part, and the Release it came from. Null while it is missing. */
	had: HadPart | null;
	wanted: boolean;
	state: State;
	grab: GrabRow;
}

export interface UnreleasedPartRow {
	number: number;
	state: State;
}

export type ArcRow = ({ released: true } & PartRow) | ({ released: false } & UnreleasedPartRow);

export interface ArcDetail {
	slug: string;
	title: string;
	monitored: boolean;
	rows: ArcRow[];
}

/**
 * Where the two sources meet. Parts come from the Catalogue, Releases from the feed, and infohash
 * is the only thing that joins them — per ADR-0002 and ADR-0004, never a title or a filename.
 */
export function arcDetailView(db: Database, slug: string): ArcDetail | null {
	const arc = readArcDetail(db, slug);
	if (arc === null) return null;

	const monitored = readMonitoredArcs(db).has(arc.slug);
	const notWanted = readNotWantedParts(db);
	const covering = readReleasesCovering(
		db,
		arc.parts.map((part) => part.slug)
	);
	const had = readHadParts(db);
	const selection = select(db);

	return {
		slug: arc.slug,
		title: arc.title,
		monitored,
		rows: [
			...arc.parts.map((part) => {
				const releases = covering.get(part.slug) ?? [];
				const holding = had.get(part.slug) ?? null;
				const wanted = monitored && !notWanted.has(part.slug);
				return {
					released: true as const,
					slug: part.slug,
					number: part.number,
					title: part.title,
					releases,
					toBeRedone: releases.some((release) => release.status === 'to-be-redone'),
					had: holding,
					wanted,
					state: partState(holding, wanted),
					grab: grabRow(selection.parts.get(part.slug))
				};
			}),
			...arc.unreleasedPartNumbers.map((number) => ({
				released: false as const,
				number,
				state: 'unreleased' as const
			}))
		]
	};
}

const partState = (had: HadPart | null, wanted: boolean): State =>
	had !== null ? 'had' : wanted ? 'missing' : 'unmonitored';
