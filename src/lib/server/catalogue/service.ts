import { createHash } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Posters } from '../artwork';
import { refreshSidecars } from '../library/sidecars';
import { assignLibraryIndexes } from '../library/store';
import type { PathService } from '../paths/service';
import type { Runtime } from '../runtime';
import { UpstreamSource, type UpstreamDocument } from '../upstream/service';
import type { UpstreamOutcome } from '../upstream/store';
import { readArcs, replaceCatalogue } from './store';
import { parseCatalogue, type Catalogue } from './watch-page';

export interface ArcListing {
	slug: string;
	title: string;
	description: string | null;
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
	outcome: UpstreamOutcome | null;
	failure: string | null;
}

const watchPage = (
	db: Database,
	posters: Posters,
	paths: PathService
): UpstreamDocument<Catalogue> => ({
	name: 'catalogue',
	path: '/en/watch',
	subject: 'the watch page',
	// The watch page states nothing about its own age, so the only thing that can tell a reparse
	// from a wasted one is the body Pacerr has already paid for.
	freshnessOf: (body) => createHash('sha256').update(body).digest('hex'),
	parse: parseCatalogue,
	// Reached only by a scrape that fetched and parsed, so a Library is corrected from a
	// Catalogue that arrived whole and never from a failed or half-read one.
	replace: (catalogue, at, validators, freshness) => {
		replaceCatalogue(db, catalogue, at, validators, freshness);
		assignLibraryIndexes(db);
		refreshSidecars(db, posters, paths.library().path);
	}
});

export class CatalogueService {
	#db: Database;
	#runtime: Runtime;
	#source: UpstreamSource<Catalogue>;

	constructor(db: Database, runtime: Runtime, posters: Posters, paths: PathService) {
		this.#db = db;
		this.#runtime = runtime;
		this.#source = new UpstreamSource(db, runtime, watchPage(db, posters, paths));
	}

	scrape(): Promise<UpstreamOutcome> {
		return this.#source.check();
	}

	view(): CatalogueView {
		const source = this.#source.state();
		return {
			arcs: readArcs(this.#db).map((arc) => ({
				slug: arc.slug,
				title: arc.title,
				description: arc.description,
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
