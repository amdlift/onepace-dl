import type { Database } from 'better-sqlite3';
import { expandBatchRelease } from '../batch/expansion';
import { readCatalogue } from '../catalogue/store';
import type { Catalogue, CatalogueRelease, Resolution, Variant } from '../catalogue/watch-page';
import { readBatchReleases, readPublishedReleases } from '../releases/store';
import { readProfile, type Profile } from './profile';

/** One Release Pacerr would grab, and the Parts it is being grabbed for. */
export interface SelectedRelease {
	infohash: string;
	title: string;
	publishedAt: Date;
	resolution: Resolution;
	variant: Variant;
	batch: boolean;
	/** Every Part the Release carries. For a Batch, what expansion decided it contains. */
	coveredParts: string[];
	/**
	 * The Parts it was chosen for, in Catalogue order. Where a Batch is needed for only some of
	 * what it covers, the rest are the files to deselect in the Download Client.
	 */
	neededParts: string[];
}

export type PartSelection =
	| {
			partSlug: string;
			chosen: true;
			release: SelectedRelease;
			/**
			 * Whether the *offered* Release falls short of the Cutoff, which is what the "Below
			 * Cutoff" badge states. Not what decides an Upgrade: that is gated on the Resolution of
			 * the Release a Part already holds, in `upgrade/store.ts`, which never reads this.
			 */
			belowCutoff: boolean;
	  }
	| { partSlug: string; chosen: false; reason: string };

export interface Selection {
	profile: Profile;
	parts: Map<string, PartSelection>;
	releases: SelectedRelease[];
}

interface Candidate {
	infohash: string;
	title: string;
	publishedAt: Date;
	resolution: Resolution;
	variant: Variant;
	batch: boolean;
	coveredParts: string[];
}

/**
 * What Pacerr would grab for every Part the Catalogue knows, decided one Part at a time.
 *
 * Per ADR-0003 the unit is the Part and never the Arc: an Arc midway through being re-cut has a
 * handful of new per-Part Releases and an older Batch Release holding everything else, and
 * comparing recency across the Arc as a whole would discard all but the handful.
 */
export function select(db: Database): Selection {
	const profile = readProfile(db);
	const catalogue = readCatalogue(db);
	const published = readPublishedReleases(db);
	const byInfohash = new Map(catalogue.releases.map((release) => [release.infohash, release]));

	const covering = new Map<string, Candidate[]>();
	const undecided = new Map<string, string>();

	for (const release of catalogue.releases) {
		// A Batch's covered Parts come from expansion below. The Catalogue's own Part links say
		// what the watch page still shows under the Batch, not what the torrent contains.
		if (release.batchScope !== null) continue;
		const candidate = candidateFor(release, release.partSlugs, published.get(release.infohash));
		if (candidate !== null) cover(covering, candidate);
	}

	for (const batch of readBatchReleases(db)) {
		const release = byInfohash.get(batch.infohash);
		if (release === undefined) continue;

		const expansion = expandBatchRelease(batch, catalogue);
		if (expansion.outcome === 'notExpanded') {
			noteUndecided(undecided, partsOf(catalogue, batch.arcSlug), expansion.reason);
			continue;
		}

		// A partial expansion still decided most of the Arc. Dropping the Batch over the Parts it
		// could not place would leave the rest permanently ungrabbed wherever it is the only cover.
		const expanded =
			expansion.outcome === 'expanded' ? expansion.parts : expansion.expandedParts;
		if (expansion.outcome === 'partlyExpanded') {
			noteUndecided(
				undecided,
				expansion.undecidedParts.map((part) => part.slug),
				expansion.reason
			);
		}

		const candidate = candidateFor(
			release,
			expanded.map((part) => part.slug),
			published.get(batch.infohash)
		);
		if (candidate !== null) cover(covering, candidate);
	}

	const parts = new Map<string, PartSelection>();
	const chosen = new Map<string, SelectedRelease>();
	for (const arc of catalogue.arcs) {
		for (const part of arc.parts) {
			const candidates = covering.get(part.slug) ?? [];
			const best = bestOf(candidates, profile);
			if (best === undefined) {
				parts.set(part.slug, {
					partSlug: part.slug,
					chosen: false,
					reason: reasonFor(candidates, undecided.get(part.slug))
				});
				continue;
			}

			let release = chosen.get(best.infohash);
			if (release === undefined) {
				release = { ...best, neededParts: [] };
				chosen.set(best.infohash, release);
			}
			release.neededParts.push(part.slug);
			parts.set(part.slug, {
				partSlug: part.slug,
				chosen: true,
				release,
				belowCutoff: best.resolution < profile.cutoff
			});
		}
	}

	return { profile, parts, releases: [...chosen.values()] };
}

function candidateFor(
	release: CatalogueRelease,
	coveredParts: string[],
	published: { title: string; publishedAt: Date } | undefined
): Candidate | null {
	// The Catalogue states a Release's Resolution and Variant; only the feed states when it was
	// published, so a Release the feed has not carried yet cannot be ranked and is not a candidate.
	if (published === undefined || coveredParts.length === 0) return null;
	return {
		infohash: release.infohash,
		title: published.title,
		publishedAt: published.publishedAt,
		resolution: release.resolution,
		variant: release.variant,
		batch: release.batchScope !== null,
		coveredParts
	};
}

function bestOf(candidates: Candidate[], profile: Profile): Candidate | undefined {
	const satisfying = candidates.filter((candidate) =>
		profile.resolutions.includes(candidate.resolution)
	);
	return satisfying.sort((left, right) => compare(left, right, profile))[0];
}

/**
 * Candidates have already been filtered to the Resolutions the Profile accepts, so what is left
 * is the order within them.
 *
 * The preferred Variant outranks everything: a user who asked for the regular cut means it even
 * when One Pace published an extended one of the same Part afterwards. Resolution order comes
 * next, because story 17 asks for 1080p where it exists; story 20's most recently published then
 * decides within a Resolution, which is the per-Part recency ADR-0003 turns on.
 */
function compare(left: Candidate, right: Candidate, profile: Profile): number {
	const preference = rank(right.variant, profile) - rank(left.variant, profile);
	if (preference !== 0) return preference;

	const resolution =
		profile.resolutions.indexOf(left.resolution) - profile.resolutions.indexOf(right.resolution);
	if (resolution !== 0) return resolution;

	const recency = right.publishedAt.getTime() - left.publishedAt.getTime();
	return recency !== 0 ? recency : left.infohash.localeCompare(right.infohash);
}

const rank = (variant: Variant, profile: Profile): number => (variant === profile.variant ? 1 : 0);

function cover(covering: Map<string, Candidate[]>, candidate: Candidate): void {
	for (const partSlug of candidate.coveredParts) {
		const candidates = covering.get(partSlug) ?? [];
		candidates.push(candidate);
		covering.set(partSlug, candidates);
	}
}

function noteUndecided(undecided: Map<string, string>, partSlugs: string[], reason: string): void {
	for (const partSlug of partSlugs) if (!undecided.has(partSlug)) undecided.set(partSlug, reason);
}

function partsOf(catalogue: Catalogue, arcSlug: string): string[] {
	const arc = catalogue.arcs.find((candidate) => candidate.slug === arcSlug);
	return arc === undefined ? [] : arc.parts.map((part) => part.slug);
}

function reasonFor(candidates: Candidate[], undecided: string | undefined): string {
	if (candidates.length > 0) return 'No Release here satisfies the Profile';
	return undecided ?? 'No Release covers this Part';
}
