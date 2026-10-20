import type { Database } from 'better-sqlite3';
import { reasonOf } from '../failure';
import type { Runtime } from '../runtime';
import { fetchUpstream, type Validators } from './source';
import {
	readUpstream,
	recordUpstreamCheck,
	recordUpstreamFailure,
	type StoredUpstream,
	type UpstreamName,
	type UpstreamOutcome
} from './store';

/**
 * One document One Pace publishes, and what Pacerr does with it once it has the bytes. The two —
 * the watch page and the release feed — differ in exactly these four answers; everything around
 * them is the same check on the same cadence with the same four outcomes.
 */
export interface UpstreamDocument<T> {
	name: UpstreamName;
	path: string;
	/** Names the document in a diagnostic: "One Pace answered 503 to the watch page". */
	subject: string;
	/**
	 * What the document says about its own age, to be compared against what is stored. The feed
	 * states a `lastBuildDate`; the watch page states nothing, so this hashes the body. Null is a
	 * document that offered nothing, which means parse it and find out.
	 */
	freshnessOf(body: string): string | null;
	parse(body: string): T;
	/** Replaces everything derived from the document, and records the update, in one transaction. */
	replace(parsed: T, at: Date, validators: Validators, freshness: string | null): void;
}

/**
 * The poll every upstream document gets: fetch it conditionally, tell "nothing new" from "One Pace
 * changed shape" from "One Pace did not answer", and leave the last good copy standing unless a
 * parse succeeded.
 */
export class UpstreamSource<T> {
	#db: Database;
	#runtime: Runtime;
	#document: UpstreamDocument<T>;

	constructor(db: Database, runtime: Runtime, document: UpstreamDocument<T>) {
		this.#db = db;
		this.#runtime = runtime;
		this.#document = document;
	}

	state(): StoredUpstream {
		return readUpstream(this.#db, this.#document.name);
	}

	async check(): Promise<UpstreamOutcome> {
		const { name, path, subject } = this.#document;
		const at = this.#runtime.clock.now();
		const stored = readUpstream(this.#db, name);

		let fetched;
		try {
			fetched = await fetchUpstream(
				{ url: new URL(path, this.#runtime.onePaceBaseUrl), subject },
				stored
			);
		} catch (error) {
			recordUpstreamFailure(this.#db, name, at, 'unreachable', reasonOf(error));
			return 'unreachable';
		}

		if (fetched.kind === 'unchanged') {
			recordUpstreamCheck(this.#db, name, at, fetched.validators, stored.freshness, 'unchanged');
			return 'unchanged';
		}

		let freshness: string | null;
		let parsed: T;
		try {
			freshness = this.#document.freshnessOf(fetched.body);
			if (freshness !== null && freshness === stored.freshness) {
				recordUpstreamCheck(this.#db, name, at, fetched.validators, freshness, 'unchanged');
				return 'unchanged';
			}
			parsed = this.#document.parse(fetched.body);
		} catch (error) {
			recordUpstreamFailure(this.#db, name, at, 'unparsed', reasonOf(error));
			return 'unparsed';
		}

		this.#document.replace(parsed, at, fetched.validators, freshness);
		return 'updated';
	}
}
