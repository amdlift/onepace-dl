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
import { fixtures, minutes, startPacerr, type Pacerr } from './harness/pacerr';

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
			'Season 34/cover.jpg'
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
			'Specials/One Pace - S00E02 - Warship Island 01 (April Fools 2025) [1080p].nfo'
		]);
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
			'Reverie/cover.jpg'
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
		expect(sidecars).toHaveLength(3);
		for (const sidecar of sidecars) {
			expect(inLibrary(pacerr, sidecar)).not.toMatch(/<(aired|premiered|year|dateadded)>/);
		}
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

		expect(readdirSync(pacerr.paths.library).sort()).toEqual(['Season 34']);
		expect(libraryFiles(pacerr).filter((file) => file.endsWith('cover.jpg'))).toEqual([
			'Season 34/cover.jpg'
		]);
	});
});
