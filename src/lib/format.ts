export function formatTimestamp(value: Date | null): string {
	if (value === null) return 'never';
	const iso = value.toISOString();
	return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

export function formatResolution(resolution: number | null): string {
	return resolution === null ? 'unknown' : `${resolution}p`;
}

export function formatVariant(variant: 'regular' | 'extended' | 'alternate'): string {
	return { regular: 'Regular', extended: 'Extended', alternate: 'Alternate' }[variant];
}

export function formatReleaseStatus(status: 'current' | 'outdated' | 'to-be-redone'): string {
	return { current: 'Current', outdated: 'Outdated', 'to-be-redone': 'To Be Redone' }[status];
}

export function formatWantedState(state: 'missing' | 'available' | 'unreleased'): string {
	return {
		missing: 'Missing',
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
