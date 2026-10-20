import type { Database } from 'better-sqlite3';
import { reasonOf } from '../failure';
import type { Runtime } from '../runtime';
import { fetchWatchPage } from './source';
import {
	readArcs,
	readSource,
	recordCheck,
	recordFailure,
	replaceCatalogue,
	type ScrapeOutcome
} from './store';
import { parseCatalogue } from './watch-page';
import { assignLibraryIndexes } from '../library/store';

export type { ScrapeOutcome } from './store';

export interface ArcListing {
	slug: string;
	title: string;
	partCount: number;
	unreleasedPartCount: number;
	coverImageUrl: string | null;
	special: boolean;
	unfinished: boolean;
}

export interface CatalogueView {
	arcs: ArcListing[];
	checkedAt: Date | null;
	updatedAt: Date | null;
	outcome: ScrapeOutcome | null;
	failure: string | null;
}

export class CatalogueService {
	#db: Database;
	#runtime: Runtime;

	constructor(db: Database, runtime: Runtime) {
		this.#db = db;
		this.#runtime = runtime;
	}

	async scrape(): Promise<ScrapeOutcome> {
		const at = this.#runtime.clock.now();
		const stored = readSource(this.#db);

		let fetched;
		try {
			fetched = await fetchWatchPage(this.#runtime.onePaceBaseUrl, stored);
		} catch (error) {
			recordFailure(this.#db, at, 'unreachable', reasonOf(error));
			return 'unreachable';
		}

		if (fetched.kind === 'unchanged') {
			recordCheck(this.#db, at, fetched.validators, 'unchanged');
			return 'unchanged';
		}

		try {
			const catalogue = parseCatalogue(fetched.body);
			replaceCatalogue(this.#db, catalogue, at, fetched.validators);
			assignLibraryIndexes(this.#db);
			return 'updated';
		} catch (error) {
			recordFailure(this.#db, at, 'unparsed', reasonOf(error));
			return 'unparsed';
		}
	}

	view(): CatalogueView {
		const source = readSource(this.#db);
		return {
			arcs: readArcs(this.#db).map((arc) => ({
				slug: arc.slug,
				title: arc.title,
				partCount: arc.partCount,
				unreleasedPartCount: arc.unreleasedPartCount,
				coverImageUrl:
					arc.coverImagePath === null
						? null
						: new URL(arc.coverImagePath, this.#runtime.onePaceBaseUrl).href,
				special: arc.special,
				unfinished: arc.unfinished
			})),
			checkedAt: source.checkedAt,
			updatedAt: source.updatedAt,
			outcome: source.outcome,
			failure: source.failure
		};
	}
}

