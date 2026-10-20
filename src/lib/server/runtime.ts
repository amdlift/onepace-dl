import { createApp, type App } from './app';
import type { Credentials } from './auth/service';
import type { Clock } from './clock';
import { runtimeFromEnvironment } from './config';
import type { DownloadClient } from './download-client';

export interface RuntimePaths {
	config: string;
	library: string;
	downloads: string;
}

/** Everything Pacerr is allowed to substitute. Seam 1 replaces exactly these. */
export interface Runtime {
	clock: Clock;
	downloadClient: DownloadClient;
	onePaceBaseUrl: string;
	paths: RuntimePaths;
	catalogueRefreshInterval: number;
	polls: boolean;
	/** Credentials supplied by environment variable, which stand in for the Settings ones. */
	environmentCredentials: Credentials | null;
}

interface Slot {
	runtime: Runtime | null;
	app: App | null;
}

// The built server bundle and a test importing `src/` are two copies of this module, so the one
// live application has to hang off the realm rather than off a module-level binding.
const key = Symbol.for('pacerr.application');
const realm = globalThis as unknown as Record<symbol, Slot | undefined>;
const slot: Slot = (realm[key] ??= { runtime: null, app: null });

export function setRuntime(runtime: Runtime): void {
	stopApp();
	slot.runtime = runtime;
}

export function getRuntime(): Runtime {
	slot.runtime ??= runtimeFromEnvironment();
	return slot.runtime;
}

export function getApp(): App {
	slot.app ??= createApp(getRuntime());
	return slot.app;
}

export function stopApp(): void {
	slot.app?.stop();
	slot.app = null;
}
