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

describe('a setting that was refused', () => {
	it('says so on the page the save was made from', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.answer('/settings/media-management', 'addRemotePathMapping', {
			remotePath: '/data/torrents',
			localPath: ''
		});

		expect(page.text('.alert')).toBe('A Remote Path Mapping needs both paths.');
	});
});

describe('settings saved before Settings was split into pages', () => {
	it('are all still in effect once the container is recreated', async () => {
		const pacerr = await startPacerr();
		await pacerr.submit('/settings', 'saveProfile', {
			'resolution-1': '720',
			variant: 'extended',
			cutoff: '720'
		});
		await pacerr.submit('/settings/media-management', 'saveNamingTemplate', {
			template: '{arc}/{part}'
		});
		await pacerr.submit('/settings/media-management', 'addRemotePathMapping', {
			remotePath: '/data/torrents',
			localPath: '/downloads'
		});
		await pacerr.submit('/settings/download-client', 'saveDownloadClient', {
			url: 'http://qbittorrent.lan:8080',
			username: 'admin',
			password: 'hunter2'
		});
		await pacerr.submit('/settings/metadata', 'saveSidecars', { showNfo: 'on' });
		await pacerr.submit('/settings/manual-import', 'saveImportSource', {
			importSource: pacerr.paths.downloads
		});

		await pacerr.restart();

		const profile = await pacerr.open('/settings');
		expect(profile.attributes('select[name="variant"] option[selected]', 'value')).toEqual([
			'extended'
		]);
		const media = await pacerr.open('/settings/media-management');
		expect(media.attributes('input[name="template"]', 'value')).toEqual(['{arc}/{part}']);
		expect(media.attributes('input[name="library"]', 'value')).toEqual([pacerr.paths.library]);
		expect(media.text('.mapping-list')).toContain('/data/torrents');
		expect(
			(await pacerr.open('/settings/download-client')).attributes('input[name="url"]', 'value')
		).toEqual(['http://qbittorrent.lan:8080']);
		const metadata = await pacerr.open('/settings/metadata');
		expect(metadata.attributes('input[name="showNfo"]', 'checked')).toEqual(['']);
		expect(metadata.attributes('input[name="partNfo"]', 'checked')).toEqual([null]);
		expect(
			(await pacerr.open('/settings/manual-import')).attributes(
				'input[name="importSource"]',
				'value'
			)
		).toEqual([pacerr.paths.downloads]);
	});
});
