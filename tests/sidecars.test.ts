import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { anotherDirectory, directoriesIn, filesUnder } from './harness/files';
import {
	fixtures,
	hours,
	minutes,
	startPacerr,
	type Pacerr,
	type PacerrPage
} from './harness/pacerr';

const libraryFiles = (pacerr: Pacerr): string[] => filesUnder(pacerr.paths.library);

const libraryDirectories = (pacerr: Pacerr): string[] => directoriesIn(pacerr.paths.library);

const libraryTimestamps = (pacerr: Pacerr): Record<string, bigint> =>
	Object.fromEntries(
		libraryFiles(pacerr).map((file) => [
			file,
			statSync(join(pacerr.paths.library, file), { bigint: true }).mtimeNs
		])
	);

const inLibrary = (pacerr: Pacerr, path: string): string =>
	readFileSync(join(pacerr.paths.library, path), 'utf8');

/** Which Sidecar kinds the Settings page reports as switched on. */
const switchesOn = (page: PacerrPage): Record<string, boolean> =>
	Object.fromEntries(
		[...page.document.querySelectorAll('input[type="checkbox"]')].map((input) => [
			input.getAttribute('name'),
			input.hasAttribute('checked')
		])
	);

/** Reverie, monitored and downloaded: one Batch Release covering the Arc's three Parts. */
async function reverie(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
	pacerr.finishDownload(3);
	await pacerr.advance(minutes(15));
	return pacerr;
}

/** The watch page as it reads once One Pace has corrected one Part's description. */
const aCorrectedWatchPage = (): string =>
	// Same length, because the payload the watch page carries is chunked by byte count.
	fixtures.watchPage.replaceAll('a vicious band of pirates', 'a brutish band of pirates');

/** The same correction, reaching an Arc's description as well as a Part's. */
const aCorrectedArcAndPart = (): string => aCorrectedWatchPage().replaceAll('agendas', 'schemes');

const sidecarKinds = ['showNfo', 'arcNfo', 'partNfo', 'arcPoster'] as const;

type SidecarKind = (typeof sidecarKinds)[number];

/** Save the Sidecars page with every switch on except the kinds named. */
const turnOff = (pacerr: Pacerr, ...off: SidecarKind[]): Promise<PacerrPage> =>
	pacerr.submit(
		'/settings/sidecars',
		'saveSidecars',
		Object.fromEntries(
			sidecarKinds.filter((kind) => !off.includes(kind)).map((kind) => [kind, 'on'])
		)
	);

/** Reverie downloaded and imported, with the kinds named switched off before any of it lands. */
async function reverieWithout(...off: SidecarKind[]): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await turnOff(pacerr, ...off);
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
	pacerr.finishDownload(3);
	await pacerr.advance(minutes(15));
	return pacerr;
}

/** The one-off entry One Pace publishes no description for, monitored and downloaded alone. */
async function warshipIsland(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'warship-island-01-april-fools-2025' });
	pacerr.finishDownload(1);
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
		pacerr.finishDownload(3);
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
		pacerr.finishDownload(3);
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
		pacerr.finishDownload(3);
		await pacerr.advance(minutes(15));

		expect(inLibrary(pacerr, 'Season 34/season.nfo')).toContain(
			'discuss a &lt;mutual&gt; &amp; agreed pathway for the government'
		);
	});
});

describe('a Part the user imported by hand', () => {
	it('gets the Sidecar a downloaded Part gets, from the Catalogue either way', async () => {
		const pacerr = await startPacerr();
		const source = anotherDirectory('pacerr-source-');
		writeFileSync(join(source, 'Drum Island 01.mkv'), 'video');
		await pacerr.submit('/settings/manual-import', 'saveImportSource', { importSource: source });

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
		pacerr.finishDownload(1);
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

describe('the Sidecars Pacerr writes', () => {
	it('each have a switch of their own in Settings, and every one of them starts on', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/settings/sidecars');

		expect(switchesOn(page)).toEqual({
			showNfo: true,
			arcNfo: true,
			partNfo: true,
			arcPoster: true
		});
	});

	it('are switched from a page Settings links to, rather than from somewhere buried', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/settings');

		expect(page.attributes('a', 'href')).toContain('/settings/sidecars');
	});
});

describe('a kind of Sidecar the user switched off', () => {
	it('is not written for a Part imported afterwards, and no other kind is affected', async () => {
		const pacerr = await reverieWithout('arcPoster');

		expect(libraryFiles(pacerr)).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv',
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].nfo',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].nfo',
			'Season 34/season.nfo',
			'tvshow.nfo'
		]);
	});

	it('takes the show NFO with it when it is that kind', async () => {
		const pacerr = await reverieWithout('showNfo');

		expect(libraryFiles(pacerr).filter((file) => !file.endsWith('.mkv'))).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].nfo',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].nfo',
			'Season 34/cover.jpg',
			'Season 34/season.nfo'
		]);
	});

	it('takes the season NFO with it when it is that kind', async () => {
		const pacerr = await reverieWithout('arcNfo');

		expect(libraryFiles(pacerr).filter((file) => !file.endsWith('.mkv'))).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].nfo',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].nfo',
			'Season 34/cover.jpg',
			'tvshow.nfo'
		]);
	});

	it('takes the episode NFO with it when it is that kind', async () => {
		const pacerr = await reverieWithout('partNfo');

		expect(libraryFiles(pacerr).filter((file) => !file.endsWith('.mkv'))).toEqual([
			'Season 34/cover.jpg',
			'Season 34/season.nfo',
			'tvshow.nfo'
		]);
	});

	it('leaves a Library of nothing but media once every switch is off', async () => {
		const pacerr = await reverieWithout(...sidecarKinds);

		expect(libraryFiles(pacerr)).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv'
		]);
	});

	it('is skipped by a Manual Import too, which files a Part just as a download does', async () => {
		const pacerr = await startPacerr();
		const source = anotherDirectory('pacerr-source-');
		writeFileSync(join(source, 'Drum Island 01.mkv'), 'video');
		await pacerr.submit('/settings/manual-import', 'saveImportSource', { importSource: source });
		await turnOff(pacerr, ...sidecarKinds);

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01'
		});

		expect(libraryFiles(pacerr)).toEqual([
			'Season 13/One Pace - S13E01 - Tin Plate Wapol [unknown].mkv'
		]);
	});
});

describe('switching a kind of Sidecar off', () => {
	it('leaves the files already in the Library exactly as they were', async () => {
		const pacerr = await reverie();
		const before = libraryFiles(pacerr);
		const season = inLibrary(pacerr, 'Season 34/season.nfo');
		const show = inLibrary(pacerr, 'tvshow.nfo');

		await turnOff(pacerr, ...sidecarKinds);
		await pacerr.advance(minutes(15));

		expect(libraryFiles(pacerr)).toEqual(before);
		expect(inLibrary(pacerr, 'Season 34/season.nfo')).toBe(season);
		expect(inLibrary(pacerr, 'tvshow.nfo')).toBe(show);
	});

	it('survives the container being recreated, so it is not reconfigured every upgrade', async () => {
		const pacerr = await startPacerr();
		await turnOff(pacerr, 'partNfo', 'arcPoster');

		await pacerr.restart();

		expect(switchesOn(await pacerr.open('/settings/sidecars'))).toEqual({
			showNfo: true,
			arcNfo: true,
			partNfo: false,
			arcPoster: false
		});
	});
});

describe('switching a kind of Sidecar back on', () => {
	it('starts it being written again for the next Part imported', async () => {
		const pacerr = await reverieWithout(...sidecarKinds);
		expect(libraryFiles(pacerr).filter((file) => !file.endsWith('.mkv'))).toEqual([]);

		await turnOff(pacerr);
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'gaimon' });
		pacerr.finishDownload(1);
		await pacerr.advance(minutes(15));

		expect(libraryFiles(pacerr).filter((file) => !file.endsWith('.mkv'))).toEqual([
			"Season 04/One Pace - S04E01 - You're the Weird Animal [1080p].nfo",
			'Season 04/cover.jpg',
			'Season 04/season.nfo',
			'tvshow.nfo'
		]);
	});
});

describe('a kind of Sidecar switched off after the Library already holds some', () => {
	it('is passed over by a clean scrape that refreshes the kinds still on', async () => {
		const pacerr = await reverie();
		await turnOff(pacerr, 'partNfo');
		const before = libraryTimestamps(pacerr);

		pacerr.upstream.watchPage.publish(aCorrectedArcAndPart());
		await pacerr.advance(hours(24));

		expect(
			inLibrary(pacerr, 'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].nfo')
		).toContain('a vicious band of pirates on the Kingdom');
		expect(inLibrary(pacerr, 'Season 34/season.nfo')).toContain('their own schemes arrive');
		const after = libraryTimestamps(pacerr);
		expect(Object.keys(after).filter((file) => after[file] !== before[file])).toEqual([
			'Season 34/season.nfo'
		]);
	});
});
