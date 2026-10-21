import { describe, expect, it } from 'vitest';
import { startPacerr } from './harness/pacerr';

describe('Security', () => {
	it('is a page of its own that saves the login', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/settings/security', 'saveAuthentication', {
			enabled: 'on',
			username: 'captain',
			password: 'all-blue-or-bust'
		});

		expect(page.attributes('input[name="username"]', 'value')).toEqual(['captain']);
		expect((await pacerr.open('/settings')).texts('h2')).not.toContain('Security');
	});
});

describe('the Download Client', () => {
	it('is a page of its own that saves the connection', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/settings/download-client', 'saveDownloadClient', {
			url: 'http://qbittorrent.test:8080',
			username: 'admin',
			password: 'adminadmin'
		});

		expect(page.attributes('input[name="url"]', 'value')).toEqual([
			'http://qbittorrent.test:8080'
		]);
		expect((await pacerr.open('/settings')).texts('h2')).not.toContain('Download Client');
	});
});

describe('Manual Import', () => {
	it('is a page of its own that saves the Import Source', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/settings/manual-import', 'saveImportSource', {
			importSource: pacerr.paths.downloads
		});

		expect(page.attributes('input[name="importSource"]', 'value')).toEqual([
			pacerr.paths.downloads
		]);
		expect((await pacerr.open('/settings')).texts('h2')).not.toContain('Manual Import');
	});
});

describe('Media Management', () => {
	it('is where the Library, the download directory and Remote Path Mappings all live', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/settings/media-management');

		expect(page.attributes('input[name="library"]', 'value')).toEqual([pacerr.paths.library]);
		expect(page.attributes('input[name="downloads"]', 'value')).toEqual([pacerr.paths.downloads]);
		expect(page.texts('form[action="?/addRemotePathMapping"] button')).toEqual(['Add']);
		expect(page.texts('form[action="?/saveNamingTemplate"] button')).toEqual(['Save']);
		const settings = await pacerr.open('/settings');
		expect(settings.attributes('input[name="library"]', 'value')).toEqual([]);
		expect(settings.attributes('input[name="downloads"]', 'value')).toEqual([]);
	});
});

describe('Metadata', () => {
	it('is where the Sidecar switches live', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/settings/metadata', 'saveSidecars', { arcNfo: 'on' });

		expect(page.attributes('input[name="arcNfo"]', 'checked')).toEqual(['']);
		expect(page.attributes('input[name="showNfo"]', 'checked')).toEqual([null]);
	});
});

describe('the Settings sub-navigation', () => {
	const categories = [
		['/settings', 'Profile'],
		['/settings/media-management', 'Media Management'],
		['/settings/download-client', 'Download Client'],
		['/settings/metadata', 'Metadata'],
		['/settings/manual-import', 'Manual Import'],
		['/settings/security', 'Security']
	];

	it('reaches six pages directly and marks the one being looked at', async () => {
		const pacerr = await startPacerr();
		const labels = categories.map(([, label]) => label);

		for (const [path, label] of categories) {
			const page = await pacerr.open(path ?? '/settings');

			expect(page.texts('nav[aria-label="Settings"] a')).toEqual(labels);
			expect(page.attributes('nav[aria-label="Settings"] a', 'href')).toEqual(
				categories.map(([href]) => href)
			);
			expect(page.texts('nav[aria-label="Settings"] a[aria-current="page"]')).toEqual([label]);
		}
	});
});
