import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	type Arc,
	type BatchScope,
	type Catalogue,
	type Part,
	parseCatalogue
} from '../catalogue/watch-page';
import type { BatchExpansion } from './expansion';
import { expandBatchRelease } from './expansion';

const catalogue: Catalogue = parseCatalogue(
	readFileSync(new URL('../catalogue/fixtures/watch-page.html', import.meta.url), 'utf8')
);

function arc(slug: string): Arc {
	const found = catalogue.arcs.find((candidate) => candidate.slug === slug);
	if (found === undefined) throw new Error(`the fixture has no Arc ${slug}`);
	return found;
}

describe('expandBatchRelease', () => {
	it('names every Part of an Arc the Batch Release covers exactly', () => {
		const romanceDawn = arc('romance-dawn');

		const expansion = expandBatchRelease(
			{
				infohash: 'cdab4a928dbbff643bbe5531f216eb36a60c85af',
				arcSlug: 'romance-dawn',
				chapters: { terms: [{ from: 1, to: 7 }], coverStories: false },
				episodes: romanceDawn.episodes
			},
			catalogue
		);

		expect(expansion).toMatchObject({ outcome: 'expanded' });
		expect(partSlugsOf(expansion)).toEqual([
			'romance-dawn-01',
			'romance-dawn-02',
			'romance-dawn-03',
			'romance-dawn-04'
		]);
	});

	it('names the one Part of a single-Part Arc even where the Catalogue states no chapters for it', () => {
		const aprilFools = arc('warship-island-01-april-fools-2025');
		expect(aprilFools.parts[0]?.chapters).toBeNull();

		const expansion = expandBatchRelease(
			{
				infohash: '77ba0dd8e9b4e7e1d4bbbb0a6a3b4e1e9e5c2a1f',
				arcSlug: aprilFools.slug,
				chapters: null,
				episodes: aprilFools.episodes
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).toEqual(['warship-island-01-april-fools-2025-01']);
	});

	it('names only the Parts inside its range when the Batch Release covers part of an Arc', () => {
		const longRingLongLand = arc('long-ring-long-land');
		expect(longRingLongLand.parts[0]?.slug).toBe('long-ring-long-land-00');

		const expansion = expandBatchRelease(
			{
				infohash: '4f2b72009c25ec6c534a852ddfc3fd85ed10fdf5',
				arcSlug: longRingLongLand.slug,
				chapters: { terms: [{ from: 304, to: 321 }], coverStories: false },
				episodes: null
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).toEqual([
			'long-ring-long-land-01',
			'long-ring-long-land-02',
			'long-ring-long-land-03',
			'long-ring-long-land-04',
			'long-ring-long-land-05',
			'long-ring-long-land-06'
		]);
		expect(batchScopeOf('4f2b72009c25ec6c534a852ddfc3fd85ed10fdf5').partRange).toBe('01-06');
	});

	it('weighs chapter terms over episode terms, which neighbouring Parts share', () => {
		const longRingLongLand = arc('long-ring-long-land');
		expect(longRingLongLand.parts[0]?.episodes).toMatchObject({
			terms: [
				{ from: 207, to: 207 },
				{ from: 225, to: 225 }
			]
		});

		const expansion = expandBatchRelease(
			{
				infohash: '4f2b72009c25ec6c534a852ddfc3fd85ed10fdf5',
				arcSlug: longRingLongLand.slug,
				chapters: { terms: [{ from: 304, to: 321 }], coverStories: false },
				episodes: {
					terms: [
						{ from: 207, to: 212 },
						{ from: 215, to: 215 },
						{ from: 217, to: 219 },
						{ from: 226, to: 228 }
					],
					coverStories: false
				}
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).not.toContain('long-ring-long-land-00');
	});

	it('names Parts that have no Release of their own', () => {
		const batch = 'cdab4a928dbbff643bbe5531f216eb36a60c85af';
		const romanceDawn = arc('romance-dawn');
		const ownReleases = catalogue.releases.filter(
			(release) => release.arcSlug === romanceDawn.slug && release.batchScope === null
		);
		expect(ownReleases).toEqual([]);

		const expansion = expandBatchRelease(
			{
				infohash: batch,
				arcSlug: romanceDawn.slug,
				chapters: { terms: [{ from: 1, to: 7 }], coverStories: false },
				episodes: null
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).toHaveLength(batchScopeOf(batch).partCount);
	});

	it('names a Part that a newer per-Part Release also covers', () => {
		const batch = 'fd204b5dc346f5458f7f04cf1ad98679aaf9586e';
		const mappedByTheCatalogue = catalogue.releases.find(
			(release) => release.infohash === batch
		)?.partSlugs;
		expect(mappedByTheCatalogue).not.toContain('fishman-island-01');
		expect(mappedByTheCatalogue).not.toContain('fishman-island-02');

		const expansion = expandBatchRelease(
			{
				infohash: batch,
				arcSlug: 'fishman-island',
				chapters: { terms: [{ from: 603, to: 653 }], coverStories: false },
				episodes: null
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).toContain('fishman-island-01');
		expect(partSlugsOf(expansion)).toContain('fishman-island-02');
		expect(partSlugsOf(expansion)).toHaveLength(batchScopeOf(batch).partCount);
	});

	it('never names an announced but unreleased Part its range runs over', () => {
		const wano = arc('wano');
		expect(wano.unreleasedParts.map((part) => part.number)).toContain(63);

		const expansion = expandBatchRelease(
			{
				infohash: 'd67ed82392c28cb6c40509383ba70bfb4e6aefdf',
				arcSlug: wano.slug,
				chapters: { terms: [{ from: 909, to: 1057 }], coverStories: false },
				episodes: null
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).toHaveLength(wano.parts.length);
		expect(partSlugsOf(expansion)).not.toContain('wano-63');
	});

	it('reports a Part whose chapters run past the end of the Batch Release as undecided', () => {
		const longRingLongLand = arc('long-ring-long-land');
		expect(longRingLongLand.parts[4]).toMatchObject({
			slug: 'long-ring-long-land-04',
			chapters: { terms: [{ from: 313, to: 316 }] }
		});

		const expansion = expandBatchRelease(
			{
				infohash: '4f2b72009c25ec6c534a852ddfc3fd85ed10fdf5',
				arcSlug: longRingLongLand.slug,
				chapters: { terms: [{ from: 304, to: 314 }], coverStories: false },
				episodes: null
			},
			catalogue
		);

		expect(expansion).toMatchObject({
			outcome: 'partlyExpanded',
			reason: expect.stringContaining('long-ring-long-land-04')
		});
		expect(slugsOf(expansion, 'expandedParts')).toEqual([
			'long-ring-long-land-01',
			'long-ring-long-land-02',
			'long-ring-long-land-03'
		]);
		expect(slugsOf(expansion, 'undecidedParts')).toEqual(['long-ring-long-land-04']);
	});

	it('expands nothing for a Batch Release whose Arc the Catalogue does not list', () => {
		const expansion = expandBatchRelease(
			{
				infohash: '0000000000000000000000000000000000000000',
				arcSlug: 'elbaf',
				chapters: { terms: [{ from: 1, to: 10 }], coverStories: false },
				episodes: null
			},
			catalogue
		);

		expect(expansion).toEqual({
			outcome: 'notExpanded',
			reason: expect.stringContaining('elbaf')
		});
	});

	it('expands nothing for a Batch Release that states neither chapters nor episodes', () => {
		const expansion = expandBatchRelease(
			{
				infohash: 'cdab4a928dbbff643bbe5531f216eb36a60c85af',
				arcSlug: 'romance-dawn',
				chapters: null,
				episodes: null
			},
			catalogue
		);

		expect(expansion).toMatchObject({ outcome: 'notExpanded' });
	});

	it('expands nothing for a Batch Release whose range lands on no Part of its Arc', () => {
		const expansion = expandBatchRelease(
			{
				infohash: 'cdab4a928dbbff643bbe5531f216eb36a60c85af',
				arcSlug: 'romance-dawn',
				chapters: { terms: [{ from: 5000, to: 5010 }], coverStories: false },
				episodes: null
			},
			catalogue
		);

		expect(expansion).toMatchObject({ outcome: 'notExpanded' });
	});

	it('falls back to episode terms where the Batch Release states no chapters', () => {
		const romanceDawn = arc('romance-dawn');

		const expansion = expandBatchRelease(
			{
				infohash: 'cdab4a928dbbff643bbe5531f216eb36a60c85af',
				arcSlug: romanceDawn.slug,
				chapters: null,
				episodes: romanceDawn.episodes
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).toHaveLength(4);
	});

	it('leaves out a Part named by text that the Batch Release does not name', () => {
		const romanceDawn = arc('romance-dawn');
		expect(romanceDawn.parts[0]?.episodes).toEqual({
			terms: [{ text: 'Episode of East Blue' }],
			coverStories: false
		});

		const expansion = expandBatchRelease(
			{
				infohash: 'cdab4a928dbbff643bbe5531f216eb36a60c85af',
				arcSlug: romanceDawn.slug,
				chapters: null,
				episodes: {
					terms: [
						{ from: 1, to: 3 },
						{ from: 19, to: 19 }
					],
					coverStories: false
				}
			},
			catalogue
		);

		expect(partSlugsOf(expansion)).toEqual([
			'romance-dawn-02',
			'romance-dawn-03',
			'romance-dawn-04'
		]);
	});

	it('reads two abutting terms of a Batch Release as one unbroken range', () => {
		const invented = catalogueOf('jaya', [
			{
				slug: 'jaya-01',
				chapters: { terms: [{ from: 3, to: 5 }], coverStories: false },
				episodes: null
			},
			{
				slug: 'jaya-02',
				chapters: { terms: [{ from: 8, to: 9 }], coverStories: false },
				episodes: null
			}
		]);

		const expansion = expandBatchRelease(
			{
				infohash: '2222222222222222222222222222222222222222',
				arcSlug: 'jaya',
				chapters: {
					terms: [
						{ from: 1, to: 3 },
						{ from: 4, to: 7 }
					],
					coverStories: false
				},
				episodes: null
			},
			invented
		);

		expect(partSlugsOf(expansion)).toEqual(['jaya-01']);
	});

	it('will not weigh cover-story chapter numbers against ordinary ones', () => {
		const invented = catalogueOf('drum-island', [
			{
				slug: 'drum-island-01',
				chapters: { terms: [{ from: 35, to: 75 }], coverStories: true },
				episodes: null
			},
			{
				slug: 'drum-island-02',
				chapters: { terms: [{ from: 36, to: 37 }], coverStories: false },
				episodes: null
			}
		]);

		const expansion = expandBatchRelease(
			{
				infohash: '1111111111111111111111111111111111111111',
				arcSlug: 'drum-island',
				chapters: { terms: [{ from: 1, to: 100 }], coverStories: false },
				episodes: null
			},
			invented
		);

		expect(expansion).toMatchObject({ outcome: 'partlyExpanded' });
		expect(slugsOf(expansion, 'expandedParts')).toEqual(['drum-island-02']);
		expect(slugsOf(expansion, 'undecidedParts')).toEqual(['drum-island-01']);
	});
});

function catalogueOf(
	arcSlug: string,
	parts: Pick<Part, 'slug' | 'chapters' | 'episodes'>[]
): Catalogue {
	return {
		arcs: [
			{
				slug: arcSlug,
				title: arcSlug,
				description: null,
				special: false,
				unfinished: false,
				chapters: null,
				episodes: null,
				coverImageUrl: null,
				unreleasedParts: [],
				parts: parts.map((part, index) => ({
					...part,
					arcSlug,
					number: index + 1,
					title: part.slug,
					description: null,
					toBeRedone: false
				}))
			}
		],
		releases: []
	};
}

function batchScopeOf(infohash: string): BatchScope {
	const release = catalogue.releases.find((candidate) => candidate.infohash === infohash);
	if (release?.batchScope == null) throw new Error(`the fixture has no Batch Release ${infohash}`);
	return release.batchScope;
}

function partSlugsOf(expansion: BatchExpansion): string[] {
	if (expansion.outcome !== 'expanded')
		throw new Error(`the Batch Release was ${expansion.outcome}: ${expansion.reason}`);
	return expansion.parts.map((part) => part.slug);
}

function slugsOf(expansion: BatchExpansion, field: 'expandedParts' | 'undecidedParts'): string[] {
	if (expansion.outcome !== 'partlyExpanded')
		throw new Error(`the Batch Release was ${expansion.outcome}`);
	return expansion[field].map((part) => part.slug);
}
