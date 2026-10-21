import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { fixtures, minutes, startPacerr, type Pacerr } from './harness/pacerr';

/** The Parts a directory holds. Sidecars travel with the media under a ticket of their own. */
const partsUnder = (directory: string): string[] =>
	readdirSync(directory, { recursive: true })
		.map(String)
		.filter((entry) => entry.endsWith('.mkv') && statSync(join(directory, entry)).isFile())
		.sort();

/** Somewhere a user might point the Library at, outside anything Pacerr chose for them. */
function anotherDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'pacerr-media-'));
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

/** A tmpfs nothing under tmpdir() is on, so moving between the two genuinely copies. */
function onAnotherFilesystem(): string {
	const directory = mkdtempSync('/dev/shm/pacerr-media-');
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

/** Reverie imported: three Parts in the Library Settings was first pointed at. */
async function aLibraryHoldingReverie(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

	const infohash = pacerr.downloadClient.added.at(-1)!.infohash;
	const content = join(pacerr.paths.downloads, infohash);
	mkdirSync(content, { recursive: true });
	for (const position of [1, 2, 3]) {
		writeFileSync(join(content, `${position}.mkv`), `video ${position}`);
	}
	pacerr.downloadClient.complete(infohash, content);
	await pacerr.advance(minutes(15));
	return pacerr;
}

/** A move of Reverie that got one Part across and then hit a destination Pacerr cannot write. */
async function aMoveStoppedAfterOnePart(): Promise<{
	pacerr: Pacerr;
	media: string;
	clear: () => void;
}> {
	const pacerr = await aLibraryHoldingReverie();
	const media = anotherDirectory();
	const inTheWay = join(media, 'Season 34', 'One Pace - S34E02 - A Beautiful World [1080p].mkv');
	mkdirSync(inTheWay, { recursive: true });

	await pacerr.submit('/settings', 'saveLibrary', { library: media });
	await pacerr.submit('/settings', 'startLibraryMove');
	await pacerr.settle();

	return { pacerr, media, clear: () => rmSync(inTheWay, { recursive: true }) };
}

describe('changing the Library that already holds Parts', () => {
	it('shows what the move would do and touches nothing until it is confirmed', async () => {
		const pacerr = await aLibraryHoldingReverie();
		const media = anotherDirectory();

		const page = await pacerr.submit('/settings', 'saveLibrary', { library: media });

		expect(page.text('.move')).toContain('3 Parts');
		expect(page.text('.move')).toContain('21 B');
		expect(page.text('.move')).toContain(pacerr.paths.library);
		expect(page.text('.move')).toContain(media);
		expect(partsUnder(media)).toEqual([]);
		expect(partsUnder(pacerr.paths.library)).toHaveLength(3);
	});
});

describe('a Library moved to another filesystem', () => {
	it('says the files will be copied, the hardlinks will break and the disk will double', async () => {
		const pacerr = await aLibraryHoldingReverie();
		const media = onAnotherFilesystem();

		const page = await pacerr.submit('/settings', 'saveLibrary', { library: media });

		expect(page.text('.move')).toContain('different filesystems');
		expect(page.text('.move')).toContain('copies each file rather than renaming it');
		expect(page.text('.move')).toContain('breaks the hardlinks to your seeding downloads');
		expect(page.text('.move')).toContain('roughly doubles');
	});

	it('breaks the hardlink to the seeding download, as the confirmation said it would', async () => {
		const pacerr = await aLibraryHoldingReverie();
		const firstPart = 'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv';
		expect(statSync(join(pacerr.paths.library, firstPart)).nlink).toBe(2);
		const media = onAnotherFilesystem();

		await pacerr.submit('/settings', 'saveLibrary', { library: media });
		await pacerr.submit('/settings', 'startLibraryMove');
		await pacerr.settle();

		expect(partsUnder(media)).toHaveLength(3);
		expect(statSync(join(media, firstPart)).nlink).toBe(1);
	});

	it('says the opposite of a move that stays on one filesystem', async () => {
		const pacerr = await aLibraryHoldingReverie();

		const page = await pacerr.submit('/settings', 'saveLibrary', { library: anotherDirectory() });

		expect(page.text('.move')).toContain('same filesystem');
		expect(page.text('.move')).toContain('costs no disk');
		expect(page.text('.move')).not.toContain('breaks the hardlinks');
	});
});

describe('a confirmed move', () => {
	it('returns the interface straight away and carries on in the background', async () => {
		const pacerr = await aLibraryHoldingReverie();
		const media = anotherDirectory();
		await pacerr.submit('/settings', 'saveLibrary', { library: media });
		await pacerr.hold();

		const started = await pacerr.submit('/settings', 'startLibraryMove');

		expect(started.text('.move')).toContain('0 of 3 Parts moved');
		expect(partsUnder(media)).toEqual([]);

		await pacerr.settle();

		const finished = await pacerr.open('/settings');
		expect(finished.text('.move')).toContain('Moved 3 Parts');
		expect(partsUnder(media)).toHaveLength(3);
		expect(partsUnder(pacerr.paths.library)).toEqual([]);
	});

	it('leaves every filename exactly as it was', async () => {
		const pacerr = await aLibraryHoldingReverie();
		const before = partsUnder(pacerr.paths.library);
		const media = anotherDirectory();

		await pacerr.submit('/settings', 'saveLibrary', { library: media });
		await pacerr.submit('/settings', 'startLibraryMove');
		await pacerr.settle();

		expect(partsUnder(media)).toEqual(before);
	});
});

describe('a move stopped partway', () => {
	it('leaves every Part where Pacerr says it is, and says what stopped it', async () => {
		const pacerr = await aLibraryHoldingReverie();
		const media = anotherDirectory();
		const inTheWay = join(media, 'Season 34', 'One Pace - S34E02 - A Beautiful World [1080p].mkv');
		mkdirSync(inTheWay, { recursive: true });

		await pacerr.submit('/settings', 'saveLibrary', { library: media });
		await pacerr.submit('/settings', 'startLibraryMove');
		await pacerr.settle();

		const page = await pacerr.open('/settings');
		expect(page.text('.move')).toContain('stopped after 1 of 3 Parts');
		expect(page.text('.move')).toContain(inTheWay);
		expect(page.text('.move')).toContain(`2 Parts are still under ${pacerr.paths.library}`);
		expect(partsUnder(media)).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv'
		]);
		expect(partsUnder(pacerr.paths.library)).toEqual([
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv'
		]);
	});

	it('names every file left behind, so the user knows what to go and fix', async () => {
		const { pacerr } = await aMoveStoppedAfterOnePart();

		const page = await pacerr.open('/settings');

		expect(page.texts('.move .stranded li')).toEqual([
			join(pacerr.paths.library, 'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv'),
			join(pacerr.paths.library, 'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv')
		]);
	});
});

describe('a move the container was recreated in the middle of', () => {
	it('says what stopped it, with every Part still where Pacerr says it is', async () => {
		const pacerr = await aLibraryHoldingReverie();
		const media = anotherDirectory();
		await pacerr.submit('/settings', 'saveLibrary', { library: media });
		await pacerr.hold();
		await pacerr.submit('/settings', 'startLibraryMove');

		await pacerr.restart();

		const page = await pacerr.open('/settings');
		expect(page.text('.move')).toContain('Pacerr stopped while it was moving the Library');
		expect(page.text('.move')).toContain(`3 Parts are still under ${pacerr.paths.library}`);
		expect(partsUnder(media)).toEqual([]);
		expect(partsUnder(pacerr.paths.library)).toHaveLength(3);
	});
});

describe('a move run again once the problem is fixed', () => {
	it('offers to try again, and takes up only what is still at the old Library', async () => {
		const { pacerr, media, clear } = await aMoveStoppedAfterOnePart();
		const stopped = await pacerr.open('/settings');
		expect(stopped.texts('.move button')).toContain('Try again');

		clear();
		await pacerr.hold();
		const retrying = await pacerr.submit('/settings', 'startLibraryMove');

		expect(retrying.text('.move')).toContain('1 of 3 Parts moved');

		await pacerr.settle();

		const finished = await pacerr.open('/settings');
		expect(finished.text('.move')).toContain('Moved 3 Parts');
		expect(partsUnder(media)).toHaveLength(3);
		expect(partsUnder(pacerr.paths.library)).toEqual([]);
	});

	it('records every Part at the new Library, so a later move takes all three from there', async () => {
		const { pacerr, media, clear } = await aMoveStoppedAfterOnePart();
		clear();
		await pacerr.submit('/settings', 'startLibraryMove');
		await pacerr.settle();

		const page = await pacerr.submit('/settings', 'saveLibrary', { library: anotherDirectory() });

		expect(page.text('.move')).toContain(`3 Parts, 21 B, are still under ${media}`);
	});
});
