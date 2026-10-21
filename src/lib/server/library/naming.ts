import type { Resolution } from '../catalogue/watch-page';

/**
 * Arcs render as seasons and Parts as episodes, because `SxxEyy` is the one shape Jellyfin and
 * Plex parse without a custom agent. Those two words live here and in the paths this renders,
 * and nowhere else in Pacerr.
 *
 * Season directories sit at the Library root with no Arc folder above them, because a folder per
 * Arc reads as a show per Arc rather than as one show with many seasons.
 */
export const defaultNamingTemplate =
	'{seasonDirectory}/{show} - S{season}E{episode} - {part} [{resolution}]';

/** Pacerr manages one show, and this is the name a media server files every Part under. */
export const showTitle = 'One Pace';

/**
 * The directory under the Library that holds one Arc's Parts. Index zero is `Specials` because
 * that is the name a media server looks for the one-off entries under.
 */
export const seasonDirectory = (arcLibraryIndex: number): string =>
	arcLibraryIndex <= 0 ? 'Specials' : `Season ${padded(arcLibraryIndex)}`;

export interface NamingFields {
	arcTitle: string;
	/** The Arc's fixed place in the Library, which `{season}` and `{seasonDirectory}` render. */
	arcLibraryIndex: number;
	partTitle: string;
	/** The Part's fixed place within its Arc's place in the Library, which `{episode}` renders. */
	partLibraryIndex: number;
	resolution: Resolution | null;
}

/** The path, relative to the Library root and without an extension, one Part is filed under. */
export function renderLibraryPath(template: string, fields: NamingFields): string {
	const values: Record<string, string> = {
		show: showTitle,
		arc: nameable(fields.arcTitle),
		season: padded(fields.arcLibraryIndex),
		seasonDirectory: seasonDirectory(fields.arcLibraryIndex),
		part: nameable(fields.partTitle),
		episode: padded(fields.partLibraryIndex),
		resolution: fields.resolution === null ? 'unknown' : `${fields.resolution}p`
	};

	const segments = template
		.replace(/\{(\w+)\}/g, (token, name: string) => values[name] ?? token)
		.split('/')
		.map((segment) => segment.trim())
		.filter((segment) => segment !== '');
	if (segments.length === 0) throw new Error('The naming template renders an empty path.');
	return segments.join('/');
}

const padded = (value: number): string => String(Math.max(value, 0)).padStart(2, '0');

// A title is free text from someone else's website, and a separator in it would silently file the
// Part somewhere the template never said.
const nameable = (value: string): string =>
	value
		.replace(/[\\/:*?"<>|]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
