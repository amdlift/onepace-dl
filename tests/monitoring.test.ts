import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fixtures, hours, startPacerr, type PacerrPage } from './harness/pacerr';

const monitorToggles = 'tbody .monitoring button';

const monitoredArcs = (page: PacerrPage): string[] =>
	[...page.document.querySelectorAll('tbody tr')]
		.filter(
			(row) =>
				row.querySelector('.monitoring button')?.getAttribute('aria-pressed') === 'true'
		)
		.map((row) => row.querySelector('td a')?.textContent?.trim() ?? '');

const wantedPartNumbers = (page: PacerrPage): string[] => page.texts('tbody td:nth-child(3)');

const arcRow = (page: PacerrPage, title: string): string =>
	page.texts('tbody tr').find((row) => row.startsWith(title)) ?? '';

/**
 * The One Pace watch page with Reverie's final Part cut out of the embedded Catalogue, so that
 * republishing the real fixture is a Part appearing upstream after Monitoring was turned on.
 */
function withoutTheLastReveriePart(watchPage: string): string {
	const part = watchPage.indexOf(String.raw`,{\"slug\":\"reverie-03\"`);
	const nextArc = watchPage.indexOf(String.raw`,{\"slug\":\"wano\"`, part);
	// Two characters back from the next Arc are the brackets closing Reverie's own Part list.
	return watchPage.slice(0, part) + watchPage.slice(nextArc - 2);
}

describe('Monitoring an Arc', () => {
	it('monitors nothing on a fresh install', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/');

		expect(page.attributes(monitorToggles, 'aria-pressed')).toEqual(Array(38).fill('false'));
	});

	it('is turned on and off for one Arc from the Arcs view', async () => {
		const pacerr = await startPacerr();

		const monitored = await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		expect(monitoredArcs(monitored)).toEqual(['Reverie']);

		const unmonitored = await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		expect(monitoredArcs(unmonitored)).toEqual([]);
	});

	it('is turned on and off from the Arc detail view, which the Arcs view agrees with', async () => {
		const pacerr = await startPacerr();

		const monitored = await pacerr.submit('/arcs/reverie', 'toggleMonitoring');
		expect(monitored.text('.monitoring button')).toBe('Monitored');
		expect(monitoredArcs(await pacerr.open('/'))).toEqual(['Reverie']);

		const unmonitored = await pacerr.submit('/arcs/reverie', 'toggleMonitoring');
		expect(unmonitored.text('.monitoring button')).toBe('Not monitored');
		expect(monitoredArcs(await pacerr.open('/'))).toEqual([]);
	});

	it('covers every Arc in one action', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/', 'monitorAllArcs');

		expect(page.attributes(monitorToggles, 'aria-pressed')).toEqual(Array(38).fill('true'));
	});

	it('survives the container being recreated', async () => {
		const pacerr = await startPacerr();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		await pacerr.restart();

		expect(monitoredArcs(await pacerr.open('/'))).toEqual(['Reverie']);
	});
});

describe('a Part within a monitored Arc', () => {
	it('is skipped once it is marked as not wanted', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const page = await pacerr.submit('/arcs/reverie', 'togglePartWanted', { part: 'reverie-02' });

		expect(page.texts('tbody .wanted button')).toEqual(['Wanted', 'Not wanted', 'Wanted']);
		expect((await pacerr.open('/wanted')).texts('tbody td:nth-child(3)')).toEqual(['1', '3']);
	});

	it('is wanted again once the mark is lifted', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		await pacerr.submit('/arcs/reverie', 'togglePartWanted', { part: 'reverie-02' });

		await pacerr.submit('/arcs/reverie', 'togglePartWanted', { part: 'reverie-02' });

		expect((await pacerr.open('/wanted')).texts('tbody td:nth-child(3)')).toEqual(['1', '2', '3']);
	});
});

describe('how much of an Arc Pacerr holds', () => {
	it('counts the Parts it has against the Parts that exist', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const had = (await pacerr.open('/')).texts('tbody .had');

		expect(had).toHaveLength(38);
		expect(had[0]).toBe('0 of 4');
		expect(had.at(-1)).toBe('0 of 1');
	});
});

describe('a Part that appears in the Catalogue later', () => {
	it('is covered by the Monitoring already standing on its Arc', async () => {
		const pacerr = await startPacerr({
			watchPage: withoutTheLastReveriePart(fixtures.watchPage),
			feed: fixtures.feed
		});
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		expect(wantedPartNumbers(await pacerr.open('/wanted'))).toEqual(['1', '2']);

		pacerr.upstream.watchPage.publish(fixtures.watchPage);
		await pacerr.advance(hours(24));

		expect(wantedPartNumbers(await pacerr.open('/wanted'))).toEqual(['1', '2', '3']);
	});
});

describe('turning Monitoring off', () => {
	it('leaves the Library and what Pacerr records about an Arc alone', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		await pacerr.submit('/arcs/reverie', 'togglePartWanted', { part: 'reverie-02' });

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		expect(readdirSync(pacerr.paths.library)).toEqual([]);
		expect(arcRow(await pacerr.open('/'), 'Reverie')).toContain('0 of 3');
		expect((await pacerr.open('/arcs/reverie')).texts('tbody tr td:nth-child(2)')).toEqual([
			'1',
			'2',
			'3'
		]);
		expect(wantedPartNumbers(await pacerr.open('/wanted'))).toEqual([]);
	});

	it('remembers which Parts were marked as not wanted when it is turned back on', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		await pacerr.submit('/arcs/reverie', 'togglePartWanted', { part: 'reverie-02' });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		expect(wantedPartNumbers(await pacerr.open('/wanted'))).toEqual(['1', '3']);
	});
});
