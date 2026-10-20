import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	type Arc,
	type Catalogue,
	type CatalogueRelease,
	parseCatalogue,
	WatchPageParseError
} from './watch-page';

const watchPageHtml = readFileSync(new URL('./fixtures/watch-page.html', import.meta.url), 'utf8');

describe('parseCatalogue', () => {
	it('lists every Arc on the watch page in watch order', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(catalogue.arcs).toHaveLength(38);
		expect(catalogue.arcs[0]).toMatchObject({ slug: 'romance-dawn', title: 'Romance Dawn' });
		expect(catalogue.arcs.at(-1)).toMatchObject({ slug: 'warship-island-01-april-fools-2025' });
	});

	it('gives each Part its number, title, description and covered chapter and episode terms', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		const romanceDawn = arcBySlug(catalogue, 'romance-dawn');

		expect(romanceDawn.parts.map((part) => part.number)).toEqual([1, 2, 3, 4]);
		expect(romanceDawn.parts[0]).toEqual({
			slug: 'romance-dawn-01',
			arcSlug: 'romance-dawn',
			number: 1,
			title: 'ROMANCE DAWN, ~The Dawn of an Adventure~',
			description:
				'Influenced by the straw-hat-wearing pirate Red-Haired Shanks, an enthusiastic young boy named Monkey D. Luffy dreams of one day becoming King of the Pirates.',
			chapters: { terms: [{ from: 1, to: 1 }], coverStories: false },
			episodes: { terms: [{ text: 'Episode of East Blue' }], coverStories: false },
			toBeRedone: false
		});
	});

	it('reports a field the payload omits as absent rather than as its sentinel string', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		const aprilFools = arcBySlug(catalogue, 'warship-island-01-april-fools-2025');

		expect(aprilFools.parts[0]).toMatchObject({ description: null, chapters: null });
	});

	it('follows a cross-row backreference to the terms it points at', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		const fanLetter = arcBySlug(catalogue, 'one-piece-fan-letter');

		expect(fanLetter.parts[0]).toMatchObject({
			chapters: { terms: [{ text: 'One Piece Novel: Straw Hat Stories' }], coverStories: false },
			episodes: { terms: [{ text: 'One Piece Fan Letter' }], coverStories: false }
		});
	});

	it('keeps announced but unreleased Parts apart from released ones', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		const wano = arcBySlug(catalogue, 'wano');

		expect(wano.parts.at(-1)?.number).toBe(62);
		expect(wano.unreleasedParts).toEqual(
			Array.from({ length: 24 }, (_, index) => ({ arcSlug: 'wano', number: 63 + index }))
		);
		expect(arcBySlug(catalogue, 'romance-dawn').unreleasedParts).toEqual([]);
	});

	it('maps the infohash of a per-Part Release to the Part it covers', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(releaseByInfohash(catalogue, '7a76ae41f0ec5f223d3b3851fb3a71814262d1c8')).toEqual({
			infohash: '7a76ae41f0ec5f223d3b3851fb3a71814262d1c8',
			arcSlug: 'wano',
			partSlugs: ['wano-02'],
			resolution: 1080,
			variant: 'regular',
			sizeLabel: '1.5 GiB',
			batchScope: null
		});
	});

	it('distinguishes the Variant of Releases covering the same Part', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(releaseByInfohash(catalogue, '7ffbac3cd827eed21309b4c451135564b82029eb')).toMatchObject({
			partSlugs: ['wano-02'],
			variant: 'extended'
		});
		expect(releaseByInfohash(catalogue, '045ee32a340609e74fa6e7bb9d059ec928672437')).toMatchObject({
			partSlugs: ['skypiea-25'],
			variant: 'alternate'
		});
	});

	it('maps a Batch Release to every Part the page shows it covering', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(releaseByInfohash(catalogue, 'cdab4a928dbbff643bbe5531f216eb36a60c85af')).toEqual({
			infohash: 'cdab4a928dbbff643bbe5531f216eb36a60c85af',
			arcSlug: 'romance-dawn',
			partSlugs: ['romance-dawn-01', 'romance-dawn-02', 'romance-dawn-03', 'romance-dawn-04'],
			resolution: 1080,
			variant: 'regular',
			sizeLabel: '2.0 GiB',
			batchScope: { complete: true, partCount: 4, partRange: null }
		});
	});

	it('maps a Batch Release the Arc itself does not list to the Parts that point at it', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(releaseByInfohash(catalogue, '65bd14ab44161d254003f00b7d705fe3e6e965b1')).toMatchObject({
			arcSlug: 'impel-down',
			partSlugs: [
				'impel-down-03',
				'impel-down-04',
				'impel-down-05',
				'impel-down-06',
				'impel-down-07'
			],
			resolution: 720,
			sizeLabel: null
		});
	});

	it('maps every current Release on the page to at least one Part', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(catalogue.releases).toHaveLength(262);
		expect(catalogue.releases.filter((release) => release.partSlugs.length === 0)).toEqual([]);
	});

	it('keeps one-off entries and single-Part Arcs alongside the ordinary ones', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(arcBySlug(catalogue, 'one-piece-fan-letter')).toMatchObject({
			special: true,
			parts: [{ slug: 'one-piece-fan-letter-01', number: 1 }]
		});
		expect(arcBySlug(catalogue, 'warship-island-01-april-fools-2025')).toMatchObject({
			special: true
		});
		expect(arcBySlug(catalogue, 'gaimon')).toMatchObject({
			special: false,
			parts: [{ slug: 'gaimon-01', number: 1 }]
		});
	});

	it('describes an Arc with its own synopsis, coverage, artwork and recutting state', () => {
		const catalogue = parseCatalogue(watchPageHtml);

		expect(arcBySlug(catalogue, 'romance-dawn')).toMatchObject({
			title: 'Romance Dawn',
			description:
				'Monkey D. Luffy sets out on an adventure to form a crew, find the legendary One Piece, and become the Pirate King.',
			chapters: { terms: [{ from: 1, to: 7 }], coverStories: false },
			episodes: {
				terms: [{ from: 1, to: 3 }, { from: 19, to: 19 }, { text: 'Episode of East Blue' }],
				coverStories: false
			},
			unfinished: false,
			coverImageUrl: '/_next/static/media/50-backdrop-village-cows.0s-z7zeune8vi.jpg'
		});
		expect(arcBySlug(catalogue, 'wano')).toMatchObject({ unfinished: true });
	});
});

describe('the Catalogue the watch page fixture parses into', () => {
	it('matches the committed golden Catalogue', async () => {
		const catalogue = parseCatalogue(watchPageHtml);

		await expect(`${JSON.stringify(catalogue, null, 2)}\n`).toMatchFileSnapshot(
			'./fixtures/catalogue.golden.json'
		);
	});
});

describe('parseCatalogue on a page it does not understand', () => {
	it('parses a page built the way the real one is, so the refusals below mean something', () => {
		const page = watchPageWith({ data: { timeline: { segments: [anArc] } } });

		const catalogue = parseCatalogue(page);

		expect(catalogue.arcs).toMatchObject([{ slug: 'an-arc', parts: [{ slug: 'an-arc-01' }] }]);
		expect(catalogue.releases).toMatchObject([
			{ infohash: '0000000000000000000000000000000000000001', partSlugs: ['an-arc-01'] }
		]);
	});

	it('refuses a page carrying no payload at all', () => {
		expect(() => parseCatalogue('<!doctype html><html><body>maintenance</body></html>')).toThrow(
			WatchPageParseError
		);
	});

	it('refuses a payload with no Catalogue in it', () => {
		const page = watchPageWith({ data: { somethingElse: { segments: [] } } });

		expect(() => parseCatalogue(page)).toThrow(/no Catalogue/i);
	});

	it('refuses a Catalogue with no Arcs rather than reporting an empty one', () => {
		const page = watchPageWith({ data: { timeline: { segments: [] } } });

		expect(() => parseCatalogue(page)).toThrow(WatchPageParseError);
	});

	it('names the field it could not find when an Arc is restructured', () => {
		const page = watchPageWith({
			data: { timeline: { segments: [{ ...anArc, parts: [{ ...aPart, title: undefined }] }] } }
		});

		expect(() => parseCatalogue(page)).toThrow(/segments\[0\]\.parts\[0\]\.title/);
	});

	it('refuses a backreference it cannot follow', () => {
		const page = watchPageWith({
			data: { timeline: { segments: [{ ...anArc, chapters: '$ff:props:data' }] } }
		});

		expect(() => parseCatalogue(page)).toThrow(/row ff/);
	});

	it('refuses a Release whose Variant it has never seen', () => {
		const page = watchPageWith({
			data: {
				timeline: {
					segments: [
						{
							...anArc,
							parts: [{ ...aPart, downloads: [{ ...aDownload, variant: 'remastered' }] }]
						}
					]
				}
			}
		});

		expect(() => parseCatalogue(page)).toThrow(/remastered/);
	});
});

const aDownload = {
	status: 'current',
	resolution: 1080,
	variant: '$undefined',
	magnetHref: 'magnet:?xt=urn:btih:0000000000000000000000000000000000000001',
	torrentHref: '$undefined',
	nyaaHref: '$undefined',
	pixeldrainHref: '$undefined',
	partTitle: '$undefined',
	scope: '$undefined',
	supersededCount: 0,
	supersededRange: '',
	sizeLabel: '1 MiB',
	batchHref: '$undefined'
};

const aPart = {
	slug: 'an-arc-01',
	part: 1,
	title: 'A Part',
	titleRepeatsArc: false,
	description: 'A Part of an Arc.',
	chapters: { terms: [{ from: 1, to: 1 }], coverStories: false },
	episodes: { terms: [{ from: 1, to: 1 }], coverStories: false },
	duration: '20 min',
	toBeRedone: false,
	stills: [],
	fileGroups: [],
	downloads: [aDownload]
};

const anArc = {
	slug: 'an-arc',
	title: 'An Arc',
	description: 'An Arc of the recut.',
	special: false,
	unfinished: false,
	chapters: { terms: [{ from: 1, to: 1 }], coverStories: false },
	episodes: { terms: [{ from: 1, to: 1 }], coverStories: false },
	duration: '20 min',
	backdrops: [],
	covers: [],
	playlistGroups: [],
	downloads: [],
	guide: '$undefined',
	unreleasedParts: [],
	parts: [aPart]
};

function watchPageWith(props: unknown): string {
	const row = `6:${JSON.stringify(['$', '$L10', null, props])}\n`;
	return `<!doctype html><script>self.__next_f.push(${JSON.stringify([1, row])})</script>`;
}

function arcBySlug(catalogue: Catalogue, slug: string): Arc {
	const arc = catalogue.arcs.find((candidate) => candidate.slug === slug);
	if (arc === undefined) throw new Error(`no Arc ${slug} in the parsed Catalogue`);
	return arc;
}

function releaseByInfohash(catalogue: Catalogue, infohash: string): CatalogueRelease {
	const release = catalogue.releases.find((candidate) => candidate.infohash === infohash);
	if (release === undefined) throw new Error(`no Release ${infohash} in the parsed Catalogue`);
	return release;
}
