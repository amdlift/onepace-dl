import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { onTestFinished } from 'vitest';

/** Somewhere a user might already keep their media, outside anything Pacerr chose for them. */
export const anotherDirectory = (prefix = 'pacerr-media-'): string =>
	temporary(join(tmpdir(), prefix));

/** A tmpfs nothing under tmpdir() is on, so moving or linking between the two genuinely copies. */
export const onAnotherFilesystem = (prefix = 'pacerr-media-'): string =>
	temporary(`/dev/shm/${prefix}`);

function temporary(template: string): string {
	const directory = mkdtempSync(template);
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

/** Everything a Library holds: the Parts, the Sidecars beside them, and the directories. */
export const everythingUnder = (directory: string): string[] =>
	readdirSync(directory, { recursive: true }).map(String).sort();

export const filesUnder = (directory: string): string[] =>
	everythingUnder(directory).filter((entry) => statSync(join(directory, entry)).isFile());

/** The media alone. What the Sidecars beside it say is `tests/sidecars.test.ts`'s business. */
export const mediaUnder = (directory: string): string[] =>
	filesUnder(directory).filter((entry) => !isSidecar(entry));

/** The Sidecars a Library holds: the NFOs, and the Posters written as cover.jpg. */
export const sidecarsUnder = (directory: string): string[] =>
	filesUnder(directory).filter(isSidecar);

/** The directories at the top of one, saying nothing about what is inside them. */
export const directoriesIn = (directory: string): string[] =>
	readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

const isSidecar = (entry: string): boolean =>
	extname(entry) === '.nfo' || basename(entry) === 'cover.jpg';
