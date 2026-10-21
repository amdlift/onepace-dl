import { join } from 'node:path';
import { Posters } from './artwork';
import { AuthenticationService } from './auth/service';
import { Background } from './background';
import { CatalogueService } from './catalogue/service';
import { openDatabase, type Database } from './db/database';
import { AcquisitionService } from './download/acquisition';
import { DownloadService } from './download/service';
import { ImportService } from './library/import';
import { LibraryMoveService } from './library/move';
import { assignLibraryIndexes } from './library/store';
import { PathService } from './paths/service';
import { openConfigDirectory, reportPathValidation, validatePaths } from './paths/validation';
import { ReleaseService } from './releases/service';
import type { Runtime } from './runtime';
import { Scheduler } from './scheduler';

export const catalogueJob = 'catalogue';
export const feedJob = 'feed';
export const importJob = 'import';
export const downloadClientJob = 'downloadClient';

export interface App {
	runtime: Runtime;
	db: Database;
	catalogue: CatalogueService;
	posters: Posters;
	releases: ReleaseService;
	authentication: AuthenticationService;
	downloads: DownloadService;
	acquisition: AcquisitionService;
	imports: ImportService;
	paths: PathService;
	moves: LibraryMoveService;
	scheduler: Scheduler;
	/** Work a request started and did not wait for; seam 1 awaits it rather than racing it. */
	background: Background;
	/** Resolves once the startup scrape has run; the HTTP surface waits on it. */
	ready: Promise<void>;
	stop(): void;
}

export function createApp(runtime: Runtime): App {
	openConfigDirectory(runtime.paths.config);
	const db = openDatabase(join(runtime.paths.config, 'pacerr.db'));
	assignLibraryIndexes(db);
	const paths = new PathService(db, runtime.paths, runtime.environmentPaths);
	const catalogue = new CatalogueService(db, runtime, paths);
	const posters = new Posters(runtime.paths.config);
	const releases = new ReleaseService(db, runtime);
	const authentication = new AuthenticationService(
		db,
		runtime.clock,
		runtime.environmentCredentials
	);
	const downloads = new DownloadService(db, runtime.downloadClients);
	const acquisition = new AcquisitionService(db, runtime.clock, downloads);
	const imports = new ImportService(db, runtime.clock, downloads, posters, paths);
	const background = new Background();
	const moves = new LibraryMoveService(db, runtime.clock, paths, background);
	moves.recordInterruption();
	const scheduler = new Scheduler(runtime.clock);
	scheduler.add({
		name: catalogueJob,
		every: runtime.catalogueRefreshInterval,
		run: async () => {
			await catalogue.scrape();
			await acquisition.run();
		}
	});
	scheduler.add({
		name: feedJob,
		every: runtime.feedPollInterval,
		run: async () => {
			// A Release the Catalogue cannot explain was published since the last scrape, so waiting
			// for tomorrow's would leave it unmatched for a day.
			if ((await releases.poll()).unknownInfohashes.length > 0) await catalogue.scrape();
			await acquisition.run();
		}
	});
	scheduler.add({
		name: importJob,
		every: runtime.feedPollInterval,
		run: () => imports.run()
	});
	// Nothing else reaches the Download Client when there is nothing to grab, so without this an
	// unreachable one would stay invisible for as long as Pacerr happened to want nothing.
	scheduler.add({
		name: downloadClientJob,
		every: runtime.feedPollInterval,
		run: async () => {
			await downloads.test();
		}
	});

	return {
		runtime,
		db,
		catalogue,
		posters,
		releases,
		authentication,
		downloads,
		acquisition,
		imports,
		paths,
		moves,
		scheduler,
		background,
		ready: (async () => {
			// Before anything else, because the download directory worth validating is the one the
			// Download Client will report, and only asking it produces that path.
			await downloads.test();
			reportPathValidation(validatePaths(paths.current(), downloads.downloadDirectory()));
			await scheduler.tick();
			if (runtime.polls) scheduler.startPolling();
		})(),
		stop() {
			background.stop();
			scheduler.stop();
			db.close();
		}
	};
}
