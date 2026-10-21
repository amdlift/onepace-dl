import { describe, expect, it } from 'vitest';
import { startPacerr } from './harness/pacerr';

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
