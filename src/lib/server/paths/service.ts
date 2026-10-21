import { resolve } from 'node:path';
import type { Database } from 'better-sqlite3';
import type { EnvironmentPaths, RuntimePaths } from '../runtime';
import { filesystemPolicy, type BrowsePolicy } from './browse';
import { directoryNoun } from './validation';

/** The two directories a user points Pacerr at; the config directory is a boot concern instead. */
export type ConfiguredDirectory = 'library' | 'downloads';

export type PathSource = 'settings' | 'environment';

export interface ConfiguredPath {
	path: string;
	source: PathSource;
	/** The variable that pins it, which Settings names whether or not it is set. */
	variable: string;
}

export type ConfigureOutcome = { ok: true } | { ok: false; problem: string };

export const environmentVariables: Record<ConfiguredDirectory, string> = {
	library: 'PACERR_LIBRARY_DIR',
	downloads: 'PACERR_DOWNLOADS_DIR'
};

const writes: Record<ConfiguredDirectory, string> = {
	library: 'update directory set library = ? where id = 1',
	downloads: 'update directory set downloads = ? where id = 1'
};

interface DirectoryRow {
	library: string | null;
	downloads: string | null;
}

/**
 * Where Pacerr reads completed downloads and writes the Library. Read afresh on every use rather
 * than captured at boot, so changing one in Settings takes effect without the container restarting.
 */
export class PathService {
	#db: Database;
	#mounted: RuntimePaths;
	#environment: EnvironmentPaths;

	constructor(db: Database, mounted: RuntimePaths, environment: EnvironmentPaths) {
		this.#db = db;
		this.#mounted = mounted;
		this.#environment = environment;
	}

	library(): ConfiguredPath {
		return this.#configured('library');
	}

	downloads(): ConfiguredPath {
		return this.#configured('downloads');
	}

	/** How far the Settings browser may look for a directory to point one of these at. */
	browsePolicy(): BrowsePolicy {
		return filesystemPolicy(this.#mounted.root);
	}

	/** The three directories as they stand now, for whatever validates or reads them. */
	current(): RuntimePaths {
		return {
			config: this.#mounted.config,
			root: this.#mounted.root,
			library: this.library().path,
			downloads: this.downloads().path
		};
	}

	configure(directory: ConfiguredDirectory, wanted: string): ConfigureOutcome {
		if (this.#environment[directory] !== null) {
			const variable = environmentVariables[directory];
			const problem =
				`The ${directoryNoun(directory)} is configured by ${variable}, ` +
				'and cannot be changed here.';
			return { ok: false, problem };
		}
		const offered = wanted.trim();
		this.#db.prepare(writes[directory]).run(offered === '' ? null : resolve(offered));
		return { ok: true };
	}

	#configured(directory: ConfiguredDirectory): ConfiguredPath {
		const variable = environmentVariables[directory];
		const pinned = this.#environment[directory];
		if (pinned !== null) return { path: pinned, source: 'environment', variable };
		const row = this.#db.prepare('select library, downloads from directory where id = 1').get() as
			| DirectoryRow
			| undefined;
		return {
			path: row?.[directory] ?? this.#mounted[directory],
			source: 'settings',
			variable
		};
	}
}
