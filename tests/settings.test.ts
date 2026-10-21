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
