import type { Database } from 'better-sqlite3';
import type { Runtime } from '../runtime';
import { fetchWatchPage } from './source';
import { readArcs, readSource, recordCheck, recordFailure, replaceCatalogue } from './store';
import { parseCatalogue } from './watch-page';

export type ScrapeOutcome = 'updated' | 'unchanged' | 'failed';

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
			recordFailure(this.#db, at, reasonOf(error));
			return 'failed';
		}

		if (fetched.kind === 'unchanged') {
			recordCheck(this.#db, at, fetched.validators);
			return 'unchanged';
		}

		try {
			const catalogue = parseCatalogue(fetched.body);
			replaceCatalogue(this.#db, catalogue, at, fetched.validators);
			return 'updated';
		} catch (error) {
			recordFailure(this.#db, at, reasonOf(error));
			return 'failed';
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
			failure: source.failure
		};
	}
}

const reasonOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
