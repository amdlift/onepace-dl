import { describe, expect, it } from 'vitest';
import { fixtures, hours, startPacerr } from './harness/pacerr';

const bootedAt = '2026-10-19 22:00 UTC';
const aDayLater = '2026-10-20 22:00 UTC';

describe('the Arcs view', () => {
	it('lists every Arc One Pace publishes, with its Part count and cover artwork', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/');

		const rows = page.texts('tbody tr');
		expect(rows).toHaveLength(38);
		expect(rows[0]).toContain('Romance Dawn');
		expect(rows[0]).toContain('4 Parts');
		expect(page.attributes('tbody tr img', 'src')[0]).toBe(
			`${pacerr.upstream.url}/_next/static/media/50-backdrop-village-cows.0s-z7zeune8vi.jpg`
		);
	});

	it('lists one-off and joke entries alongside real Arcs', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/');

		expect(page.text()).toContain('Warship Island 01 (April Fools 2025)');
		expect(page.text()).toContain('One Piece Fan Letter');
	});

	it('badges an Arc whose only coverage is a Batch, with the Resolution that leaves it at', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const rows = (await pacerr.open('/')).texts('tbody tr');

		expect(rows.find((row) => row.startsWith('Whisky Peak'))).toContain('Batch only 480p');
		expect(rows.find((row) => row.startsWith('Thriller Bark'))).toContain('Batch only 720p');
	});

	it('leaves an Arc One Pace has begun re-cutting Part by Part unbadged', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const rows = (await pacerr.open('/')).texts('tbody tr');

		expect(rows.find((row) => row.startsWith('Fishman Island'))).not.toContain('Batch only');
	});
});

describe('scraping the Catalogue', () => {
	it('scrapes on startup', async () => {
		const pacerr = await startPacerr();

		expect(pacerr.upstream.watchPage.requestCount).toBe(1);
		expect((await pacerr.open('/')).text()).toContain(`Updated ${bootedAt}`);
	});

	it('scrapes again a day later, and not before', async () => {
		const pacerr = await startPacerr();

		await pacerr.advance(hours(23));
		expect(pacerr.upstream.watchPage.requestCount).toBe(1);

		await pacerr.advance(hours(1));
		expect(pacerr.upstream.watchPage.requestCount).toBe(2);
	});

	it('picks up an Arc that changed upstream on the next daily scrape', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.publish(fixtures.watchPage.replaceAll('Romance Dawn', 'Romance Dusk'));

		await pacerr.advance(hours(24));

		const page = await pacerr.open('/');
		expect(page.text()).toContain('Romance Dusk');
		expect(page.text()).toContain(`Updated ${aDayLater}`);
	});

	it('scrapes on demand when a person asks for a refresh', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.publish(fixtures.watchPage.replaceAll('Whisky Peak', 'Whiskey Peak'));

		const page = await pacerr.submit('/', 'refreshCatalogue');

		expect(page.text()).toContain('Whiskey Peak');
	});

	it('leaves the Catalogue alone when the watch page has not changed', async () => {
		const pacerr = await startPacerr();

		await pacerr.advance(hours(24));

		const page = await pacerr.open('/');
		expect(page.text()).toContain(`Checked ${aDayLater}`);
		expect(page.text()).toContain(`Updated ${bootedAt}`);
	});

	it('sends conditional requests, and takes a 304 as nothing to reparse', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.sendValidators();

		await pacerr.advance(hours(24));
		await pacerr.advance(hours(24));

		const lastRequest = pacerr.upstream.watchPage.requests.at(-1);
		expect(lastRequest?.headers['if-none-match']).toBe(pacerr.upstream.watchPage.etag);
		expect(lastRequest?.headers['if-modified-since']).toBeDefined();
		const page = await pacerr.open('/');
		expect(page.texts('tbody tr')).toHaveLength(38);
		expect(page.text()).toContain(`Updated ${bootedAt}`);
	});

	it('keeps the previous Catalogue when a scrape no longer parses', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.publish('<html><body>One Pace has been redesigned</body></html>');

		await pacerr.advance(hours(24));

		const page = await pacerr.open('/');
		expect(page.texts('tbody tr')).toHaveLength(38);
		expect(page.text()).toContain('The last Catalogue scrape failed');
		expect(page.text()).toContain(`Updated ${bootedAt}`);
	});

	it('keeps the previous Catalogue when One Pace is unreachable', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.fail(503);

		await pacerr.advance(hours(24));

		const page = await pacerr.open('/');
		expect(page.texts('tbody tr')).toHaveLength(38);
		expect(page.text()).toContain('The last Catalogue scrape failed');
	});
});

describe('the config volume', () => {
	it('still holds the Catalogue after Pacerr is recreated', async () => {
		const pacerr = await startPacerr();
		pacerr.upstream.watchPage.fail(503);

		await pacerr.restart();

		expect((await pacerr.open('/')).texts('tbody tr')).toHaveLength(38);
	});
});
