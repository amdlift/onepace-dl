import type { Database } from 'better-sqlite3';
import { readArcDetail } from './catalogue/store';
import { readReleasesCovering, type ReleaseListing } from './releases/store';

export interface PartRow {
	slug: string;
	number: number;
	title: string;
	releases: ReleaseListing[];
	toBeRedone: boolean;
}

export interface UnreleasedPartRow {
	number: number;
}

export type ArcRow = ({ released: true } & PartRow) | ({ released: false } & UnreleasedPartRow);

export interface ArcDetail {
	slug: string;
	title: string;
	rows: ArcRow[];
}

/**
 * Where the two sources meet. Parts come from the Catalogue, Releases from the feed, and infohash
 * is the only thing that joins them — per ADR-0002 and ADR-0004, never a title or a filename.
 */
export function arcDetailView(db: Database, slug: string): ArcDetail | null {
	const arc = readArcDetail(db, slug);
	if (arc === null) return null;

	const covering = readReleasesCovering(
		db,
		arc.parts.map((part) => part.slug)
	);

	return {
		slug: arc.slug,
		title: arc.title,
		rows: [
			...arc.parts.map((part) => {
				const releases = covering.get(part.slug) ?? [];
				return {
					released: true as const,
					slug: part.slug,
					number: part.number,
					title: part.title,
					releases,
					toBeRedone: releases.some((release) => release.status === 'to-be-redone')
				};
			}),
			...arc.unreleasedPartNumbers.map((number) => ({ released: false as const, number }))
		]
	};
}
