import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import {
	fixtures,
	hours,
	minutes,
	startPacerr,
	type Pacerr,
	type StartOptions
} from './harness/pacerr';

/** The Reverie Batch the watch page currently calls current, and the one it superseded. */
const currentCut = '4d9497e964d820760adf11e47664df3091b808f2';
const earlierCut = 'c5860b5066c7ed8bfe51abde23f76ef3f78a6ec7';

/** The watch page as it looked before the re-cut: Reverie offered as the earlier Batch. */
const beforeTheRecut = (): string => fixtures.watchPage.replaceAll(currentCut, earlierCut);

/** How the watch page's payload opens the download it offers for the Reverie Batch. */
const offerOf = (infohash: string, resolution: number): string =>
	`{\\"status\\":\\"current\\",\\"resolution\\":${resolution},\\"variant\\":\\"$undefined\\",` +
	`\\"magnetHref\\":\\"magnet:?xt=urn:btih:${infohash}`;

/** The same page, but with the earlier Batch offered at a Resolution below the default Cutoff. */
const beforeTheRecutAt720 = (): string =>
	beforeTheRecut().replace(offerOf(earlierCut, 1080), () => offerOf(earlierCut, 720));

/** Both cuts offered as current at once: the earlier at 720p, the re-cut at 1080p. */
function bothCutsOffered(): string {
	const page = fixtures.watchPage;
	const start = page.indexOf(offerOf(currentCut, 1080));
	const offer = page.slice(start, page.indexOf('}],\\"guide\\"', start) + 1);
	const earlier = offer
		.replaceAll(currentCut, earlierCut)
		.replace('\\"resolution\\":1080', '\\"resolution\\":720');
	return page.replace(offer, () => `${earlier},${offer}`);
}

/** A tmpfs the temporary root is never on, so a hardlink between them genuinely fails. */
function otherFilesystem(): string {
	const directory = mkdtempSync('/dev/shm/pacerr-downloads-');
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

/** Drive one download to completion, with real files on a real filesystem. */
function finish(pacerr: Pacerr, infohash: string, content: string): void {
	const directory = join(pacerr.paths.downloads, infohash);
	mkdirSync(directory, { recursive: true });
	for (let position = 1; position <= 3; position += 1) {
		writeFileSync(join(directory, `${position}.mkv`), `${content} ${position}`);
	}
	pacerr.downloadClient.complete(infohash, directory);
}

/** Reverie monitored, downloaded and imported from the Batch that One Pace later re-cut. */
async function holdingTheEarlierCut(options: StartOptions = {}): Promise<Pacerr> {
	const pacerr = await startPacerr({
		watchPage: beforeTheRecut(),
		feed: fixtures.feed,
		...options
	});
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
	finish(pacerr, earlierCut, 'the earlier cut');
	await pacerr.advance(minutes(15));
	return pacerr;
}

/** Reverie held at 720p, which the default Cutoff of 1080p leaves open to an Upgrade. */
async function holdingSevenTwenty(): Promise<Pacerr> {
	const pacerr = await startPacerr({ watchPage: beforeTheRecutAt720(), feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
	finish(pacerr, earlierCut, 'the 720p cut');
	await pacerr.advance(minutes(15));
	return pacerr;
}

const reverieAt720 = [
	'Reverie/Season 34/Reverie - S34E01 - The Fifth Emperor [720p].mkv',
	'Reverie/Season 34/Reverie - S34E02 - A Beautiful World [720p].mkv',
	'Reverie/Season 34/Reverie - S34E03 - The Empty Throne [720p].mkv'
];

const callAPartDoneAt = (pacerr: Pacerr, cutoff: string): Promise<unknown> =>
	pacerr.submit('/settings', 'saveProfile', {
		'resolution-1': '1080',
		'resolution-2': '720',
		'resolution-3': '480',
		variant: 'regular',
		cutoff
	});

/** One Pace re-cuts Reverie, and Pacerr is left to notice and act on it. */
async function recut(pacerr: Pacerr): Promise<Pacerr> {
	pacerr.upstream.watchPage.publish(fixtures.watchPage);
	await pacerr.advance(hours(24));
	finish(pacerr, currentCut, 'the current cut');
	await pacerr.advance(minutes(15));
	return pacerr;
}

const upgraded = async (options: StartOptions = {}): Promise<Pacerr> =>
	recut(await holdingTheEarlierCut(options));

const libraryFiles = (pacerr: Pacerr): string[] =>
	readdirSync(pacerr.paths.library, { recursive: true })
		.map(String)
		.filter((entry) => statSync(join(pacerr.paths.library, entry)).isFile())
		.sort();

const contentOf = (pacerr: Pacerr, file: string): string =>
	readFileSync(join(pacerr.paths.library, file), 'utf8');

const firstPart = 'Reverie/Season 34/Reverie - S34E01 - The Fifth Emperor [1080p].mkv';

const reverieInTheLibrary = [
	firstPart,
	'Reverie/Season 34/Reverie - S34E02 - A Beautiful World [1080p].mkv',
	'Reverie/Season 34/Reverie - S34E03 - The Empty Throne [1080p].mkv'
];

describe('a Release that drops out of the watch page current set', () => {
	it('is replaced by the Release that superseded it, unasked', async () => {
		const pacerr = await holdingTheEarlierCut();

		pacerr.upstream.watchPage.publish(fixtures.watchPage);
		await pacerr.advance(hours(24));

		expect(pacerr.downloadClient.added.map((download) => download.infohash)).toContain(currentCut);
	});

	it('leaves the new cut in the Library where the old one was', async () => {
		const pacerr = await upgraded();

		expect(libraryFiles(pacerr)).toEqual(reverieInTheLibrary);
		expect(contentOf(pacerr, firstPart)).toBe('the current cut 1');
	});
});

describe('the torrent an Upgrade superseded', () => {
	it('is removed from the Download Client along with its download-directory copy', async () => {
		const pacerr = await upgraded();

		expect(pacerr.downloadClient.removed).toEqual([{ infohash: earlierCut, deleteData: true }]);
		expect(existsSync(join(pacerr.paths.downloads, earlierCut))).toBe(false);
	});

	it('is left alone when the Upgrade failed to import', async () => {
		const pacerr = await holdingTheEarlierCut();

		pacerr.upstream.watchPage.publish(fixtures.watchPage);
		await pacerr.advance(hours(24));
		// Completed, but with nothing Pacerr can read where the Download Client says it is.
		pacerr.downloadClient.complete(currentCut, join(pacerr.paths.downloads, currentCut));
		await pacerr.advance(minutes(15));

		expect(pacerr.downloadClient.removed).toEqual([]);
		expect(existsSync(join(pacerr.paths.downloads, earlierCut))).toBe(true);
		expect(contentOf(pacerr, firstPart)).toBe('the earlier cut 1');
	});

	it('leaves the Library copy behind it, readable and whole', async () => {
		const pacerr = await upgraded();

		expect(existsSync(join(pacerr.paths.downloads, earlierCut))).toBe(false);
		expect(libraryFiles(pacerr).map((file) => contentOf(pacerr, file))).toEqual([
			'the current cut 1',
			'the current cut 2',
			'the current cut 3'
		]);
	});
});

describe('an Upgrade where the Library and the download directory cannot be hardlinked', () => {
	it('leaves a readable Library copy behind the removal all the same', async () => {
		const pacerr = await upgraded({ downloadsDir: otherFilesystem() });

		expect(pacerr.downloadClient.removed).toEqual([{ infohash: earlierCut, deleteData: true }]);
		expect(existsSync(join(pacerr.paths.downloads, earlierCut))).toBe(false);
		expect(contentOf(pacerr, firstPart)).toBe('the current cut 1');
	});
});

describe('the Cutoff', () => {
	it('leaves a Part below it open to a higher Resolution appearing', async () => {
		const pacerr = await holdingSevenTwenty();
		expect(libraryFiles(pacerr)).toEqual(reverieAt720);

		pacerr.upstream.watchPage.publish(bothCutsOffered());
		await pacerr.advance(hours(24));
		finish(pacerr, currentCut, 'the 1080p cut');
		await pacerr.advance(minutes(15));

		expect(libraryFiles(pacerr)).toEqual(reverieInTheLibrary);
		expect(contentOf(pacerr, firstPart)).toBe('the 1080p cut 1');
	});

	it('withholds a Part that has met it from a higher Resolution', async () => {
		const pacerr = await holdingSevenTwenty();
		await callAPartDoneAt(pacerr, '720');

		pacerr.upstream.watchPage.publish(bothCutsOffered());
		await pacerr.advance(hours(24));

		expect(pacerr.downloadClient.added.map((download) => download.infohash)).toEqual([earlierCut]);
		expect(libraryFiles(pacerr)).toEqual(reverieAt720);
	});

	it('does not withhold a Part that has met it from a Release going outdated', async () => {
		const pacerr = await upgraded();

		expect((await pacerr.open('/arcs/reverie')).texts('tbody .have')).toEqual([
			'Reverie 1080p Regular',
			'Reverie 1080p Regular',
			'Reverie 1080p Regular'
		]);
		expect(contentOf(pacerr, firstPart)).toBe('the current cut 1');
		expect(pacerr.downloadClient.removed).toEqual([{ infohash: earlierCut, deleteData: true }]);
	});
});

describe('History', () => {
	it('names the Release an Upgrade took and the one it replaced', async () => {
		const pacerr = await upgraded();

		const page = await pacerr.open('/activity');
		expect(page.texts('.history .event').filter((event) => event === 'Upgraded')).toHaveLength(3);
		expect(page.texts('.history .replaced')).toEqual([
			`Replaced Reverie · ${earlierCut}`,
			`Replaced Reverie · ${earlierCut}`,
			`Replaced Reverie · ${earlierCut}`
		]);
		// Newest first, so the three Upgrades sit above the three imports that preceded them.
		expect(page.texts('.history .detail').slice(0, 3)).toEqual([...reverieInTheLibrary].reverse());
	});
});

describe('a completed download nothing has superseded', () => {
	it('is never removed, however long Pacerr runs', async () => {
		const pacerr = await holdingTheEarlierCut();

		await pacerr.advance(hours(24));
		await pacerr.advance(hours(24));

		expect(pacerr.downloadClient.removed).toEqual([]);
		expect(existsSync(join(pacerr.paths.downloads, earlierCut))).toBe(true);
		expect((await pacerr.open('/activity')).texts('.table .parts')).toEqual([
			'The Fifth Emperor, A Beautiful World, The Empty Throne'
		]);
	});
});

describe('the queue', () => {
	it('is left holding the replacement alone once the Upgrade is done', async () => {
		const pacerr = await upgraded();

		const page = await pacerr.open('/activity');
		expect(page.texts('.table .state')).toEqual(['Completed']);
		expect(page.texts('.table .parts')).toEqual([
			'The Fifth Emperor, A Beautiful World, The Empty Throne'
		]);
	});
});

describe('a manually imported Part', () => {
	const fanLetter = '80872a919a43b5d044caa3fd80933707344e4fab';
	const theFile = 'One Piece Fan Letter.mkv';
	const inTheLibrary =
		'One Piece Fan Letter/Season 00/One Piece Fan Letter - S00E01 - One Piece Fan Letter [unknown].mkv';

	it('has no Upgrade path, because Pacerr does not know what it holds', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		const source = mkdtempSync(join(tmpdir(), 'pacerr-source-'));
		onTestFinished(() => rmSync(source, { recursive: true, force: true }));
		writeFileSync(join(source, theFile), 'the file the user already had');

		await pacerr.submit('/settings', 'saveImportSource', { importSource: source });
		await pacerr.submit('/manual-import', 'import', {
			[`part:${theFile}`]: 'one-piece-fan-letter-01'
		});
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'one-piece-fan-letter' });

		// The Release the Catalogue offers for that Part is superseded by another One Pace
		// published, which for a downloaded Part would be an Upgrade.
		pacerr.upstream.watchPage.publish(fixtures.watchPage.replaceAll(fanLetter, earlierCut));
		await pacerr.advance(hours(24));

		expect(pacerr.downloadClient.added).toEqual([]);
		expect(pacerr.downloadClient.removed).toEqual([]);
		expect(contentOf(pacerr, inTheLibrary)).toBe('the file the user already had');
	});
});
