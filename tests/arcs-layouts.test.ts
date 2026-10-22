import { describe, expect, it } from 'vitest';
import { arcsLayouts } from '../src/lib/arcs-layout';
import { fixtures, startPacerr, type PacerrPage } from './harness/pacerr';

const monitorToggles = 'form[action="?/toggleMonitoring"] button';

/** The Arcs shown as monitored, read the same way whichever layout is rendering them. */
const monitoredArcs = (page: PacerrPage): string[] =>
	[...page.document.querySelectorAll('form[action="?/toggleMonitoring"]')]
		.filter((form) => form.querySelector('button')?.getAttribute('aria-pressed') === 'true')
		.map((form) => form.querySelector('input[name="arc"]')?.getAttribute('value') ?? '');

describe('the Arcs view', () => {
	it('offers its three layouts from the view controls, opening on Table', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/');

		expect(page.texts('.page-toolbar .controls button')).toEqual([
			'Poster',
			'Overview',
			'Table'
		]);
		expect(page.texts('.page-toolbar .controls button[aria-pressed="true"]')).toEqual(['Table']);
	});
});

describe('the Poster layout', () => {
	it('shows every Arc the Catalogue holds as portrait artwork', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/', 'chooseLayout', { layout: 'poster' });

		const arcs = page.texts('.poster-grid .arc');
		expect(arcs).toHaveLength(38);
		expect(arcs[0]).toContain('Romance Dawn');
		expect(page.attributes('.poster-grid .arc img', 'src')[0]).toBe('/arcs/romance-dawn/poster');
		expect(page.document.querySelector('table')).toBeNull();
	});
});

describe('the Overview layout', () => {
	it('pairs every Arc with its artwork and what One Pace says about it', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/', 'chooseLayout', { layout: 'overview' });

		const arcs = page.texts('.overview .arc');
		expect(arcs).toHaveLength(38);
		expect(arcs[0]).toContain('Romance Dawn');
		expect(arcs[0]).toContain('Monkey D. Luffy sets out on an adventure to form a crew');
		expect(page.attributes('.overview .arc img', 'src')[0]).toBe('/arcs/romance-dawn/poster');
		expect(page.document.querySelector('table')).toBeNull();
	});
});

describe('every layout', () => {
	it('states how many of an Arc’s Parts are had', async () => {
		const pacerr = await startPacerr();

		for (const layout of arcsLayouts) {
			const page = await pacerr.submit('/', 'chooseLayout', { layout });

			const had = page.texts('.pill');
			expect(had, layout).toHaveLength(38);
			expect(had[0], layout).toBe('0 of 4');
		}
	});
});

describe('every layout', () => {
	it('monitors an Arc, refreshes the Catalogue and refreshes the Releases', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		for (const layout of arcsLayouts) {
			const chosen = await pacerr.submit('/', 'chooseLayout', { layout });
			expect(chosen.texts(monitorToggles), layout).toHaveLength(38);
			expect(chosen.texts('.page-toolbar .actions button'), layout).toEqual([
				'Monitor all Arcs',
				'Refresh Catalogue',
				'Refresh Releases'
			]);

			expect(monitoredArcs(await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' })), layout).toEqual(
				['reverie']
			);
			expect(monitoredArcs(await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' })), layout).toEqual(
				[]
			);

			pacerr.upstream.watchPage.publish(
				fixtures.watchPage.replaceAll('Whisky Peak', `Whisky Peak ${layout}`)
			);
			expect((await pacerr.submit('/', 'refreshCatalogue')).text(), layout).toContain(
				`Whisky Peak ${layout}`
			);

			const polls = pacerr.upstream.feed.requestCount;
			await pacerr.submit('/', 'refreshReleases');
			expect(pacerr.upstream.feed.requestCount, layout).toBeGreaterThan(polls);
		}
	});
});
