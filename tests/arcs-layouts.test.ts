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
