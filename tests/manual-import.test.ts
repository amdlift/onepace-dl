import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { fixtures, hours, startPacerr, type Pacerr, type PacerrPage } from './harness/pacerr';

/** What the view proposes for each listed file: its path against the Part slug pre-filled. */
function suggestions(page: PacerrPage): Record<string, string> {
	const paths = page.texts('tbody .file');
	const chosen = page.attributes('tbody select option[selected]', 'value');
	return Object.fromEntries(paths.map((path, index) => [path, chosen[index] ?? '(no option)']));
}

/** A directory of files the user already has, on the same filesystem the Library is on. */
function importSource(files: string[]): string {
	const root = mkdtempSync(join(tmpdir(), 'pacerr-source-'));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	for (const file of files) {
		const path = join(root, file);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `video ${file}`);
	}
	return root;
}

/** The media in the Library. What its Sidecars say is `tests/sidecars.test.ts`'s business. */
const libraryMedia = (pacerr: Pacerr): string[] =>
	readdirSync(pacerr.paths.library, { recursive: true })
		.map(String)
		.filter((entry) => !isSidecar(entry) && statSync(join(pacerr.paths.library, entry)).isFile())
		.sort();

const isSidecar = (entry: string): boolean =>
	extname(entry) === '.nfo' || basename(entry) === 'cover.jpg';

async function pacerrWith(files: string[]): Promise<{ pacerr: Pacerr; source: string }> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	const source = importSource(files);
	await pacerr.submit('/settings', 'saveImportSource', { importSource: source });
	return { pacerr, source };
}

describe('the Import Source', () => {
	it('is empty until it is configured, and survives a restart once it is', async () => {
		const pacerr = await startPacerr();
		expect(
			(await pacerr.open('/settings')).attributes('input[name="importSource"]', 'value')
		).toEqual(['']);

		const source = importSource([]);
		await pacerr.submit('/settings', 'saveImportSource', { importSource: source });
		await pacerr.restart();

		expect(
			(await pacerr.open('/settings')).attributes('input[name="importSource"]', 'value')
		).toEqual([source]);
	});

	it('says so when Manual Import has nowhere to look', async () => {
		const pacerr = await startPacerr();

		expect((await pacerr.open('/manual-import')).text()).toContain('no Import Source');
	});
});

describe('the bulk Manual Import view', () => {
	it('lists every video file under the Import Source, however deep', async () => {
		const { pacerr } = await pacerrWith([
			'Drum Island/Drum Island 01.mkv',
			'Drum Island/Drum Island 02.mkv',
			'Wano 60.mp4',
			'Drum Island/notes.txt'
		]);

		expect((await pacerr.open('/manual-import')).texts('tbody .file')).toEqual([
			'Drum Island/Drum Island 01.mkv',
			'Drum Island/Drum Island 02.mkv',
			'Wano 60.mp4'
		]);
	});

	it('pre-fills the Part each filename names', async () => {
		const { pacerr } = await pacerrWith([
			'[One Pace][140-143] Post-Enies Lobby 02 [1080p][A1B2C3D4].mkv',
			'Drum Island 01.mkv',
			'Gaimon.mkv'
		]);

		expect(suggestions(await pacerr.open('/manual-import'))).toEqual({
			'[One Pace][140-143] Post-Enies Lobby 02 [1080p][A1B2C3D4].mkv': 'post-enies-lobby-02',
			'Drum Island 01.mkv': 'drum-island-01',
			'Gaimon.mkv': 'gaimon-01'
		});
	});

	it('leaves a file it cannot place blank rather than guessing at it', async () => {
		const { pacerr } = await pacerrWith([
			'Holiday Footage 2019.mkv',
			'Romance Dawn [1080p].mkv',
			'Wano 99.mkv'
		]);

		expect(suggestions(await pacerr.open('/manual-import'))).toEqual({
			'Holiday Footage 2019.mkv': '',
			'Romance Dawn [1080p].mkv': '',
			'Wano 99.mkv': ''
		});
	});
});

describe('committing a Manual Import', () => {
	const drumIsland = 'Season 13/One Pace - S13E01 - Tin Plate Wapol [unknown].mkv';

	it('files the file the user confirmed under the same naming a download gets', async () => {
		const { pacerr, source } = await pacerrWith(['Drum Island 01.mkv']);

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01'
		});

		expect(libraryMedia(pacerr)).toEqual([drumIsland]);
		expect(statSync(join(pacerr.paths.library, drumIsland)).ino).toBe(
			statSync(join(source, 'Drum Island 01.mkv')).ino
		);
	});

	it('leaves a file the user did not assign a Part alone', async () => {
		const { pacerr } = await pacerrWith(['Drum Island 01.mkv', 'Drum Island 02.mkv']);

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01',
			'part:Drum Island 02.mkv': ''
		});

		expect(libraryMedia(pacerr)).toEqual([drumIsland]);
	});

	it('shows the Part as had with no Release, because Pacerr does not know what the file is', async () => {
		const { pacerr } = await pacerrWith(['Drum Island 01.mkv']);
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'drum-island' });
		expect((await pacerr.open('/wanted')).text()).toContain('Tin Plate Wapol');

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01'
		});

		const arc = await pacerr.open('/arcs/drum-island');
		expect(arc.texts('tbody .have')[0]).toBe('Imported');
		expect((await pacerr.open('/wanted')).text()).not.toContain('Tin Plate Wapol');
	});

	it('records what it brought in, in History', async () => {
		const { pacerr } = await pacerrWith(['Drum Island 01.mkv']);

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01'
		});

		const page = await pacerr.open('/activity');
		expect(page.texts('.history .event')).toContain('Manually imported');
		expect(page.texts('.history .detail')).toEqual([drumIsland]);
		expect(page.text('.history')).toContain('Tin Plate Wapol');
	});
});

describe('moving rather than hardlinking', () => {
	const drumIsland = 'Season 13/One Pace - S13E01 - Tin Plate Wapol [unknown].mkv';

	it('leaves nothing behind in the Import Source when the user asks it to move', async () => {
		const { pacerr, source } = await pacerrWith(['Drum Island 01.mkv']);

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01',
			placing: 'move'
		});

		expect(libraryMedia(pacerr)).toEqual([drumIsland]);
		expect(existsSync(join(source, 'Drum Island 01.mkv'))).toBe(false);
	});

	it('keeps the original where it was when it is not asked to', async () => {
		const { pacerr, source } = await pacerrWith(['Drum Island 01.mkv']);

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01'
		});

		expect(existsSync(join(source, 'Drum Island 01.mkv'))).toBe(true);
	});
});

describe('what Manual Import is allowed to read', () => {
	/** A file sitting outside every configured root, which nothing Pacerr serves may reach. */
	function elsewhere(near: string, name: string): string {
		const path = join(dirname(near), name);
		writeFileSync(path, 'not Pacerr business');
		onTestFinished(() => rmSync(path, { force: true }));
		return path;
	}

	it('browses the Library too, so a file already there can be reorganised', async () => {
		const { pacerr } = await pacerrWith([]);
		mkdirSync(join(pacerr.paths.library, 'Unsorted'), { recursive: true });
		writeFileSync(join(pacerr.paths.library, 'Unsorted/Drum Island 02.mkv'), 'video');

		const page = await pacerr.open('/manual-import?root=library');

		expect(suggestions(page)).toEqual({ 'Unsorted/Drum Island 02.mkv': 'drum-island-02' });
	});

	it('refuses a path crafted to climb out of the directory it was given', async () => {
		const { pacerr, source } = await pacerrWith(['Drum Island 01.mkv']);
		elsewhere(source, 'not-one-pace.mkv');

		await pacerr.submit('/manual-import', 'import', {
			'part:../not-one-pace.mkv': 'drum-island-01',
			'part:/etc/hostname': 'drum-island-02'
		});

		expect(libraryMedia(pacerr)).toEqual([]);
		expect((await pacerr.open('/activity')).text('.history')).toContain(
			'the Import Source and the Library and nothing else'
		);
	});

	it('refuses a symlink that leads out of the Import Source, and does not offer it', async () => {
		const { pacerr, source } = await pacerrWith(['Drum Island 01.mkv']);
		symlinkSync(elsewhere(source, 'not-one-pace.mkv'), join(source, 'Drum Island 02.mkv'));

		expect((await pacerr.open('/manual-import')).texts('tbody .file')).toEqual([
			'Drum Island 01.mkv'
		]);

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 02.mkv': 'drum-island-02'
		});
		expect(libraryMedia(pacerr)).toEqual([]);
	});
});

describe('filling a single gap from Wanted', () => {
	const drumIsland = 'Season 13/One Pace - S13E01 - Tin Plate Wapol [unknown].mkv';

	it('offers Manual Import as a row action on a Part Pacerr does not have', async () => {
		const { pacerr } = await pacerrWith(['Drum Island 01.mkv']);
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'drum-island' });

		const wanted = await pacerr.open('/wanted');

		expect(wanted.attributes('tbody a.manual-import', 'href')).toContain(
			'/manual-import?part=drum-island-01'
		);
	});

	it('files the one file the user picked against that Part, whatever Pacerr suggested', async () => {
		const { pacerr } = await pacerrWith(['Drum Island 01.mkv', 'Wano 60.mkv']);

		const page = await pacerr.open('/manual-import?part=drum-island-01');
		expect(page.text()).toContain('Tin Plate Wapol');

		await pacerr.submit('/manual-import', 'importOne', {
			part: 'drum-island-01',
			file: 'Wano 60.mkv'
		});

		expect(libraryMedia(pacerr)).toEqual([drumIsland]);
	});
});

describe('a path that never runs unattended', () => {
	it('files nothing on its own, however much time passes', async () => {
		const { pacerr } = await pacerrWith(['Drum Island 01.mkv', 'Wano 60.mkv']);

		await pacerr.advance(hours(48));

		expect(libraryMedia(pacerr)).toEqual([]);
		expect((await pacerr.open('/activity')).texts('.history .event')).not.toContain(
			'Manually imported'
		);
	});
});

describe('an Import Source on a filesystem the Library cannot be hardlinked to', () => {
	const drumIsland = 'Season 13/One Pace - S13E01 - Tin Plate Wapol [unknown].mkv';

	/** A tmpfs the Library's temporary root is never on, so a hardlink between them truly fails. */
	async function acrossFilesystems(): Promise<Pacerr> {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		const source = mkdtempSync('/dev/shm/pacerr-source-');
		onTestFinished(() => rmSync(source, { recursive: true, force: true }));
		writeFileSync(join(source, 'Drum Island 01.mkv'), 'video');
		await pacerr.submit('/settings', 'saveImportSource', { importSource: source });
		return pacerr;
	}

	it('copies instead of hardlinking, and says it did rather than doing it silently', async () => {
		const pacerr = await acrossFilesystems();

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01'
		});

		expect(libraryMedia(pacerr)).toEqual([drumIsland]);
		const page = await pacerr.open('/activity');
		expect(page.texts('.history .event')).toContain('Manually imported, with a warning');
		expect(page.text('.history')).toContain('on different filesystems');
	});

	it('still moves the file when asked to move it', async () => {
		const pacerr = await acrossFilesystems();

		await pacerr.submit('/manual-import', 'import', {
			'part:Drum Island 01.mkv': 'drum-island-01',
			placing: 'move'
		});

		expect(libraryMedia(pacerr)).toEqual([drumIsland]);
		expect((await pacerr.open('/activity')).texts('.history .event')).toEqual([
			'Manually imported'
		]);
	});
});
