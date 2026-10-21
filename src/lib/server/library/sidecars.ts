import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Posters } from '../artwork';

/**
 * The Arc's Poster, written beside the Part that has just landed rather than into the directory
 * the season index names, so a user-supplied template cannot file a Part in one directory and the
 * artwork for it in another. Nothing is written for an Arc Pacerr has no Poster for, and nothing
 * is written at all until a Part is there to be shown, so a media server is never offered a season
 * of artwork and no video.
 */
export function writeSeasonPoster(
	posters: Posters,
	library: string,
	libraryPath: string,
	arcSlug: string
): void {
	const poster = posters.library(arcSlug);
	if (poster === null) return;
	copyFileSync(poster.path, join(library, dirname(libraryPath), 'cover.jpg'));
}
