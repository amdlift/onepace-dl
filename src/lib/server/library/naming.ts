import type { Resolution } from '../catalogue/watch-page';

/**
 * Arcs render as seasons and Parts as episodes, because `SxxEyy` is the one shape Jellyfin and
 * Plex parse without a custom agent. Those two words live here and in the paths this renders,
 * and nowhere else in Pacerr.
 */
export const defaultNamingTemplate =
	'{arc}/Season {season}/{arc} - S{season}E{episode} - {part} [{resolution}]';

export interface NamingFields {
	arcTitle: string;
	/** The Arc's fixed place in the Library, which `{season}` renders. */
	arcLibraryIndex: number;
	partTitle: string;
	/** The Part's place within its Arc, which `{episode}` renders. */
	partLibraryIndex: number;
	resolution: Resolution | null;
}

/** The path, relative to the Library root and without an extension, one Part is filed under. */
export function renderLibraryPath(template: string, fields: NamingFields): string {
	const values: Record<string, string> = {
		arc: nameable(fields.arcTitle),
		season: padded(fields.arcLibraryIndex),
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
