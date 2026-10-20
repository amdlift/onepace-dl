import { accessSync, constants, mkdirSync, statSync, type Stats } from 'node:fs';
import type { RuntimePaths } from '../runtime';

export type DirectoryName = 'config' | 'library' | 'downloads';

/**
 * The three ways a mount goes wrong, kept apart because each has a different fix: mount the
 * volume, grant the running user write, or put both volumes on one filesystem.
 */
export type DirectoryCondition = 'ok' | 'missing' | 'unwritable';

export interface DirectoryCheck {
	directory: DirectoryName;
	subject: string;
	path: string;
	condition: DirectoryCondition;
	diagnostic: string;
}

export interface HardlinkCheck {
	sameFilesystem: boolean;
	diagnostic: string;
}

export interface PathValidation {
	directories: DirectoryCheck[];
	hardlinking: HardlinkCheck;
}

interface Purpose {
	/** Names the directory mid-sentence, so a diagnostic never opens by restating its own heading. */
	noun: string;
	/** Why Pacerr needs it, in one sentence, after the path has been named. */
	consequence: string;
	/** What to do about it, for the one condition whose fix depends on where the path came from. */
	remedy: string;
}

const purposes: Record<DirectoryName, Purpose> = {
	config: {
		noun: 'config directory',
		consequence:
			'Pacerr keeps its database and every setting there, so it cannot start without it.',
		remedy: 'Mount a volume there, or set PACERR_CONFIG_DIR to where it already is.'
	},
	library: {
		noun: 'Library',
		consequence: 'Every import is filed there, so nothing can be imported.',
		remedy: 'Mount a volume there, or set PACERR_LIBRARY_DIR to where it already is.'
	},
	downloads: {
		noun: 'download directory',
		consequence: 'Pacerr reads completed downloads from there, so nothing can be imported.',
		remedy:
			'Mount a volume there, or set PACERR_DOWNLOADS_DIR to where it already is. If the ' +
			'Download Client already holds the files somewhere Pacerr can reach under a different ' +
			'path, add a Remote Path Mapping instead of moving the mount.'
	}
};

/**
 * Replaces the configured mount's wording wholesale, because the two have different fixes: moving
 * a path the Download Client chose is a Remote Path Mapping or a matching mount, never
 * PACERR_DOWNLOADS_DIR.
 */
const asReported: Purpose = {
	noun: 'download directory',
	consequence:
		'That is where the Download Client says it writes completed downloads, so it is the path ' +
		'every import will read.',
	remedy:
		'Mount that storage at the same path in both containers, or add a Remote Path Mapping from ' +
		'it to the path Pacerr has for the same storage.'
};

/**
 * Story 65 asks for the download directory *as the Download Client reports it*, so `reported` —
 * already through any Remote Path Mapping — is what gets validated when there is one. Null is a
 * Download Client that is unconfigured or could not be asked, which is a separate condition the
 * Download Client check already owns; this falls back to the configured mount rather than
 * inventing a path error out of it.
 */
export function validatePaths(paths: RuntimePaths, reported: string | null = null): PathValidation {
	const downloads = reported ?? paths.downloads;
	return {
		directories: [
			validateDirectory('config', paths.config),
			validateDirectory('library', paths.library),
			validateDirectory('downloads', downloads, reported !== null)
		],
		hardlinking: validateHardlinking(paths.library, downloads)
	};
}

function validateDirectory(
	directory: DirectoryName,
	path: string,
	fromDownloadClient = false
): DirectoryCheck {
	const { noun, consequence, remedy } = fromDownloadClient ? asReported : purposes[directory];
	const subject = noun.charAt(0).toUpperCase() + noun.slice(1);
	const found = describe(path);
	if (found === null) {
		return {
			directory,
			subject,
			path,
			condition: 'missing',
			diagnostic: `Pacerr cannot find the ${noun} at ${path}. ${consequence} ${remedy}`
		};
	}
	if (writable(path)) {
		return {
			directory,
			subject,
			path,
			condition: 'ok',
			diagnostic: `Pacerr can read and write the ${noun} at ${path}.`
		};
	}
	return {
		directory,
		subject,
		path,
		condition: 'unwritable',
		diagnostic:
			`Pacerr can see the ${noun} at ${path} but cannot write to it. ${consequence} ` +
			`Pacerr is running as ${identity()} and that directory is owned by ` +
			`${found.uid}:${found.gid} with mode ${mode(found)}. Give it to ${identity()} on the ` +
			'host with chown, or, under rootless podman, run the container with --userns=keep-id so ' +
			'that the bind mount keeps its owner.'
	};
}

/**
 * Not a failure. A cross-filesystem pair is why hardlinking silently becomes copying, which the
 * importer already reports per import; this says it once, up front, instead.
 */
function validateHardlinking(library: string, downloads: string): HardlinkCheck {
	const here = describe(library);
	const there = describe(downloads);
	if (here === null || there === null || here.dev === there.dev) {
		return {
			sameFilesystem: true,
			diagnostic:
				'The Library and the download directory are on the same filesystem, so every import ' +
				'hardlinks and no Part occupies disk twice.'
		};
	}
	return {
		sameFilesystem: false,
		diagnostic:
			`The Library ${library} and the download directory ${downloads} are on different ` +
			'filesystems, so Pacerr copies each imported file instead of hardlinking it and every ' +
			'Part occupies disk twice for as long as its Release seeds. Mount both from one ' +
			'filesystem to hardlink instead.'
	};
}

/**
 * Opened before SQLite is, because this is the one directory whose failure kills the process:
 * better-sqlite3 answers an unwritable config volume with `SQLITE_CANTOPEN` and no path, no uid
 * and no suggestion, which is the failure every other check here exists to replace.
 */
export function openConfigDirectory(path: string): void {
	try {
		mkdirSync(path, { recursive: true });
	} catch {
		// The check below says which path and why, where the raw errno would not.
	}
	const check = validateDirectory('config', path);
	if (check.condition === 'ok') return;
	console.error(`Pacerr: ${check.diagnostic}`);
	throw new Error(check.diagnostic);
}

/** The same sentences the UI shows, on stdout, for whoever is reading `docker logs`. */
export function reportPathValidation(validation: PathValidation): void {
	for (const directory of validation.directories) {
		if (directory.condition !== 'ok') console.error(`Pacerr: ${directory.diagnostic}`);
	}
	if (!validation.hardlinking.sameFilesystem) {
		console.warn(`Pacerr: ${validation.hardlinking.diagnostic}`);
	}
}

function describe(path: string): Stats | null {
	try {
		const stats = statSync(path);
		return stats.isDirectory() ? stats : null;
	} catch {
		return null;
	}
}

function writable(path: string): boolean {
	try {
		accessSync(path, constants.W_OK | constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

const identity = (): string => `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;

const mode = (stats: Stats): string => (stats.mode & 0o7777).toString(8).padStart(4, '0');
