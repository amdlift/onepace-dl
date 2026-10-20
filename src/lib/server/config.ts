import { resolve } from 'node:path';
import type { Credentials } from './auth/service';
import { systemClock } from './clock';
import type { DownloadClient } from './download-client';
import type { Runtime } from './runtime';

const minutes = (count: number): number => count * 60 * 1000;
const hours = (count: number): number => minutes(count) * 60;

const unconfiguredDownloadClient: DownloadClient = {
	add: () => unconfigured(),
	setFilePriority: () => unconfigured(),
	statusOf: () => unconfigured(),
	remove: () => unconfigured(),
	test: () => unconfigured()
};

const unconfigured = (): never => {
	throw new Error('no Download Client is configured');
};

export function runtimeFromEnvironment(environment = process.env): Runtime {
	return {
		clock: systemClock,
		downloadClient: unconfiguredDownloadClient,
		onePaceBaseUrl: environment.PACERR_ONEPACE_URL ?? 'https://onepace.net',
		paths: {
			config: resolve(environment.PACERR_CONFIG_DIR ?? '/config'),
			library: resolve(environment.PACERR_LIBRARY_DIR ?? '/library'),
			downloads: resolve(environment.PACERR_DOWNLOADS_DIR ?? '/downloads')
		},
		catalogueRefreshInterval: numberFrom(environment.PACERR_CATALOGUE_INTERVAL_HOURS, 24, hours),
		feedPollInterval: numberFrom(environment.PACERR_FEED_INTERVAL_MINUTES, 15, minutes),
		polls: true,
		environmentCredentials: credentialsFrom(environment)
	};
}

function credentialsFrom(environment: NodeJS.ProcessEnv): Credentials | null {
	const username = environment.PACERR_AUTH_USERNAME;
	const password = environment.PACERR_AUTH_PASSWORD;
	if (username === undefined || password === undefined) return null;
	return { username, password };
}

function numberFrom(
	value: string | undefined,
	fallback: number,
	scale: (count: number) => number
): number {
	const parsed = value === undefined ? Number.NaN : Number(value);
	return scale(Number.isFinite(parsed) ? parsed : fallback);
}
