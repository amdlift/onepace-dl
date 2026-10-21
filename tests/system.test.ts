import { describe, expect, it } from 'vitest';
import { fixtures, hours, minutes, startPacerr } from './harness/pacerr';

const redesigned = '<html><body>One Pace has been redesigned</body></html>';

describe('the System view', () => {
	it('shows the time and the outcome of the last Catalogue scrape', async () => {
		const pacerr = await startPacerr();

		const checks = (await pacerr.open('/system')).text('.checks');

		expect(checks).toContain('Catalogue scrape');
		expect(checks).toContain('2026-10-19 22:00 UTC');
		expect(checks).toContain('Updated');
	});

	it('tells a scrape that stopped parsing apart from a quiet month upstream', async () => {
		const pacerr = await startPacerr();

		await pacerr.advance(hours(24));
		expect((await pacerr.open('/system')).text('.checks')).toContain('No new Parts');

		pacerr.upstream.watchPage.publish(redesigned);
		await pacerr.advance(hours(24));

		const checks = (await pacerr.open('/system')).text('.checks');
		expect(checks).toContain('Upstream changed shape');
		expect(checks).not.toContain('No new Parts');
	});

	it('shows how the last release feed poll went and whether the Download Client answers', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();

		const checks = (await pacerr.open('/system')).texts('.checks li');

		const feed = checks.find((check) => check.includes('Release feed'))!;
		expect(feed).toContain('Updated');
		expect(feed).toContain('2026-10-19 22:00 UTC');
		expect(checks.find((check) => check.includes('Download Client'))).toContain(
			'The Download Client answered'
		);
	});
});

describe('Unmatched Releases', () => {
	it('leads with the ones One Pace still calls current, which are the ones worth reading', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/system');

		expect(page.text('.unmatched')).toContain('251 Unmatched Releases');
		const current = page.texts('.current-unmatched tbody tr');
		expect(current).toHaveLength(9);
		expect(current[0]).toContain('Arabasta 16');
		expect(current[0]).toContain('e513256e0e4f24fc950dd5c1aec9a38c9e5a75d2');
	});

	it('keeps the ones One Pace has delisted available without treating them as anomalies', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/system');

		expect(page.text('.delisted summary')).toContain('242');
		expect(page.texts('.delisted tbody tr')).toHaveLength(242);
	});

	it('counts only the current ones against Pacerr, so a feed of superseded cuts is quiet', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const checks = (await pacerr.open('/system')).texts('.checks li');

		const unmatched = checks.find((check) => check.includes('Unmatched Releases'))!;
		expect(unmatched).toContain('9');
		expect(unmatched).not.toContain('251');
		expect((await pacerr.open('/')).text('.banner')).toBe('');
	});
});

describe('the full History', () => {
	it('is browsable a page at a time rather than stopping at the most recent few', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'monitorAllArcs');

		const newest = await pacerr.open('/system');
		expect(newest.texts('.history tbody tr')).toHaveLength(100);

		const older = newest.attributes('.history a', 'href').find((href) => href !== null)!;
		const next = await pacerr.open(older);

		expect(next.texts('.history tbody tr')).toHaveLength(100);
		expect(next.text('.history tbody tr')).not.toBe(newest.text('.history tbody tr'));
	});

	it('shows a grab the Download Client refused, with the reason it gave', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.reachable = false;

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const history = (await pacerr.open('/system')).text('.history');
		expect(history).toContain('Failed to grab');
		expect(history).toContain('unreachable');
	});
});

describe('an unreachable Download Client', () => {
	it('says so on every view, and clears once it answers again', async () => {
		const pacerr = await startPacerr();
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.reachable = false;

		await pacerr.advance(minutes(15));
		expect((await pacerr.open('/')).text('.banner')).toContain('Download Client');

		pacerr.downloadClient.reachable = true;
		await pacerr.advance(minutes(15));

		expect((await pacerr.open('/')).text('.banner')).toBe('');
	});

	it('is not raised against a Pacerr that has simply not been given one yet', async () => {
		const pacerr = await startPacerr();

		await pacerr.advance(minutes(15));

		expect((await pacerr.open('/')).text('.banner')).toBe('');
		expect((await pacerr.open('/system')).text('.checks')).toContain(
			'No Download Client is configured'
		);
	});
});

describe('the health banner', () => {
	const views = ['/', '/activity', '/wanted', '/settings', '/system'];

	it('says so on every view while the Catalogue scrape is failing', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.publish(redesigned);

		await pacerr.advance(hours(24));

		for (const view of views) {
			expect((await pacerr.open(view)).text('.banner')).toContain('no longer parses');
		}
	});

	it('says nothing to a visitor who has not signed in', async () => {
		const pacerr = await startPacerr();
		await pacerr.submit('/settings/security', 'saveAuthentication', {
			enabled: 'on',
			username: 'captain',
			password: 'all-blue-or-bust'
		});
		pacerr.forget();
		pacerr.upstream.watchPage.publish(redesigned);

		await pacerr.advance(hours(24));

		expect((await pacerr.open('/login')).text('.banner')).toBe('');
	});

	it('goes away on its own once One Pace parses again', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.publish(redesigned);
		await pacerr.advance(hours(24));
		expect((await pacerr.open('/')).text('.banner')).toContain('no longer parses');

		pacerr.upstream.watchPage.publish(fixtures.watchPage);
		await pacerr.advance(hours(24));

		for (const view of views) {
			expect((await pacerr.open(view)).text('.banner')).toBe('');
		}
	});
});
