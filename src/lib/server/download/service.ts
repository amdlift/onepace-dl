import type { Database } from 'better-sqlite3';
import type {
	ConnectionTest,
	DownloadClient,
	DownloadClientConnection,
	DownloadClientFactory
} from './client';
import {
	applyRemotePathMappings,
	readRemotePathMappings,
	throughRemotePathMappings
} from '../paths/remote-path-mapping';
import { reasonOf } from '../failure';
import { readConnection, writeConnection } from './connection';

/** What Settings shows about the connection. The password is never rendered back. */
export interface ConnectionView {
	url: string;
	username: string;
}

export const answered: ConnectionTest = {
	ok: true,
	detail: 'The Download Client answered.'
};

export const unreachable = (error: unknown): ConnectionTest => ({
	ok: false,
	failure: 'unreachable',
	detail: `The Download Client is unreachable: ${reasonOf(error)}`
});

const unconfigured: ConnectionTest = {
	ok: false,
	failure: 'unconfigured',
	detail: 'No Download Client is configured.'
};

/** Owns the configured connection and the one client built from it. */
export class DownloadService {
	#db: Database;
	#factory: DownloadClientFactory;
	#built: { connection: DownloadClientConnection; client: DownloadClient } | null = null;
	#outcome: ConnectionTest | null = null;
	#reportedSaveDirectory: string | null = null;

	constructor(db: Database, factory: DownloadClientFactory) {
		this.#db = db;
		this.#factory = factory;
	}

	connection(): ConnectionView {
		const stored = readConnection(this.#db);
		return {
			url: stored?.url ?? '',
			username: stored?.username ?? ''
		};
	}

	configure(connection: DownloadClientConnection): void {
		const stored = readConnection(this.#db);
		writeConnection(this.#db, {
			...connection,
			// An empty password field means "leave it alone", so editing the URL does not silently
			// erase a password the form never showed.
			password: connection.password === '' ? (stored?.password ?? '') : connection.password
		});
		this.#built = null;
		this.#outcome = null;
		this.#reportedSaveDirectory = null;
	}

	// Remote Path Mappings are read at every use rather than baked into the built client, so adding
	// one takes effect on the next read instead of waiting for the connection to change.
	client(): DownloadClient | null {
		const client = this.#unmapped();
		return client === null
			? null
			: throughRemotePathMappings(client, readRemotePathMappings(this.#db));
	}

	/**
	 * Where the Download Client last said it writes, as Pacerr sees that path. Null until one has
	 * answered, so a Pacerr with no Download Client or an unreachable one falls back to the
	 * configured mount rather than reporting a path it was never told about.
	 */
	downloadDirectory(): string | null {
		const reported = this.#reportedSaveDirectory;
		return reported === null
			? null
			: applyRemotePathMappings(readRemotePathMappings(this.#db), reported);
	}

	async test(): Promise<ConnectionTest> {
		const client = this.#unmapped();
		if (client === null) {
			this.#reportedSaveDirectory = null;
			return this.#record(unconfigured);
		}
		try {
			const outcome = this.#record(await client.test());
			// Asked on the back of the one call Pacerr makes on a cadence whether or not it wants
			// anything, which is what keeps the validated path current without a second schedule.
			this.#reportedSaveDirectory = outcome.ok ? await client.saveDirectory() : null;
			return outcome;
		} catch (error) {
			this.#reportedSaveDirectory = null;
			return this.noteFailure(error);
		}
	}

	/** How the last attempt to use the client went. Null while Pacerr has not needed it yet. */
	health(): ConnectionTest | null {
		return this.client() === null ? unconfigured : this.#outcome;
	}

	noteSuccess(): void {
		this.#record(answered);
	}

	noteFailure(error: unknown): ConnectionTest {
		return this.#record(unreachable(error));
	}

	#unmapped(): DownloadClient | null {
		const connection = readConnection(this.#db);
		if (connection === null) return null;
		if (this.#built === null || !sameConnection(this.#built.connection, connection)) {
			this.#built = { connection, client: this.#factory(connection) };
		}
		return this.#built.client;
	}

	#record(outcome: ConnectionTest): ConnectionTest {
		this.#outcome = outcome;
		return outcome;
	}
}

const sameConnection = (
	left: DownloadClientConnection,
	right: DownloadClientConnection
): boolean =>
	left.url === right.url && left.username === right.username && left.password === right.password;

