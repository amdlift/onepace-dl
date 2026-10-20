import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { AuthenticationService } from './auth/service';
import { CatalogueService } from './catalogue/service';
import { openDatabase, type Database } from './db/database';
import { MonitoringService } from './monitoring/service';
import { ReleaseService } from './releases/service';
import type { Runtime } from './runtime';
import { Scheduler } from './scheduler';

export const catalogueJob = 'catalogue';
export const feedJob = 'feed';

export interface App {
	runtime: Runtime;
	db: Database;
	catalogue: CatalogueService;
	releases: ReleaseService;
	monitoring: MonitoringService;
	authentication: AuthenticationService;
	scheduler: Scheduler;
	/** Resolves once the startup scrape has run; the HTTP surface waits on it. */
	ready: Promise<void>;
	stop(): void;
}

export function createApp(runtime: Runtime): App {
	mkdirSync(runtime.paths.config, { recursive: true });
	const db = openDatabase(join(runtime.paths.config, 'pacerr.db'));
	const catalogue = new CatalogueService(db, runtime);
	const releases = new ReleaseService(db, runtime);
	const monitoring = new MonitoringService(db);
	const authentication = new AuthenticationService(
		db,
		runtime.clock,
		runtime.environmentCredentials
	);
	const scheduler = new Scheduler(runtime.clock);
	scheduler.add({
		name: catalogueJob,
		every: runtime.catalogueRefreshInterval,
		run: async () => void (await catalogue.scrape())
	});
	scheduler.add({
		name: feedJob,
		every: runtime.feedPollInterval,
		run: async () => {
			// A Release the Catalogue cannot explain was published since the last scrape, so waiting
			// for tomorrow's would leave it unmatched for a day.
			if ((await releases.poll()).unknownInfohashes.length > 0) await catalogue.scrape();
		}
	});

	return {
		runtime,
		db,
		catalogue,
		releases,
		monitoring,
		authentication,
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
