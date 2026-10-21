import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { startPacerr } from './harness/pacerr';

const viewsDirectory = fileURLToPath(new URL('../src/routes/(views)', import.meta.url));

/** Every view the shared layout wraps, read off the route tree so a view added later is covered. */
function everyView(directory = viewsDirectory): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? everyView(join(directory, entry.name))
			: entry.name === '+page.svelte'
				? [join(directory, entry.name)]
				: []
	);
}

const ownChrome = /<h1|class="toolbar"/;

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
			['/settings/metadata', 'Settings'],
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
		expect((await pacerr.open('/settings/browse')).texts('.page-toolbar .actions a')).toEqual([
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

		expect(await marked('/settings/metadata')).toEqual(['Settings']);
		expect(await marked('/arcs/reverie')).toEqual(['Arcs']);
	});
});

describe('a view', () => {
	it('defines no chrome of its own', () => {
		const views = everyView();

		const own = views.filter((view) => ownChrome.test(readFileSync(view, 'utf8')));

		expect(views.length).toBeGreaterThan(1);
		expect(own).toEqual([]);
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
