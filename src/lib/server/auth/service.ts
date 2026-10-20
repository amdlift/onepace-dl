import { randomBytes } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Clock } from '../clock';
import { hashPassword, passwordMatches } from './password';

export interface Credentials {
	username: string;
	password: string;
}

export type CredentialSource = 'settings' | 'environment';

export interface AuthenticationState {
	enabled: boolean;
	username: string | null;
	source: CredentialSource;
}

export interface Session {
	id: string;
	expiresAt: Date;
}

export type ConfigureOutcome = { ok: true } | { ok: false; problem: string };

interface AccountRow {
	enabled: number;
	username: string | null;
	password_hash: string | null;
}

const sessionLifetime = 30 * 24 * 60 * 60 * 1000;

/** The one account Pacerr has, and the sessions it has handed out. */
export class AuthenticationService {
	#db: Database;
	#clock: Clock;
	#environment: Credentials | null;
	#environmentHash: Promise<string> | null = null;

	constructor(db: Database, clock: Clock, environment: Credentials | null) {
		this.#db = db;
		this.#clock = clock;
		this.#environment = environment;
	}

	state(): AuthenticationState {
		if (this.#environment !== null) {
			return { enabled: true, username: this.#environment.username, source: 'environment' };
		}
		const account = this.#account();
		return { enabled: account.enabled === 1, username: account.username, source: 'settings' };
	}

	async configure(wanted: {
		enabled: boolean;
		username: string;
		password: string;
	}): Promise<ConfigureOutcome> {
		if (this.#environment !== null) {
			return { ok: false, problem: 'Authentication is configured by environment variable.' };
		}
		const account = this.#account();
		const offered = wanted.username.trim();
		const username = offered === '' ? account.username : offered;
		const passwordHash =
			wanted.password === '' ? account.password_hash : await hashPassword(wanted.password);
		if (wanted.enabled && (username === null || passwordHash === null)) {
			return { ok: false, problem: 'A username and a password are needed to require a login.' };
		}
		this.#db
			.prepare('update authentication set enabled = ?, username = ?, password_hash = ? where id = 1')
			.run(wanted.enabled ? 1 : 0, username, passwordHash);
		return { ok: true };
	}

	async logIn(username: string, password: string): Promise<Session | null> {
		const state = this.state();
		if (!state.enabled || username !== state.username) return null;
		const hash =
			this.#environment === null ? this.#account().password_hash : await this.#environmentCopy();
		if (hash === null || !(await passwordMatches(password, hash))) return null;
		return this.startSession();
	}

	startSession(): Session {
		const now = this.#clock.now();
		const session = {
			id: randomBytes(32).toString('base64url'),
			expiresAt: new Date(now.getTime() + sessionLifetime)
		};
		this.#db
			.prepare('insert into session (id, created_at, expires_at) values (?, ?, ?)')
			.run(session.id, now.toISOString(), session.expiresAt.toISOString());
		return session;
	}

	recognises(sessionId: string): boolean {
		this.#db
			.prepare('delete from session where expires_at <= ?')
			.run(this.#clock.now().toISOString());
		return this.#db.prepare('select 1 from session where id = ?').get(sessionId) !== undefined;
	}

	endSession(sessionId: string): void {
		this.#db.prepare('delete from session where id = ?').run(sessionId);
	}

	// Credentials given by environment variable are the operator's to hold in plain text; Pacerr's
	// own copy is hashed like any other, and never reaches the config volume.
	#environmentCopy(): Promise<string> {
		this.#environmentHash ??= hashPassword((this.#environment as Credentials).password);
		return this.#environmentHash;
	}

	#account(): AccountRow {
		return this.#db.prepare('select * from authentication where id = 1').get() as AccountRow;
	}
}
