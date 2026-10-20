import type { Database } from 'better-sqlite3';
import type { Runtime } from '../runtime';
import { parseFeed, readLastBuildDate } from './feed';
import { fetchFeed } from './source';
import {
	readFeedSource,
	readInfohashes,
	readUnknownInfohashes,
	readUnmatchedCounts,
	readUnmatchedReleases,
	recordFeedCheck,
	recordFeedFailure,
	replaceReleases,
	type PollOutcome,
	type UnmatchedCounts,
	type UnmatchedRelease
} from './store';

export type { PollOutcome } from './store';

export interface PollResult {
	outcome: PollOutcome;
	/** Infohashes the Catalogue has never explained, which only a fresh scrape could. */
	unknownInfohashes: string[];
}

export interface UnmatchedReleases {
	total: number;
	/** The ones One Pace still publishes as current, which are the ones worth a person's time. */
	current: UnmatchedRelease[];
	/** Superseded Releases One Pace delisted from the watch page but left in the feed. */
	delisted: UnmatchedRelease[];
}

export interface FeedView {
	releaseCount: number;
	checkedAt: Date | null;
	updatedAt: Date | null;
	outcome: PollOutcome | null;
	failure: string | null;
}

export class ReleaseService {
	#db: Database;
	#runtime: Runtime;

	constructor(db: Database, runtime: Runtime) {
		this.#db = db;
		this.#runtime = runtime;
	}

	async poll(): Promise<PollResult> {
		const at = this.#runtime.clock.now();
		const stored = readFeedSource(this.#db);

		let fetched;
		try {
			fetched = await fetchFeed(this.#runtime.onePaceBaseUrl, stored);
		} catch (error) {
			recordFeedFailure(this.#db, at, 'unreachable', reasonOf(error));
			return { outcome: 'unreachable', unknownInfohashes: [] };
		}

		if (fetched.kind === 'unchanged') {
			recordFeedCheck(this.#db, at, fetched.validators, stored.lastBuildDate, 'unchanged');
			return { outcome: 'unchanged', unknownInfohashes: [] };
		}

		try {
			const lastBuildDate = readLastBuildDate(fetched.body);
			if (lastBuildDate !== null && sameMoment(lastBuildDate, stored.lastBuildDate)) {
				recordFeedCheck(this.#db, at, fetched.validators, lastBuildDate, 'unchanged');
				return { outcome: 'unchanged', unknownInfohashes: [] };
			}

			const known = readInfohashes(this.#db);
			const releases = parseFeed(fetched.body).releases;
			replaceReleases(this.#db, releases, at, fetched.validators, lastBuildDate);
			return {
				outcome: 'updated',
				unknownInfohashes: readUnknownInfohashes(this.#db).filter((it) => !known.has(it))
			};
		} catch (error) {
			recordFeedFailure(this.#db, at, 'unparsed', reasonOf(error));
			return { outcome: 'unparsed', unknownInfohashes: [] };
		}
	}

	view(): FeedView {
		const source = readFeedSource(this.#db);
		const count = this.#db.prepare('select count(*) as n from feed_release').get() as { n: number };
		return {
			releaseCount: count.n,
			checkedAt: source.checkedAt,
			updatedAt: source.updatedAt,
			outcome: source.outcome,
			failure: source.failure
		};
	}

	unmatched(): UnmatchedReleases {
		const releases = readUnmatchedReleases(this.#db);
		return {
			total: releases.length,
			current: releases.filter((release) => release.status !== 'outdated'),
			delisted: releases.filter((release) => release.status === 'outdated')
		};
	}

	unmatchedCounts(): UnmatchedCounts {
		return readUnmatchedCounts(this.#db);
	}
}

const sameMoment = (left: Date, right: Date | null): boolean =>
	right !== null && left.getTime() === right.getTime();

const reasonOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
