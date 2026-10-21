import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PosterFile {
	path: string;
	contentType: string;
}

/** What a view shows for an Arc: its Poster, failing that its Backdrop, failing that nothing. */
export type ArcArtwork =
	| { kind: 'poster'; url: string }
	| { kind: 'backdrop'; url: string }
	| { kind: 'placeholder' };

const manifestName = 'posters.json';
const overrideTypes = [
	['jpg', 'image/jpeg'],
	['jpeg', 'image/jpeg'],
	['png', 'image/png'],
	['webp', 'image/webp']
] as const;

/**
 * The Posters Pacerr ships and the ones a user has dropped into the config volume to replace them.
 * Which Arc a bundled Poster belongs to comes from the committed manifest and never from its
 * filename, per ADR-0004.
 */
export class Posters {
	readonly #configDirectory: string;
	#manifest: Map<string, string> | null = null;

	constructor(configDirectory: string) {
		this.#configDirectory = configDirectory;
	}

	/** Poster dimensions, for a media server to display. */
	library(arcSlug: string): PosterFile | null {
		return this.#override(arcSlug) ?? this.#shipped(arcSlug, 'library', 'jpg', 'image/jpeg');
	}

	/** The thumbnail Pacerr's own views serve. */
	view(arcSlug: string): PosterFile | null {
		return this.#override(arcSlug) ?? this.#shipped(arcSlug, 'view', 'webp', 'image/webp');
	}

	#override(arcSlug: string): PosterFile | null {
		const directory = join(this.#configDirectory, 'posters');
		// An Arc slug reaches here straight off a URL, so one shaped like a path would otherwise
		// read a file from outside the config volume.
		if (dirname(resolve(directory, arcSlug)) !== directory) return null;
		for (const [extension, contentType] of overrideTypes) {
			const path = join(directory, `${arcSlug}.${extension}`);
			if (existsSync(path)) return { path, contentType };
		}
		return null;
	}

	#shipped(
		arcSlug: string,
		directory: string,
		extension: string,
		contentType: string
	): PosterFile | null {
		this.#manifest ??= readManifest();
		const name = this.#manifest.get(arcSlug);
		if (name === undefined) return null;
		return { path: join(artworkDirectory(), directory, `${name}.${extension}`), contentType };
	}
}

export function arcArtwork(
	posters: Posters,
	arcSlug: string,
	backdropUrl: string | null
): ArcArtwork {
	if (posters.view(arcSlug) !== null) {
		return { kind: 'poster', url: `/arcs/${encodeURIComponent(arcSlug)}/poster` };
	}
	if (backdropUrl !== null) return { kind: 'backdrop', url: backdropUrl };
	return { kind: 'placeholder' };
}

function readManifest(): Map<string, string> {
	const manifest = JSON.parse(readFileSync(join(artworkDirectory(), manifestName), 'utf8')) as {
		posters: { arc: string; name: string }[];
	};
	return new Map(manifest.posters.map((poster) => [poster.arc, poster.name]));
}

let found: string | null = null;

// Seam 1 builds the application out of `src` while serving HTTP from the bundled `build`, so the
// two live copies of this module sit at different depths beneath the directory holding the
// artwork. Searching upwards for the manifest is the one answer that is right in both.
function artworkDirectory(): string {
	if (found !== null) return found;
	let directory = dirname(fileURLToPath(import.meta.url));
	for (;;) {
		const candidate = join(directory, 'artwork');
		if (existsSync(join(candidate, manifestName))) return (found = candidate);
		const parent = dirname(directory);
		if (parent === directory) throw new Error('Pacerr cannot find the artwork it ships');
		directory = parent;
	}
}
