import type { Database } from 'better-sqlite3';
import {
	writeEveryArcMonitored,
	readMonitoredArcs,
	readNotWantedParts,
	writeArcMonitored,
	writePartWanted
} from './store';

export class MonitoringService {
	#db: Database;

	constructor(db: Database) {
		this.#db = db;
	}

	monitoredArcs(): Set<string> {
		return readMonitoredArcs(this.#db);
	}

	toggleArc(arcSlug: string): void {
		writeArcMonitored(this.#db, arcSlug, !readMonitoredArcs(this.#db).has(arcSlug));
	}

	monitorEveryArc(): void {
		writeEveryArcMonitored(this.#db);
	}

	togglePartWanted(partSlug: string): void {
		writePartWanted(this.#db, partSlug, readNotWantedParts(this.#db).has(partSlug));
	}
}
