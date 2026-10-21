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

describe('the toolbar', () => {
	it("carries a view's contextual actions apart from its view controls", async () => {
		const pacerr = await startPacerr();

		const arcs = await pacerr.open('/');
		expect(arcs.texts('.page-toolbar .actions button')).toEqual([
			'Monitor all Arcs',
			'Refresh Catalogue',
			'Refresh Releases'
		]);
		expect(arcs.texts('.page-toolbar .controls *')).toEqual([]);

		const manualImport = await pacerr.open('/manual-import');
		expect(manualImport.texts('.page-toolbar .controls nav a')).toEqual([
			'Import Source',
			'Library'
		]);
		expect(manualImport.texts('.page-toolbar .actions *')).toEqual([]);
	});

	it('is where an action a view used to carry itself now lives', async () => {
		const pacerr = await startPacerr();

		expect((await pacerr.open('/arcs/reverie')).texts('.page-toolbar .actions button')).toEqual([
			'Not monitored'
		]);
		expect((await pacerr.open('/settings/sidecars')).texts('.page-toolbar .actions a')).toEqual([
			'Back to Settings'
		]);
	});
});

describe('the sidebar', () => {
	it('lists the six views and marks the one being looked at', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/wanted');

		expect(page.texts('nav[aria-label="Sections"] a')).toEqual([
			'Arcs',
			'Activity',
			'Wanted',
			'Manual Import',
			'Settings',
			'System'
		]);
		expect(page.texts('nav[aria-label="Sections"] a[aria-current="page"]')).toEqual(['Wanted']);
	});

	it('marks the section an Arc and a Settings sub-page belong to', async () => {
		const pacerr = await startPacerr();

		const marked = async (path: string): Promise<string[]> =>
			(await pacerr.open(path)).texts('nav[aria-label="Sections"] a[aria-current="page"]');

		expect(await marked('/settings/sidecars')).toEqual(['Settings']);
		expect(await marked('/arcs/reverie')).toEqual(['Arcs']);
	});
});
