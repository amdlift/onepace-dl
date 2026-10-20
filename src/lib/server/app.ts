import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { CatalogueService } from './catalogue/service';
import { openDatabase, type Database } from './db/database';
import type { Runtime } from './runtime';
import { Scheduler } from './scheduler';

export const catalogueJob = 'catalogue';

export interface App {
	runtime: Runtime;
	db: Database;
	catalogue: CatalogueService;
	scheduler: Scheduler;
	/** Resolves once the startup scrape has run; the HTTP surface waits on it. */
	ready: Promise<void>;
	stop(): void;
}

export function createApp(runtime: Runtime): App {
	mkdirSync(runtime.paths.config, { recursive: true });
	const db = openDatabase(join(runtime.paths.config, 'pacerr.db'));
	const catalogue = new CatalogueService(db, runtime);
	const scheduler = new Scheduler(runtime.clock);
	scheduler.add({
		name: catalogueJob,
		every: runtime.catalogueRefreshInterval,
		run: async () => void (await catalogue.scrape())
	});

	return {
		runtime,
		db,
		catalogue,
		scheduler,
		ready: (async () => {
			await scheduler.tick();
			if (runtime.polls) scheduler.startPolling();
		})(),
		stop() {
			scheduler.stop();
			db.close();
		}
	};
}
