import { describe, expect, it } from 'vitest';
import { startPacerr } from './harness/pacerr';

describe('the page header', () => {
	it('names whichever view is open', async () => {
		const pacerr = await startPacerr();

		const headings = [
			['/', 'Arcs'],
			['/activity', 'Activity'],
			['/wanted', 'Wanted'],
			['/manual-import', 'Manual Import'],
			['/settings', 'Settings'],
			['/system', 'System'],
			['/settings/sidecars', 'Sidecars'],
			['/arcs/reverie', 'Reverie']
		];

		for (const [path, heading] of headings) {
			expect((await pacerr.open(path ?? '/')).text('.page-header h1')).toBe(heading);
		}
	});
});
