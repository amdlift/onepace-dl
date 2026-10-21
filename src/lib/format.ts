const timestamp = new Intl.DateTimeFormat('en-CA', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
	timeZoneName: 'short'
});

export function formatTimestamp(value: Date | null): string {
	if (value === null) return 'never';
	return timestamp.format(value).replace(',', '');
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
	let scaled = bytes;
	let unit = 0;
	while (scaled >= 1024 && unit < byteUnits.length - 1) {
		scaled /= 1024;
		unit += 1;
	}
	return `${unit === 0 ? scaled : scaled.toFixed(1)} ${byteUnits[unit]}`;
}

export function formatResolution(resolution: number | null): string {
	return resolution === null ? 'unknown' : `${resolution}p`;
}

export function formatResolutionOrder(resolutions: number[]): string {
	return resolutions.map(formatResolution).join(', then ');
}

export function formatVariant(variant: 'regular' | 'extended' | 'alternate'): string {
	return { regular: 'Regular', extended: 'Extended', alternate: 'Alternate' }[variant];
}

export function formatReleaseStatus(status: 'current' | 'outdated' | 'to-be-redone'): string {
	return { current: 'Current', outdated: 'Outdated', 'to-be-redone': 'To Be Redone' }[status];
}

export function formatWantedState(state: 'missing' | 'available' | 'unreleased'): string {
	return {
		missing: 'No Release',
		available: 'Release available',
		unreleased: 'Not released yet'
	}[state];
}

interface CoverageLike {
	terms: ({ from: number; to: number } | { text: string })[];
	coverStories: boolean;
}

export function formatCoverage(coverage: CoverageLike | null): string | null {
	if (coverage === null || coverage.terms.length === 0) return null;
	const terms = coverage.terms.map(formatTerm).join(', ');
	return coverage.coverStories ? `${terms} cover stories` : terms;
}

function formatTerm(term: CoverageLike['terms'][number]): string {
	if ('text' in term) return term.text;
	return term.from === term.to ? `${term.from}` : `${term.from}–${term.to}`;
}

export function formatProgress(progress: number | null): string {
	return progress === null ? '—' : `${Math.floor(progress * 100)}%`;
}

export function formatDownloadState(
	state: 'downloading' | 'completed' | 'failed' | 'unknown'
): string {
	return {
		downloading: 'Downloading',
		completed: 'Completed',
		failed: 'Failed',
		unknown: 'Unknown'
	}[state];
}

export function formatHistoryEvent(
	event: 'grab' | 'import' | 'upgrade' | 'manualImport',
	outcome: 'succeeded' | 'warned' | 'failed'
): string {
	const past = {
		grab: 'Grabbed',
		import: 'Imported',
		upgrade: 'Upgraded',
		manualImport: 'Manually imported'
	}[event];
	if (outcome === 'succeeded') return past;
	return outcome === 'failed' ? `Failed to ${verbOf(event)}` : `${past}, with a warning`;
}

const verbOf = (event: 'grab' | 'import' | 'upgrade' | 'manualImport'): string =>
	({ grab: 'grab', import: 'import', upgrade: 'upgrade', manualImport: 'import' })[event];
