import { describe, expect, it } from 'vitest';
import { fixtures, minutes, startPacerr } from './harness/pacerr';

const wano62 = '405a772fb6c8a3a1f6a0b98fe17167d71320e402';

/** Rewrite one feed item, the way a new build of the feed would. */
function withinItem(feed: string, infohash: string, from: string, to: string): string {
	const start = feed.lastIndexOf('<item>', feed.indexOf(infohash));
	const end = feed.indexOf('</item>', start) + '</item>'.length;
	return feed.slice(0, start) + feed.slice(start, end).replace(from, to) + feed.slice(end);
}

const rebuilt = (feed: string, at: string): string =>
	feed.replace(/<lastBuildDate>[^<]*<\/lastBuildDate>/, `<lastBuildDate>${at}</lastBuildDate>`);

describe('joining Releases to Parts', () => {
	it('shows every Release covering a Part, with Resolution, Variant, Release Status and date', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const row = (await pacerr.open('/arcs/wano')).texts('tbody tr')[61]!;

		expect(row).toContain('1080p');
		expect(row).toContain('Regular');
		expect(row).toContain('Extended');
		expect(row).toContain('Current');
		expect(row).toContain('2026-09-20');
	});

	it('takes a Release size from the Catalogue, the only source that states one', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const row = (await pacerr.open('/arcs/wano')).texts('tbody tr')[61]!;

		expect(row).toContain('1.3 GiB');
		expect(row).toContain('1.7 GiB');
	});

	it('reads an alternate cut as the Variant it is', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		expect((await pacerr.open('/arcs/skypiea')).texts('tbody tr')[24]).toContain('Alternate');
	});

	it('joins where the two sources disagree about the name', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/arcs/alabasta');

		expect(page.text('h1')).toContain('Alabasta');
		expect(page.texts('tbody tr')[20]).toContain('1080p');
	});

	it('joins a Release whose title resembles nothing in the Catalogue', async () => {
		const pacerr = await startPacerr({
			feed: fixtures.feed.replace('<title>Wano 62</title>', '<title>Unrecognisable</title>')
		});

		expect((await pacerr.open('/arcs/wano')).texts('tbody tr')[61]).toContain('Regular');
	});

	it('leaves a Part the feed has published nothing for without a Release', async () => {
		const pacerr = await startPacerr();

		const rows = (await pacerr.open('/arcs/wano')).texts('tbody tr');

		expect(rows[0]).toContain('No Release');
		expect(rows[61]).toContain('No Release');
	});
});

describe('polling the release feed', () => {
	it('polls on startup', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		expect(pacerr.upstream.feed.requestCount).toBe(1);
		expect((await pacerr.open('/')).text()).toContain('513 Releases');
	});

	it('polls again a quarter of an hour later, and not before', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		await pacerr.advance(minutes(14));
		expect(pacerr.upstream.feed.requestCount).toBe(1);

		await pacerr.advance(minutes(1));
		expect(pacerr.upstream.feed.requestCount).toBe(2);
	});

	it('polls on demand when a person asks for a refresh', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		pacerr.upstream.feed.publish(
			rebuilt(
				withinItem(fixtures.feed, wano62, '<dd>1080p</dd>', '<dd>720p</dd>'),
				'Mon, 12 Oct 2026 09:00:00 GMT'
			)
		);

		await pacerr.submit('/', 'refreshReleases');

		expect((await pacerr.open('/arcs/wano')).texts('tbody tr')[61]).toContain('720p');
	});
});

describe('not reparsing an unchanged feed', () => {
	it("leaves the Releases alone when the feed's own last build has not moved", async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		pacerr.upstream.feed.publish(
			withinItem(fixtures.feed, wano62, '<dd>1080p</dd>', '<dd>720p</dd>')
		);

		await pacerr.advance(minutes(15));

		const page = await pacerr.open('/');
		expect(page.text()).toContain('Feed checked 2026-10-19 22:15 UTC');
		expect(page.text()).toContain('Feed updated 2026-10-19 22:00 UTC');
		expect((await pacerr.open('/arcs/wano')).texts('tbody tr')[61]).toContain('1080p');
	});

	it('reparses once the feed states a new last build', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		pacerr.upstream.feed.publish(
			rebuilt(
				withinItem(fixtures.feed, wano62, '<dd>1080p</dd>', '<dd>720p</dd>'),
				'Mon, 12 Oct 2026 09:00:00 GMT'
			)
		);

		await pacerr.advance(minutes(15));

		expect((await pacerr.open('/')).text()).toContain('Feed updated 2026-10-19 22:15 UTC');
		expect((await pacerr.open('/arcs/wano')).texts('tbody tr')[61]).toContain('720p');
	});

	it('sends conditional requests, and takes a 304 as nothing to reparse', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		pacerr.upstream.feed.sendValidators();

		await pacerr.advance(minutes(15));
		await pacerr.advance(minutes(15));

		const lastRequest = pacerr.upstream.feed.requests.at(-1);
		expect(lastRequest?.headers['if-none-match']).toBe(pacerr.upstream.feed.etag);
		expect(lastRequest?.headers['if-modified-since']).toBeDefined();
		expect((await pacerr.open('/')).text()).toContain('Feed updated 2026-10-19 22:00 UTC');
	});

	it('keeps the Releases it has when One Pace is unreachable', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		pacerr.upstream.feed.fail(503);

		await pacerr.advance(minutes(15));

		const page = await pacerr.open('/');
		expect(page.text()).toContain('513 Releases');
		expect(page.text()).toContain('The last release feed poll failed');
	});

	it('keeps the Releases it has when the feed no longer parses', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		pacerr.upstream.feed.publish('<html><body>One Pace has been redesigned</body></html>');

		await pacerr.advance(minutes(15));

		const page = await pacerr.open('/');
		expect(page.text()).toContain('513 Releases');
		expect(page.text()).toContain('The last release feed poll failed');
	});
});

const alabasta21 = '5154d5a2f0abd8371ffb3ab7d0efe4f6f96d728a';
const unpublished = '1111111111111111111111111111111111111111';

describe('a Release the Catalogue cannot explain', () => {
	it('refreshes the Catalogue out of band rather than waiting for the daily scrape', async () => {
		const pacerr = await startPacerr({
			watchPage: fixtures.watchPage.replaceAll(alabasta21, unpublished)
		});
		expect(pacerr.upstream.watchPage.requestCount).toBe(1);
		expect((await pacerr.open('/arcs/alabasta')).texts('tbody tr')[20]).toContain('No Release');

		pacerr.upstream.watchPage.publish(fixtures.watchPage);
		pacerr.upstream.feed.publish(fixtures.feed);
		await pacerr.advance(minutes(15));

		expect(pacerr.upstream.watchPage.requestCount).toBe(2);
		expect((await pacerr.open('/arcs/alabasta')).texts('tbody tr')[20]).toContain('1080p');
	});

	it('does not refresh the Catalogue again for an infohash it has already seen', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		const refreshedOnStartup = pacerr.upstream.watchPage.requestCount;

		pacerr.upstream.feed.publish(rebuilt(fixtures.feed, 'Mon, 12 Oct 2026 09:00:00 GMT'));
		await pacerr.advance(minutes(15));

		expect(pacerr.upstream.watchPage.requestCount).toBe(refreshedOnStartup);
	});
});

describe('Unmatched Releases', () => {
	it('keeps a Release the Catalogue cannot explain rather than discarding it', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/system');

		expect(page.text()).toContain('251 Unmatched Releases');
		const first = page.texts('tbody tr')[0]!;
		expect(first).toContain('Drum Island 08');
		expect(first).toContain('1080p');
		expect(first).toContain('Regular');
		expect(first).toContain('Outdated');
		expect(first).toContain('2026-09-12');
	});

	it('states what an Unmatched Release covers, which is all there is to identify it by', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const rows = (await pacerr.open('/system')).texts('tbody tr');

		const buggy = rows.find((row) => row.includes("The Adventures of Buggy's Crew 01"))!;
		expect(buggy).toContain('Chapters 35–75 cover stories');
		const romanceDawn = rows.find((row) => row.includes('Episode of East Blue'))!;
		expect(romanceDawn).toContain('Chapters 1–7');
		expect(romanceDawn).toContain('Episodes 1–3, 19, Episode of East Blue');
	});

	it('stops listing one the Catalogue later explains', async () => {
		const pacerr = await startPacerr({
			watchPage: fixtures.watchPage.replaceAll(alabasta21, unpublished),
			feed: fixtures.feed
		});
		expect((await pacerr.open('/system')).text()).toContain('252 Unmatched Releases');

		pacerr.upstream.watchPage.publish(fixtures.watchPage);
		await pacerr.advance(minutes(15));
		await pacerr.submit('/', 'refreshCatalogue');

		expect((await pacerr.open('/system')).text()).toContain('251 Unmatched Releases');
	});

	it('still holds them after Pacerr is recreated', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		pacerr.upstream.feed.fail(503);

		await pacerr.restart();

		expect((await pacerr.open('/system')).text()).toContain('251 Unmatched Releases');
	});
});
