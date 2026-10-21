import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
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
import { defaultNamingTemplate } from '../src/lib/server/library/naming';

const firstPart = 'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv';

/** A tmpfs the temporary root is never on, so a hardlink between them genuinely fails. */
function otherFilesystem(): string {
	const directory = mkdtempSync('/dev/shm/pacerr-downloads-');
	onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

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

const libraryEntries = (pacerr: Pacerr): string[] => readdirSync(pacerr.paths.library).sort();

const libraryFiles = (pacerr: Pacerr): string[] =>
	readdirSync(pacerr.paths.library, { recursive: true })
		.map(String)
		.filter((entry) => statSync(join(pacerr.paths.library, entry)).isFile())
		.sort();

/** Reverie, monitored and downloaded: one Batch Release covering the Arc's three Parts. */
async function reverie(options: StartOptions = {}): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed, ...options });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
	finish(pacerr, 3);
	await pacerr.advance(minutes(15));
	return pacerr;
}

const acrossFilesystems = (): Promise<Pacerr> => reverie({ downloadsDir: otherFilesystem() });

/** Both one-off entries the Catalogue carries, monitored and downloaded: one Part each. */
async function specials(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	for (const arc of ['one-piece-fan-letter', 'warship-island-01-april-fools-2025']) {
		await pacerr.submit('/', 'toggleMonitoring', { arc });
		finish(pacerr, 1);
	}
	await pacerr.advance(minutes(15));
	return pacerr;
}

/** The watch page with one more Arc ahead of every Arc Pacerr has already seen. */
function withAnArcInserted(watchPage: string): string {
	const inserted = JSON.stringify({
		slug: 'gold-roger-executed',
		title: 'Gold Roger Executed',
		special: false,
		unfinished: false,
		backdrops: [],
		downloads: [],
		parts: [],
		unreleasedParts: []
	}).replace(/"/g, '\\"');
	return watchPage.replace('\\"segments\\":[', `\\"segments\\":[${inserted},`);
}

/** The watch page with one more special ahead of every Arc Pacerr has already seen. */
function withASpecialInserted(watchPage: string): string {
	const inserted = JSON.stringify({
		slug: 'the-tatsumaki-incident',
		title: 'The Tatsumaki Incident',
		special: true,
		unfinished: false,
		backdrops: [],
		downloads: [],
		parts: [
			{
				slug: 'the-tatsumaki-incident-01',
				part: 1,
				title: 'The Tatsumaki Incident',
				toBeRedone: false,
				downloads: []
			}
		],
		unreleasedParts: []
	}).replace(/"/g, '\\"');
	return watchPage.replace('\\"segments\\":[', `\\"segments\\":[${inserted},`);
}

describe('importing a completed download', () => {
	it('files it into the Library without being asked', async () => {
		const pacerr = await reverie();

		expect(libraryFiles(pacerr)).toEqual([
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv'
		]);
	});

	it('puts nothing but season directories at the root, so this reads as one show', async () => {
		const pacerr = await reverie();

		expect(libraryEntries(pacerr)).toEqual(['Season 34']);
	});

	it('shows every Part it filed as had, with the Resolution and Variant it holds', async () => {
		const pacerr = await reverie();

		const arc = await pacerr.open('/arcs/reverie');
		expect(arc.texts('tbody .have')).toEqual([
			'Reverie 1080p Regular',
			'Reverie 1080p Regular',
			'Reverie 1080p Regular'
		]);

		const arcs = await pacerr.open('/');
		expect(arcs.text('tbody tr:has(a[href="/arcs/reverie"])')).toContain('3 of 3');
	});

	it('records what it filed in History', async () => {
		const pacerr = await reverie();

		const page = await pacerr.open('/activity');
		expect(page.texts('.history .event').filter((event) => event === 'Imported')).toHaveLength(3);
		expect(page.texts('.history .detail')).toEqual([
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv',
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv'
		]);
	});

	it('hardlinks, so a Part does not occupy disk twice while it seeds', async () => {
		const pacerr = await reverie();

		const infohash = pacerr.downloadClient.added[0]!.infohash;
		expect(statSync(join(pacerr.paths.library, firstPart)).ino).toBe(
			statSync(join(pacerr.paths.downloads, infohash, '1.mkv')).ino
		);
	});
});

describe('a download Pacerr cannot read', () => {
	const unreadable = async (): Promise<Pacerr> => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const infohash = pacerr.downloadClient.added[0]!.infohash;
		pacerr.downloadClient.complete(infohash, join(pacerr.paths.downloads, infohash));
		await pacerr.advance(minutes(15));
		return pacerr;
	};

	it('says what went wrong and where, rather than losing the file quietly', async () => {
		const pacerr = await unreadable();

		const page = await pacerr.open('/activity');
		expect(page.texts('.history .event')).toContain('Failed to import');
		expect(page.text('.history')).toContain('holds 0 of the 3 files');
		expect(page.text('.history')).toContain(pacerr.paths.downloads);
	});

	it('leaves the Part wanted rather than claiming it is had', async () => {
		const pacerr = await unreadable();

		expect(libraryFiles(pacerr)).toEqual([]);
		expect((await pacerr.open('/arcs/reverie')).texts('tbody .have')).toEqual([
			'Missing',
			'Missing',
			'Missing'
		]);
		expect((await pacerr.open('/wanted')).text()).toContain('The Fifth Emperor');
	});
});

describe('the naming template', () => {
	const mine = '{arc}/{arc} - {season}x{episode} - {part}';

	it('files under the convention the user set instead of the default', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;

		await pacerr.submit('/settings', 'saveNamingTemplate', { template: mine });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		finish(pacerr, 3);
		await pacerr.advance(minutes(15));

		expect(libraryFiles(pacerr)).toEqual([
			'Reverie/Reverie - 34x01 - The Fifth Emperor.mkv',
			'Reverie/Reverie - 34x02 - A Beautiful World.mkv',
			'Reverie/Reverie - 34x03 - The Empty Throne.mkv'
		]);
	});

	it('is the default until it is changed, and survives a restart once it is', async () => {
		const pacerr = await startPacerr();
		expect((await pacerr.open('/settings')).attributes('input[name="template"]', 'value')).toEqual(
			[defaultNamingTemplate]
		);

		await pacerr.submit('/settings', 'saveNamingTemplate', { template: mine });
		await pacerr.restart();

		expect((await pacerr.open('/settings')).attributes('input[name="template"]', 'value')).toEqual(
			[mine]
		);
	});
});

describe('the one-off entries the Catalogue keeps alongside real Arcs', () => {
	it('files them under Specials, where a media server looks for them', async () => {
		const pacerr = await specials();

		expect(libraryEntries(pacerr)).toEqual(['Specials']);
		expect(libraryFiles(pacerr)).toEqual([
			'Specials/One Pace - S00E01 - One Piece Fan Letter [1080p].mkv',
			'Specials/One Pace - S00E02 - Warship Island 01 (April Fools 2025) [1080p].mkv'
		]);
	});
});

describe('an Arc that One Pace inserts above one already in the Library', () => {
	it('leaves every Arc below it exactly where it was', async () => {
		const pacerr = await reverie();

		pacerr.upstream.watchPage.publish(withAnArcInserted(fixtures.watchPage));
		await pacerr.advance(hours(24));
		expect((await pacerr.open('/')).text()).toContain('Gold Roger Executed');

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'gaimon' });
		finish(pacerr, 1);
		await pacerr.advance(minutes(15));

		expect(libraryFiles(pacerr)).toEqual([
			"Season 04/One Pace - S04E01 - You're the Weird Animal [1080p].mkv",
			'Season 34/One Pace - S34E01 - The Fifth Emperor [1080p].mkv',
			'Season 34/One Pace - S34E02 - A Beautiful World [1080p].mkv',
			'Season 34/One Pace - S34E03 - The Empty Throne [1080p].mkv'
		]);
	});
});

describe('a special One Pace publishes after the Library already holds one', () => {
	it('takes a place of its own rather than renumbering the specials already filed', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'one-piece-fan-letter' });
		finish(pacerr, 1);
		await pacerr.advance(minutes(15));

		pacerr.upstream.watchPage.publish(withASpecialInserted(fixtures.watchPage));
		await pacerr.advance(hours(24));
		expect((await pacerr.open('/')).text()).toContain('The Tatsumaki Incident');

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'warship-island-01-april-fools-2025' });
		finish(pacerr, 1);
		await pacerr.advance(minutes(15));

		expect(libraryFiles(pacerr)).toEqual([
			'Specials/One Pace - S00E01 - One Piece Fan Letter [1080p].mkv',
			'Specials/One Pace - S00E02 - Warship Island 01 (April Fools 2025) [1080p].mkv'
		]);
	});
});

describe('a Library and a download directory on different filesystems', () => {
	it('copies instead of hardlinking, rather than failing the import', async () => {
		const pacerr = await acrossFilesystems();

		const infohash = pacerr.downloadClient.added[0]!.infohash;
		const imported = join(pacerr.paths.library, firstPart);
		expect(readFileSync(imported, 'utf8')).toBe('video 1');
		expect(statSync(imported).ino).not.toBe(
			statSync(join(pacerr.paths.downloads, infohash, '1.mkv')).ino
		);
	});

	it('says it copied rather than doing it silently', async () => {
		const pacerr = await acrossFilesystems();

		const page = await pacerr.open('/activity');
		expect(page.texts('.history .event')).toContain('Imported, with a warning');
		expect(page.text('.history')).toContain('on different filesystems');
		expect(page.text('.history')).toContain('occupies disk twice');
	});
});
