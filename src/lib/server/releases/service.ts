import type { Database } from 'better-sqlite3';
import type { Runtime } from '../runtime';
import { UpstreamSource, type UpstreamDocument } from '../upstream/service';
import type { UpstreamOutcome } from '../upstream/store';
import { parseFeed, readLastBuildDate, type FeedRelease } from './feed';
import {
	readInfohashes,
	readUnknownInfohashes,
	readUnmatchedCounts,
	readUnmatchedReleases,
	replaceReleases,
	type UnmatchedCounts,
	type UnmatchedRelease
} from './store';

export interface PollResult {
	outcome: UpstreamOutcome;
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
	outcome: UpstreamOutcome | null;
	failure: string | null;
}

const feed = (db: Database): UpstreamDocument<FeedRelease[]> => ({
	name: 'feed',
	path: '/en/releases/rss.xml',
	subject: 'the release feed',
	// The feed dates its own build, which is cheaper and more honest than hashing a document whose
	// bytes can differ without a Release having changed.
	freshnessOf: (body) => readLastBuildDate(body)?.toISOString() ?? null,
	parse: parseFeed,
	replace: (releases, at, validators, freshness) =>
		replaceReleases(db, releases, at, validators, freshness)
});

export class ReleaseService {
	#db: Database;
	#source: UpstreamSource<FeedRelease[]>;

	constructor(db: Database, runtime: Runtime) {
		this.#db = db;
		this.#source = new UpstreamSource(db, runtime, feed(db));
	}

	async poll(): Promise<PollResult> {
		// Read before the poll replaces them, so what comes back is what this poll brought in
		// rather than everything the Catalogue has never explained.
		const known = readInfohashes(this.#db);
		const outcome = await this.#source.check();
		return {
			outcome,
			unknownInfohashes:
				outcome === 'updated'
					? readUnknownInfohashes(this.#db).filter((it) => !known.has(it))
					: []
		};
	}

	view(): FeedView {
		const source = this.#source.state();
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
