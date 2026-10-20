import { pluralise } from '../../format';
import type { App } from '../app';
import { readSource, type ScrapeOutcome } from '../catalogue/store';
import type { ConnectionFailure, ConnectionTest } from '../download/client';
import { validatePaths, type DirectoryCheck } from '../paths/validation';
import { readFeedSource, type PollOutcome } from '../releases/store';

/** `warned` is for something a person should know about but which is not Pacerr being broken. */
export type HealthStatus = 'ok' | 'warned' | 'failed';

export type HealthCheckName =
	| 'catalogue'
	| 'feed'
	| 'downloadClient'
	| 'unmatched'
	| 'configDirectory'
	| 'libraryDirectory'
	| 'downloadsDirectory'
	| 'hardlinking';

export interface HealthCheck {
	name: HealthCheckName;
	subject: string;
	status: HealthStatus;
	/** How the last attempt ended, in two or three words. */
	outcome: string;
	summary: string;
	detail: string | null;
	at: Date | null;
}

export function healthChecks(app: App): HealthCheck[] {
	return [
		catalogueCheck(app),
		feedCheck(app),
		downloadClientCheck(app),
		unmatchedCheck(app),
		...pathChecks(app)
	];
}

const directoryChecks: Record<DirectoryCheck['directory'], HealthCheckName> = {
	config: 'configDirectory',
	library: 'libraryDirectory',
	downloads: 'downloadsDirectory'
};

const directoryOutcomes: Record<DirectoryCheck['condition'], string> = {
	ok: 'Writable',
	missing: 'Not mounted',
	unwritable: 'Not writable'
};

/**
 * Re-derived from the filesystem on every request, so mounting the missing volume or fixing the
 * ownership clears the banner without anything having to be acknowledged.
 */
function pathChecks(app: App): HealthCheck[] {
	const validation = validatePaths(app.runtime.paths, app.downloads.downloadDirectory());
	const directories = validation.directories.map(
		(directory): HealthCheck => ({
			name: directoryChecks[directory.directory],
			subject: directory.subject,
			status: directory.condition === 'ok' ? 'ok' : 'failed',
			outcome: directoryOutcomes[directory.condition],
			summary: directory.diagnostic,
			detail: null,
			at: null
		})
	);
	return [
		...directories,
		{
			name: 'hardlinking',
			subject: 'Hardlinking',
			// A permanently true fact about how the volumes are mounted, not a fault to chase.
			status: validation.hardlinking.sameFilesystem ? 'ok' : 'warned',
			outcome: validation.hardlinking.sameFilesystem ? 'Available' : 'Copies instead',
			summary: validation.hardlinking.diagnostic,
			detail: null,
			at: null
		}
	];
}

export const failingChecks = (checks: HealthCheck[]): HealthCheck[] =>
	checks.filter((check) => check.status === 'failed');

interface Reading {
	status: HealthStatus;
	outcome: string;
	summary: string;
}

const notYet: Reading = {
	status: 'ok',
	outcome: 'Not yet attempted',
	summary: 'Pacerr has not scraped the One Pace watch page yet.'
};

/**
 * The distinction ADR-0002 exists for. A scrape that parses and finds nothing is a quiet month
 * upstream; a scrape that fetches and no longer parses is the silent failure that otherwise reads
 * as a quiet month for a year.
 */
const scrapeReadings: Record<ScrapeOutcome, Reading> = {
	updated: {
		status: 'ok',
		outcome: 'Updated',
		summary: 'The watch page parsed cleanly and the Catalogue was replaced with what it publishes.'
	},
	unchanged: {
		status: 'ok',
		outcome: 'No new Parts',
		summary: 'The watch page has not changed, so One Pace has announced no new Parts.'
	},
	unparsed: {
		status: 'failed',
		outcome: 'Upstream changed shape',
		summary:
			'The One Pace watch page was fetched but no longer parses, so Pacerr has stopped ' +
			'discovering Parts. This is upstream changing shape, not a quiet month.'
	},
	unreachable: {
		status: 'failed',
		outcome: 'One Pace unreachable',
		summary: 'One Pace did not answer, so the Catalogue has not been scraped.'
	}
};

function catalogueCheck(app: App): HealthCheck {
	const source = readSource(app.db);
	const reading = source.outcome === null ? notYet : scrapeReadings[source.outcome];
	return {
		name: 'catalogue',
		subject: 'Catalogue scrape',
		...reading,
		detail: source.failure,
		at: source.checkedAt
	};
}

const notPolled: Reading = {
	status: 'ok',
	outcome: 'Not yet attempted',
	summary: 'Pacerr has not read the One Pace release feed yet.'
};

const pollReadings: Record<PollOutcome, Reading> = {
	updated: {
		status: 'ok',
		outcome: 'Updated',
		summary: 'The release feed parsed cleanly and Pacerr holds every Release it publishes.'
	},
	unchanged: {
		status: 'ok',
		outcome: 'No new Releases',
		summary: 'The feed has not been rebuilt, so One Pace has published no new Releases.'
	},
	unparsed: {
		status: 'failed',
		outcome: 'Upstream changed shape',
		summary:
			'The One Pace release feed was fetched but no longer parses, so Pacerr has stopped ' +
			'seeing new Releases. This is upstream changing shape, not a quiet week.'
	},
	unreachable: {
		status: 'failed',
		outcome: 'One Pace unreachable',
		summary: 'One Pace did not answer, so the release feed has not been read.'
	}
};

function feedCheck(app: App): HealthCheck {
	const source = readFeedSource(app.db);
	const reading = source.outcome === null ? notPolled : pollReadings[source.outcome];
	return {
		name: 'feed',
		subject: 'Release feed',
		...reading,
		detail: source.failure,
		at: source.checkedAt
	};
}

const connectionReadings: Record<ConnectionFailure, Reading> = {
	// A fresh Pacerr has no Download Client and that is not a fault, so it never raises the banner.
	unconfigured: {
		status: 'warned',
		outcome: 'Not configured',
		summary: 'No Download Client is configured, so nothing can be grabbed.'
	},
	unreachable: {
		status: 'failed',
		outcome: 'Unreachable',
		summary: 'The Download Client did not answer, so nothing can be grabbed or imported.'
	},
	credentials: {
		status: 'failed',
		outcome: 'Credentials rejected',
		summary: 'The Download Client did not accept the username and password in Settings.'
	},
	banned: {
		status: 'failed',
		outcome: 'Banned',
		summary: 'The Download Client has banned this address after too many failed logins.'
	},
	rejected: {
		status: 'failed',
		outcome: 'Not a Download Client',
		summary: 'The configured address answered, but not like a Download Client.'
	}
};

const answering: Reading = {
	status: 'ok',
	outcome: 'Reachable',
	summary: 'The Download Client answered the last time Pacerr spoke to it.'
};

const notSpokenTo: Reading = {
	status: 'ok',
	outcome: 'Not yet used',
	summary: 'Pacerr has not needed the Download Client yet.'
};

function downloadClientCheck(app: App): HealthCheck {
	const connection: ConnectionTest | null = app.downloads.health();
	return {
		name: 'downloadClient',
		subject: 'Download Client',
		...readingOf(connection),
		detail: connection?.detail ?? null,
		at: null
	};
}

function readingOf(connection: ConnectionTest | null): Reading {
	if (connection === null) return notSpokenTo;
	return connection.ok ? answering : connectionReadings[connection.failure];
}

const allPlaced: Reading = {
	status: 'ok',
	outcome: 'All placed',
	summary: 'Every Release the feed still calls current is accounted for in the Catalogue.'
};

/**
 * Counted against the current ones alone. Most of the feed is superseded Releases One Pace delisted
 * years ago, so a check on the whole population would read as broken from the first run and stop
 * being read at all.
 *
 * What is left is still permanent: the current ones are Releases the feed carries and the watch
 * page has never listed, and no action by the operator will change that. The copy therefore states
 * a fact about what upstream publishes rather than a fault awaiting repair, because this check
 * never clears and #13 would otherwise be read as broken.
 */
function unmatchedCheck(app: App): HealthCheck {
	const counts = app.releases.unmatchedCounts();
	return {
		name: 'unmatched',
		subject: 'Unmatched Releases',
		...(counts.current === 0
			? allPlaced
			: {
					status: 'warned' as const,
					outcome: `${counts.current} not in the Catalogue`,
					summary:
						`One Pace's feed carries ${pluralise(counts.current, 'Release')} that its watch ` +
						'page has never listed, so Pacerr cannot tell which Parts they cover. That is how ' +
						'upstream publishes rather than something to fix, and they are listed below.'
				}),
		detail: null,
		at: null
	};
}
