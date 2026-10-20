import type {
	Arc,
	BatchScope,
	Catalogue,
	Coverage,
	CoverageTerm,
	Part
} from '../catalogue/watch-page';

export interface BatchRelease {
	infohash: string;
	arcSlug: string;
	chapters: Coverage | null;
	episodes: Coverage | null;
}

export type BatchExpansion =
	| { outcome: 'expanded'; parts: Part[] }
	| { outcome: 'partlyExpanded'; expandedParts: Part[]; undecidedParts: Part[]; reason: string }
	| { outcome: 'notExpanded'; reason: string };

export function expandBatchRelease(batch: BatchRelease, catalogue: Catalogue): BatchExpansion {
	const arc = catalogue.arcs.find((candidate) => candidate.slug === batch.arcSlug);
	if (arc === undefined)
		return notExpanded(batch, `the Catalogue lists no Arc ${batch.arcSlug} to expand it over`);
	if (arc.parts.length === 0)
		return notExpanded(batch, `the Catalogue lists no Parts under ${arc.slug}`);

	// The watch page states a Batch's coverage as Parts, while the feed states it as a chapter
	// range that routinely runs wider than the files in the torrent — Wano Act 1 holds 12 Parts
	// and reports chapters spanning all 62. Take the declared scope wherever there is one.
	const declaredParts = partsDeclaredFor(batch, catalogue, arc);
	if (declaredParts !== null) return { outcome: 'expanded', parts: declaredParts };

	// A single-Part Arc leaves only one answer, so it needs no terms to reach it — which is the
	// only way the unnumbered and one-off Arcs, some of which state no chapters at all, resolve.
	if (arc.parts.length === 1) return { outcome: 'expanded', parts: [...arc.parts] };

	if (batch.chapters === null && batch.episodes === null)
		return notExpanded(batch, 'it states neither covered chapters nor covered episodes');

	const expandedParts: Part[] = [];
	const undecidedParts: Part[] = [];
	for (const part of arc.parts) {
		const verdict = verdictOn(batch, part);
		if (verdict === 'covered') expandedParts.push(part);
		else if (verdict === 'undecided') undecidedParts.push(part);
	}

	if (undecidedParts.length > 0)
		return {
			outcome: 'partlyExpanded',
			expandedParts,
			undecidedParts,
			reason: `Batch Release ${batch.infohash} neither clearly covers nor clearly excludes ${undecidedParts.map((part) => part.slug).join(', ')}`
		};

	// An empty expansion and a failed one both yield no Parts, but only the second is worth
	// surfacing: a Batch that lands nowhere in the Arc it belongs to means something upstream moved.
	if (expandedParts.length === 0)
		return notExpanded(batch, `its range lands on no Part of ${arc.slug}`);

	return { outcome: 'expanded', parts: expandedParts };
}

const PART_RANGE = /^(\d+)-(\d+)$/;

function partsDeclaredFor(batch: BatchRelease, catalogue: Catalogue, arc: Arc): Part[] | null {
	const scope = catalogue.releases.find(
		(release) => release.infohash === batch.infohash
	)?.batchScope;
	if (scope == null) return null;
	return partsInScope(scope, arc);
}

function partsInScope(scope: BatchScope, arc: Arc): Part[] | null {
	if (scope.partRange === null) return scope.complete ? [...arc.parts] : null;
	const found = PART_RANGE.exec(scope.partRange);
	if (found === null) return null;
	const first = Number(found[1]);
	const last = Number(found[2]);
	const parts = arc.parts.filter((part) => first <= part.number && part.number <= last);
	return parts.length === 0 ? null : parts;
}

function notExpanded(batch: BatchRelease, reason: string): BatchExpansion {
	return {
		outcome: 'notExpanded',
		reason: `Batch Release ${batch.infohash} did not expand: ${reason}`
	};
}

type Verdict = 'covered' | 'uncovered' | 'undecided';

function verdictOn(batch: BatchRelease, part: Part): Verdict {
	// Chapters decide wherever both sides state them. One Pace cuts its Parts on chapter
	// boundaries but not on episode ones, so neighbouring Parts routinely share an anime episode
	// and episode terms alone cannot tell two adjacent Parts apart.
	const byChapter = verdictOnAxis(batch.chapters, part.chapters);
	if (byChapter !== 'incomparable') return byChapter;
	const byEpisode = verdictOnAxis(batch.episodes, part.episodes);
	return byEpisode === 'incomparable' ? 'undecided' : byEpisode;
}

function verdictOnAxis(batch: Coverage | null, part: Coverage | null): Verdict | 'incomparable' {
	if (batch === null || part === null || part.terms.length === 0) return 'incomparable';
	// Cover-story numbers run over the same integers as ordinary chapters while meaning something
	// else, so a range stated on one footing says nothing about a range stated on the other.
	if (batch.coverStories !== part.coverStories) return 'incomparable';

	const covered = index(batch.terms);

	let anyWithin = false;
	let anyOutside = false;
	for (const term of part.terms) {
		if (isWithin(term, covered)) anyWithin = true;
		// A Part the Batch Release neither contains nor misses is the case this module exists to
		// refuse: take it and Pacerr grabs a file that may not be there, drop it and the Part can
		// go permanently ungrabbed in an Arc the Batch is the only coverage for.
		else if (overlaps(term, covered)) return 'undecided';
		else anyOutside = true;
	}
	if (anyWithin && anyOutside) return 'undecided';
	return anyWithin ? 'covered' : 'uncovered';
}

interface Span {
	from: number;
	to: number;
}

interface CoveredTerms {
	spans: Span[];
	texts: Set<string>;
}

function index(terms: CoverageTerm[]): CoveredTerms {
	const sorted = terms
		.filter((term): term is Span => 'from' in term)
		.sort((left, right) => left.from - right.from);

	const spans: Span[] = [];
	for (const span of sorted) {
		const previous = spans.at(-1);
		// Chapters and episodes are whole numbers, so 1-3 and 4-7 describe one unbroken run and a
		// Part spanning 3-5 sits inside it.
		if (previous !== undefined && span.from <= previous.to + 1)
			previous.to = Math.max(previous.to, span.to);
		else spans.push({ ...span });
	}

	return {
		spans,
		texts: new Set(terms.flatMap((term) => ('text' in term ? [term.text] : [])))
	};
}

function isWithin(term: CoverageTerm, covered: CoveredTerms): boolean {
	if ('text' in term) return covered.texts.has(term.text);
	return covered.spans.some((span) => span.from <= term.from && term.to <= span.to);
}

function overlaps(term: CoverageTerm, covered: CoveredTerms): boolean {
	if ('text' in term) return false;
	return covered.spans.some((span) => span.from <= term.to && term.from <= span.to);
}
