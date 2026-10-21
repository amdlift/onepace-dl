import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { startPacerr, type Pacerr } from './harness/pacerr';

const tokenSheet = fileURLToPath(new URL('../src/app.css', import.meta.url));

function declarationsFor(selector: string): Record<string, string> {
	const rule = readFileSync(tokenSheet, 'utf8')
		.split('}')
		.map((block) => block.split('{'))
		.find(([heading, body]) => body !== undefined && heading?.trim() === selector);

	return Object.fromEntries(
		[...(rule?.[1] ?? '').matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
			declaration[1] ?? '',
			(declaration[2] ?? '').trim()
		])
	);
}

const settingsPages = [
	'/settings',
	'/settings/media-management',
	'/settings/download-client',
	'/settings/metadata',
	'/settings/manual-import',
	'/settings/security'
];

const labelsOn = async (pacerr: Pacerr, path: string): Promise<string[]> =>
	(await pacerr.open(path)).texts('.setting > .label');

describe('a setting', () => {
	it('is a row of the label column, gutter and control column the reference measures', () => {
		expect(declarationsFor('.setting')).toMatchObject({
			'grid-template-columns': 'var(--label-width) var(--control-width)',
			gap: 'var(--label-gutter)'
		});
	});

	it('right-aligns its label against the gutter without a table alignment', () => {
		expect(declarationsFor('.setting > .label')).toMatchObject({ 'justify-self': 'end' });
	});

	it('gives the control column the whole of its width', () => {
		expect(declarationsFor('.setting > .control')).toMatchObject({ 'grid-column': '2' });
	});

	it('dims its help text to the help colour', () => {
		expect(declarationsFor('.help')).toMatchObject({ color: 'var(--ink-dim)' });
	});
});

describe('a section of a Settings page', () => {
	it('carries a legend at the reference size with a rule beneath it', () => {
		expect(declarationsFor('h2')).toMatchObject({
			'font-size': 'var(--type-legend)',
			'border-bottom': 'var(--hairline) solid var(--border)'
		});
	});

	it('is what every setting on every Settings page sits inside', async () => {
		const pacerr = await startPacerr();

		for (const path of settingsPages) {
			const page = await pacerr.open(path);

			expect(page.texts('section > h2').length).toBeGreaterThan(0);
			expect(page.texts('section .setting').length).toBe(page.texts('.setting').length);
		}
	});
});

describe('every setting a Settings page offers', () => {
	it('is a labelled row', async () => {
		const pacerr = await startPacerr();

		expect(await labelsOn(pacerr, '/settings')).toEqual([
			'Resolution preference',
			'Preferred Variant',
			'Cutoff'
		]);
		expect(await labelsOn(pacerr, '/settings/media-management')).toEqual([
			'Naming template',
			'Library',
			'Download directory'
		]);
		expect(await labelsOn(pacerr, '/settings/download-client')).toEqual([
			'qBittorrent address',
			'Username',
			'Password'
		]);
		expect(await labelsOn(pacerr, '/settings/metadata')).toEqual([
			'Show NFO',
			'Season NFO',
			'Episode NFO',
			'Season Poster'
		]);
		expect(await labelsOn(pacerr, '/settings/manual-import')).toEqual(['Import Source']);
		expect(await labelsOn(pacerr, '/settings/security')).toEqual([
			'Require a login',
			'Username',
			'Password'
		]);
	});

	it('names the control its label is for', async () => {
		const pacerr = await startPacerr();

		for (const path of settingsPages) {
			const page = await pacerr.open(path);

			const labelled = page.attributes('.setting > .label', 'for');
			expect(labelled.length).toBeGreaterThan(0);
			for (const field of labelled) {
				expect(page.attributes(`.setting > .control #${field} `, 'name')).toEqual([field]);
			}
		}
	});

	it('explains itself beneath its control rather than beside the row', async () => {
		const pacerr = await startPacerr();

		for (const path of settingsPages) {
			const page = await pacerr.open(path);

			const help = page.texts('.help');
			expect(help.length).toBeGreaterThan(0);
			expect(page.texts('.setting > .control .help')).toEqual(help);
		}
	});
});

describe('Remote Path Mappings', () => {
	it('lists what is mapped as a table, and still adds to it and removes from it', async () => {
		const pacerr = await startPacerr();

		await pacerr.submit('/settings/media-management', 'addRemotePathMapping', {
			remotePath: '/data/torrents',
			localPath: '/downloads'
		});

		const added = await pacerr.open('/settings/media-management');
		expect(added.texts('.mapping-list thead th')).toEqual([
			'Path on the Download Client',
			'The same place as Pacerr sees it',
			''
		]);
		expect(added.texts('.mapping-list tbody tr')).toHaveLength(1);
		expect(added.text('.mapping-list tbody tr')).toContain('/data/torrents');
		expect(added.text('.mapping-list tbody tr')).toContain('/downloads');

		const id = added.attributes(
			'.mapping-list form[action="?/removeRemotePathMapping"] input[name="id"]',
			'value'
		)[0];
		const removed = await pacerr.submit('/settings/media-management', 'removeRemotePathMapping', {
			id: id ?? ''
		});

		expect(removed.texts('.mapping-list tbody tr')).toEqual([]);
	});
});
