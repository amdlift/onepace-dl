import {
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
import sharp from 'sharp';
import { describe, expect, it, onTestFinished } from 'vitest';
import { fixtures, hours, minutes, startPacerr, type Pacerr } from './harness/pacerr';

/** Drive the download Pacerr grabbed last to completion, with real files on a real filesystem. */
function finish(pacerr: Pacerr, fileCount: number): string {
	const infohash = pacerr.downloadClient.added.at(-1)!.infohash;
	const content = join(pacerr.paths.downloads, infohash);
	mkdirSync(content, { recursive: true });
	for (let position = 1; position <= fileCount; position += 1) {
		writeFileSync(join(content, `${position}.mkv`), `video ${position}`);
	}
	pacerr.downloadClient.complete(infohash, content);
	return infohash;
}

const libraryFiles = (pacerr: Pacerr): string[] =>
	readdirSync(pacerr.paths.library, { recursive: true })
		.map(String)
		.filter((entry) => statSync(join(pacerr.paths.library, entry)).isFile())
		.sort();

const libraryDirectories = (pacerr: Pacerr): string[] =>
	readdirSync(pacerr.paths.library, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

const libraryTimestamps = (pacerr: Pacerr): Record<string, bigint> =>
	Object.fromEntries(
		libraryFiles(pacerr).map((file) => [
			file,
			statSync(join(pacerr.paths.library, file), { bigint: true }).mtimeNs
		])
	);

const inLibrary = (pacerr: Pacerr, path: string): string =>
	readFileSync(join(pacerr.paths.library, path), 'utf8');

/** Reverie, monitored and downloaded: one Batch Release covering the Arc's three Parts. */
async function reverie(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
	finish(pacerr, 3);
	await pacerr.advance(minutes(15));
	return pacerr;
}

/** The watch page as it reads once One Pace has corrected one Part's description. */
const aCorrectedWatchPage = (): string =>
	// Same length, because the payload the watch page carries is chunked by byte count.
	fixtures.watchPage.replaceAll('a vicious band of pirates', 'a brutish band of pirates');

/** The one-off entry One Pace publishes no description for, monitored and downloaded alone. */
async function warshipIsland(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'warship-island-01-april-fools-2025' });
	finish(pacerr, 1);
	await pacerr.advance(minutes(15));
	return pacerr;
}

describe('a Part Pacerr files into the Library', () => {
	it('gets a Sidecar beside its video file', async () => {
		const pacerr = await reverie();

		expect(libraryFiles(pacerr)).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv',
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].nfo',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].nfo',
			'Season 34/cover.jpg',
			'Season 34/season.nfo',
			'tvshow.nfo'
		]);
	});

	it('is described there by its title, its description and what it covers', async () => {
		const pacerr = await reverie();

		await expect(
			inLibrary(pacerr, 'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo')
		).toMatchFileSnapshot('./fixtures/sidecars/reverie-01.nfo');
	});
});

describe('a Part One Pace publishes no description for', () => {
	it('is still described by its title and what it covers', async () => {
		const pacerr = await warshipIsland();

		await expect(
			inLibrary(
				pacerr,
				'Specials/One Pace - S00E02 - Warship Island 01 (April Fools 2025) [1080p].nfo'
			)
		).toMatchFileSnapshot('./fixtures/sidecars/warship-island-01-april-fools-2025-01.nfo');
	});
});

describe('a Part Pacerr does not hold', () => {
	it('gets no Sidecar, so no season directory holds metadata and no media', async () => {
		const pacerr = await warshipIsland();

		expect(libraryFiles(pacerr)).toEqual([
			'Specials/One Pace - S00E02 - Warship Island 01 (April Fools 2025) [1080p].mkv',
			'Specials/One Pace - S00E02 - Warship Island 01 (April Fools 2025) [1080p].nfo',
			'Specials/season.nfo',
			'tvshow.nfo'
		]);
	});
});

describe('an Arc Pacerr holds no Part of', () => {
	it('is described nowhere, so a media server is shown no season it cannot play', async () => {
		const pacerr = await reverie();

		expect(libraryFiles(pacerr).filter((file) => file.endsWith('season.nfo'))).toEqual([
			'Season 34/season.nfo'
		]);
	});
});

describe('the one season every special shares', () => {
	it('is described as the Specials rather than as whichever special landed last', async () => {
		const pacerr = await warshipIsland();

		await expect(inLibrary(pacerr, 'Specials/season.nfo')).toMatchFileSnapshot(
			'./fixtures/sidecars/specials-season.nfo'
		);
	});
});

describe('a Library filed under a naming template the user set', () => {
	it('keeps each Sidecar with the media it describes, wherever that template files it', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;
		await pacerr.submit('/settings', 'saveNamingTemplate', {
			template: '{arc}/{arc} - {season}x{episode} - {part}'
		});
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		finish(pacerr, 3);
		await pacerr.advance(minutes(15));

		expect(libraryFiles(pacerr)).toEqual([
			'Reverie/Reverie - 34x01 - The Fifth Emperor.mkv',
			'Reverie/Reverie - 34x01 - The Fifth Emperor.nfo',
			'Reverie/Reverie - 34x02 - A Beautiful World.mkv',
			'Reverie/Reverie - 34x02 - A Beautiful World.nfo',
			'Reverie/Reverie - 34x03 - The Empty Throne.mkv',
			'Reverie/Reverie - 34x03 - The Empty Throne.nfo',
			'Reverie/cover.jpg',
			'Reverie/season.nfo',
			'tvshow.nfo'
		]);
	});
});

describe('a description One Pace writes a markup character into', () => {
	it('reaches the Library as a document that still parses', async () => {
		const pacerr = await startPacerr({
			// Same length, because the payload the watch page carries is chunked by byte count.
			watchPage: fixtures.watchPage.replaceAll(
				'a vicious band of pirates',
				'a <vicious> band & pirate'
			),
			feed: fixtures.feed
		});
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		finish(pacerr, 3);
		await pacerr.advance(minutes(15));

		expect(
			inLibrary(pacerr, 'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo')
		).toContain('a raid by a &lt;vicious&gt; band &amp; pirate on the Kingdom');
	});

	it('reaches a season the same way, because an Arc is described by One Pace too', async () => {
		const pacerr = await startPacerr({
			watchPage: fixtures.watchPage.replaceAll(
				'a mutually agreed upon path',
				'a <mutual> & agreed pathway'
			),
			feed: fixtures.feed
		});
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		finish(pacerr, 3);
		await pacerr.advance(minutes(15));

		expect(inLibrary(pacerr, 'Season 34/season.nfo')).toContain(
			'discuss a &lt;mutual&gt; &amp; agreed pathway for the government'
		);
	});
});

describe('a Part the user imported by hand', () => {
	it('gets the Sidecar a downloaded Part gets, from the Catalogue either way', async () => {
		const pacerr = await startPacerr();
		const source = mkdtempSync(join(tmpdir(), 'pacerr-source-'));
		onTestFinished(() => rmSync(source, { recursive: true, force: true }));
		writeFileSync(join(source, 'Drum Island 01.mkv'), 'video');
		await pacerr.submit('/settings', 'saveImportSource', { importSource: source });

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01'
		});

		await expect(
			inLibrary(pacerr, 'Season 13/One Pace - S13E01 - Tin Plate Wapol [unknown].nfo')
		).toMatchFileSnapshot('./fixtures/sidecars/drum-island-01.nfo');
	});
});

describe('the date One Pace published a Release', () => {
	it('never reaches a Sidecar as an air date, which is not what it is', async () => {
		const pacerr = await reverie();

		const sidecars = libraryFiles(pacerr).filter((file) => file.endsWith('.nfo'));
		expect(sidecars).toHaveLength(5);
		for (const sidecar of sidecars) {
			expect(inLibrary(pacerr, sidecar)).not.toMatch(/<(aired|premiered|year|dateadded)>/);
		}
	});
});

describe('the Library a media server is pointed at', () => {
	it('says at its root what show it is holding', async () => {
		const pacerr = await reverie();

		await expect(inLibrary(pacerr, 'tvshow.nfo')).toMatchFileSnapshot(
			'./fixtures/sidecars/tvshow.nfo'
		);
	});
});

describe('a season a media server browses', () => {
	it('is titled and described by the Arc its Parts recut, rather than by its number', async () => {
		const pacerr = await reverie();

		await expect(inLibrary(pacerr, 'Season 34/season.nfo')).toMatchFileSnapshot(
			'./fixtures/sidecars/reverie-season.nfo'
		);
	});
});

describe('the Poster a media server shows for a season', () => {
	it('lands in the season directory as cover.jpg, at Poster dimensions', async () => {
		const pacerr = await reverie();

		const poster = await sharp(join(pacerr.paths.library, 'Season 34/cover.jpg')).metadata();

		expect(poster.format).toBe('jpeg');
		expect([poster.width, poster.height]).toEqual([1000, 1500]);
	});

	it('is the one the user supplied for the Arc, where they have supplied one', async () => {
		const pacerr = await reverie();
		const mine = Buffer.from('\xff\xd8\xffthe Poster I chose myself', 'latin1');
		mkdirSync(join(pacerr.paths.config, 'posters'), { recursive: true });
		writeFileSync(join(pacerr.paths.config, 'posters', 'gaimon.jpg'), mine);

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'gaimon' });
		finish(pacerr, 1);
		await pacerr.advance(minutes(15));

		expect(readFileSync(join(pacerr.paths.library, 'Season 04/cover.jpg'))).toEqual(mine);
	});

	it('is not written for a season holding no Part, which would be artwork and no video', async () => {
		const pacerr = await reverie();

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'gaimon' });
		await pacerr.advance(minutes(15));

		expect(libraryDirectories(pacerr)).toEqual(['Season 34']);
		expect(libraryFiles(pacerr).filter((file) => file.endsWith('cover.jpg'))).toEqual([
			'Season 34/cover.jpg'
		]);
	});
});

describe('a description One Pace corrects upstream', () => {
	it('reaches the Sidecar describing that Part, after a clean scrape', async () => {
		const pacerr = await reverie();

		pacerr.upstream.watchPage.publish(aCorrectedWatchPage());
		await pacerr.advance(hours(24));

		expect(
			inLibrary(pacerr, 'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo')
		).toContain('a brutish band of pirates on the Kingdom');
	});
});

describe('a clean scrape that corrects one description', () => {
	it('rewrites that Sidecar and leaves every other file in the Library untouched', async () => {
		const pacerr = await reverie();
		const before = libraryTimestamps(pacerr);

		pacerr.upstream.watchPage.publish(aCorrectedWatchPage());
		await pacerr.advance(hours(24));

		const after = libraryTimestamps(pacerr);
		expect(Object.keys(after).filter((file) => after[file] !== before[file])).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo'
		]);
	});
});

describe('a scrape that brings back the Catalogue Pacerr already had', () => {
	it('rewrites nothing in the Library at all', async () => {
		const pacerr = await reverie();
		const before = libraryTimestamps(pacerr);
		const scrapes = pacerr.upstream.watchPage.requestCount;

		await pacerr.advance(hours(24));

		expect(pacerr.upstream.watchPage.requestCount).toBe(scrapes + 1);
		expect(libraryTimestamps(pacerr)).toEqual(before);
	});
});

describe('the Arcs a clean scrape describes again', () => {
	it('are only the ones Pacerr holds a Part of, so no season is metadata and no video', async () => {
		const pacerr = await reverie();
		const files = libraryFiles(pacerr);

		pacerr.upstream.watchPage.publish(aCorrectedWatchPage());
		await pacerr.advance(hours(24));

		expect(libraryDirectories(pacerr)).toEqual(['Season 34']);
		expect(libraryFiles(pacerr)).toEqual(files);
	});
});

describe('a Sidecar someone wrote over by hand', () => {
	const writtenOver = async (): Promise<Pacerr> => {
		const pacerr = await reverie();
		writeFileSync(join(pacerr.paths.library, 'Season 34/season.nfo'), 'written over by hand');
		return pacerr;
	};

	it('survives a scrape One Pace did not answer, which corrects nothing', async () => {
		const pacerr = await writtenOver();
		pacerr.upstream.watchPage.fail(503);

		await pacerr.advance(hours(24));

		expect(inLibrary(pacerr, 'Season 34/season.nfo')).toBe('written over by hand');
	});

	it('is put back by the next scrape that arrives whole', async () => {
		const pacerr = await writtenOver();

		pacerr.upstream.watchPage.publish(aCorrectedWatchPage());
		await pacerr.advance(hours(24));

		expect(inLibrary(pacerr, 'Season 34/season.nfo')).toContain('<title>Reverie</title>');
	});
});

describe('a Library Pacerr has put nothing in yet', () => {
	it('stays empty through a clean scrape, rather than gaining a show with no Parts', async () => {
		const pacerr = await startPacerr();

		pacerr.upstream.watchPage.publish(aCorrectedWatchPage());
		await pacerr.advance(hours(24));

		expect(libraryFiles(pacerr)).toEqual([]);
	});
});
