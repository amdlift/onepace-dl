import type { Database } from 'better-sqlite3';
import type { Resolution, Variant } from '../catalogue/watch-page';

/** The one global set of preferences every Selection is made against. */
export interface Profile {
	resolutions: Resolution[];
	variant: Variant;
	cutoff: Resolution;
}

interface ProfileRow {
	resolutions: string;
	variant: string;
	cutoff: number;
}

export function readProfile(db: Database): Profile {
	const row = db.prepare('select * from profile where id = 1').get() as ProfileRow;
	return {
		resolutions: JSON.parse(row.resolutions) as Resolution[],
		variant: row.variant as Variant,
		cutoff: row.cutoff as Resolution
	};
}

export function writeProfile(db: Database, profile: Profile): void {
	db.prepare('update profile set resolutions = ?, variant = ?, cutoff = ? where id = 1').run(
		JSON.stringify(profile.resolutions),
		profile.variant,
		profile.cutoff
	);
}
