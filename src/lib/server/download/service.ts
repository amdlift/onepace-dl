import type { Database } from 'better-sqlite3';
import type {
	ConnectionTest,
	DownloadClient,
	DownloadClientConnection,
	DownloadClientFactory
} from './client';
import {
	readRemotePathMappings,
	throughRemotePathMappings
} from '../paths/remote-path-mapping';
import { readConnection, writeConnection } from './connection';

/** What Settings shows about the connection. The password is never rendered back. */
export interface ConnectionView {
	url: string;
	username: string;
}

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
	}

	client(): DownloadClient | null {
		const connection = readConnection(this.#db);
		if (connection === null) return null;
		if (this.#built === null || !sameConnection(this.#built.connection, connection)) {
			this.#built = { connection, client: this.#factory(connection) };
		}
		return throughRemotePathMappings(this.#built.client, readRemotePathMappings(this.#db));
	}

	async test(): Promise<ConnectionTest> {
		const client = this.client();
		if (client === null) return this.#record(unconfigured);
		try {
			return this.#record(await client.test());
		} catch (error) {
			return this.noteFailure(error);
		}
	}

	/** How the last attempt to use the client went. Null while Pacerr has not needed it yet. */
	health(): ConnectionTest | null {
		return this.client() === null ? unconfigured : this.#outcome;
	}

	noteSuccess(): void {
		this.#record({ ok: true, detail: 'The Download Client answered.' });
	}

	noteFailure(error: unknown): ConnectionTest {
		return this.#record({
			ok: false,
			failure: 'unreachable',
			detail: `The Download Client is unreachable: ${reasonOf(error)}`
		});
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

export const reasonOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
