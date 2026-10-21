import { chmodSync } from 'node:fs';
import { describe, expect, it, onTestFinished } from 'vitest';
import { anotherDirectory, filesUnder, onAnotherFilesystem } from './harness/files';
import { fixtures, minutes, startPacerr, type Pacerr } from './harness/pacerr';

/** Reverie grabbed and finished downloading, with nothing imported yet. */
async function downloadedReverie(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
	pacerr.finishDownload(3);
	return pacerr;
}

describe('a Library set in Settings', () => {
	it('is where the next import lands, without the container being restarted', async () => {
		const pacerr = await downloadedReverie();
		const media = anotherDirectory();

		await pacerr.submit('/settings', 'saveLibrary', { library: media });
		await pacerr.advance(minutes(15));

		expect(filesUnder(media).filter((file) => file.endsWith('.mkv'))).toHaveLength(3);
		expect(filesUnder(pacerr.paths.library)).toEqual([]);
	});

	it('is still there after the container is recreated', async () => {
		const pacerr = await startPacerr();
		const media = anotherDirectory();
		const completed = anotherDirectory('pacerr-finished-');
		await pacerr.submit('/settings', 'saveLibrary', { library: media });
		await pacerr.submit('/settings', 'saveDownloads', { downloads: completed });

		await pacerr.restart();

		const settings = await pacerr.open('/settings');
		expect(settings.attributes('input[name="library"]', 'value')).toEqual([media]);
		expect(settings.attributes('input[name="downloads"]', 'value')).toEqual([completed]);
	});
});

describe('saving a path Pacerr cannot use', () => {
	it('says it cannot find one that is not mounted', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/settings', 'saveLibrary', { library: '/no/such/place' });

		expect(page.text('.paths')).toContain('cannot find the Library at /no/such/place');
		expect(page.text('.paths')).not.toContain('cannot write to it');
	});

	it('says so on the save itself, rather than only on the page load after it', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.answer('/settings', 'saveLibrary', { library: '/no/such/place' });

		expect(page.text('.paths .alert')).toContain('cannot find the Library at /no/such/place');
	});

	it('names the problem the save has, where that one is a directory it cannot write', async () => {
		const pacerr = await startPacerr();
		const media = anotherDirectory();
		chmodSync(media, 0o555);
		onTestFinished(() => chmodSync(media, 0o755));

		const page = await pacerr.answer('/settings', 'saveLibrary', { library: media });

		expect(page.text('.paths .alert')).toContain(`can see the Library at ${media}`);
		expect(page.text('.paths .alert')).toContain('cannot write to it');
	});

	it('names it again where it is one the downloads cannot be hardlinked from', async () => {
		const pacerr = await startPacerr();
		const media = onAnotherFilesystem();

		const page = await pacerr.answer('/settings', 'saveLibrary', { library: media });

		expect(page.text('.paths .alert')).toContain('on different filesystems');
		expect(page.text('.paths .alert')).not.toContain('cannot find the Library');
	});

	it('reads differently for one it can see but not write to', async () => {
		const pacerr = await startPacerr();
		const media = anotherDirectory();
		chmodSync(media, 0o555);
		onTestFinished(() => chmodSync(media, 0o755));

		const page = await pacerr.submit('/settings', 'saveLibrary', { library: media });

		expect(page.text('.paths')).toContain(`can see the Library at ${media} but cannot write to it`);
		expect(page.text('.paths')).not.toContain('cannot find the Library');
	});

	it('reads differently again for one on a different filesystem from the downloads', async () => {
		const pacerr = await startPacerr();
		const media = onAnotherFilesystem();

		const page = await pacerr.submit('/settings', 'saveLibrary', { library: media });

		expect(page.text('.paths')).toContain('on different filesystems');
		expect(page.text('.paths')).toContain('occupies disk twice');
		expect(page.text('.paths')).not.toContain('cannot find the Library');
		expect(page.text('.paths')).not.toContain('cannot write to it');
	});
});

describe('a directory pinned by environment variable', () => {
	it('wins, renders read-only, and says where the value came from', async () => {
		const pinned = anotherDirectory('pacerr-pinned-');
		const pacerr = await startPacerr({ libraryFromEnvironment: pinned });

		const page = await pacerr.open('/settings');

		expect(page.attributes('input[name="library"]', 'value')).toEqual([pinned]);
		expect(page.attributes('input[name="library"]', 'readonly')).toEqual(['']);
		expect(page.text('.paths')).toContain('configured by PACERR_LIBRARY_DIR');
	});

	it('is not overwritten by a save of the field it never offered', async () => {
		const pinned = anotherDirectory('pacerr-pinned-');
		const pacerr = await startPacerr({ downloadsFromEnvironment: pinned });

		const page = await pacerr.submit('/settings', 'saveDownloads', {
			downloads: anotherDirectory()
		});

		expect(page.attributes('input[name="downloads"]', 'value')).toEqual([pinned]);
		expect(page.text('.paths')).toContain('configured by PACERR_DOWNLOADS_DIR');
	});
});

describe('a fresh install, which the image gives neither variable', () => {
	it('offers both fields for editing', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/settings');

		expect(page.attributes('input[name="library"]', 'readonly')).toEqual([null]);
		expect(page.attributes('input[name="downloads"]', 'readonly')).toEqual([null]);
		expect(page.texts('form[action="?/saveLibrary"] button')).toEqual(['Save']);
		expect(page.texts('form[action="?/saveDownloads"] button')).toEqual(['Save']);
	});
});
