import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { startPacerr } from './harness/pacerr';
import { declarationsFor } from './harness/sources';

const chrome = fileURLToPath(new URL('../src/lib/components/Chrome.svelte', import.meta.url));

const headings = [
	['/', 'Arcs'],
	['/activity', 'Activity'],
	['/wanted', 'Wanted'],
	['/manual-import', 'Manual Import'],
	['/settings', 'Settings'],
	['/system', 'System'],
	['/settings/metadata', 'Settings'],
	['/settings/browse', 'Choose the Library'],
	['/arcs/reverie', 'Reverie']
];

describe('the page header', () => {
	it('names whichever view is open', async () => {
		const pacerr = await startPacerr();

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
		expect(arcs.texts('.page-toolbar .controls button')).toEqual([
			'Poster',
			'Overview',
			'Table'
		]);

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
		expect((await pacerr.open('/settings/browse')).texts('.page-toolbar .actions a')).toEqual([
			'Back to Settings'
		]);
	});
});

describe('a toolbar label', () => {
	it('is at the small size the reference measures rather than the body size', () => {
		expect(declarationsFor('.page-toolbar', chrome)).toMatchObject({
			'font-size': 'var(--type-small)'
		});
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

		expect(await marked('/settings/metadata')).toEqual(['Settings']);
		expect(await marked('/arcs/reverie')).toEqual(['Arcs']);
	});
});

describe('a view', () => {
	it('defines no chrome of its own', async () => {
		const pacerr = await startPacerr();

		for (const [path] of headings) {
			const page = await pacerr.open(path ?? '/');

			expect(page.texts('h1')).toHaveLength(1);
			expect(page.texts('.page-toolbar')).toHaveLength(1);
		}
	});
});

describe('the login screen', () => {
	it('has neither the sidebar nor the health banner', async () => {
		const pacerr = await startPacerr();
		await pacerr.submit('/settings/security', 'saveAuthentication', {
			enabled: 'on',
			username: 'captain',
			password: 'all-blue-or-bust'
		});
		pacerr.forget();

		const page = await pacerr.open('/login');

		expect(page.text('h1')).toBe('Log in');
		expect(page.document.querySelector('nav[aria-label="Sections"]')).toBeNull();
		expect(page.document.querySelector('.page-toolbar')).toBeNull();
		expect(page.text('.banner')).toBe('');
		expect(page.texts('form[action="?/logIn"] button')).toEqual(['Log in']);
	});
});
