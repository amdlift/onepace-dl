import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtures, startPacerr, type PacerrPage } from './harness/pacerr';
import { declarationsFor, everyStyledSource } from './harness/sources';

const occurrences = (pattern: RegExp): string[] =>
	everyStyledSource().flatMap(({ file, contents }) =>
		[...contents.matchAll(pattern)].map(() => file)
	);

describe('a table column', () => {
	it('is never right-aligned', () => {
		expect(occurrences(/text-align:\s*left/g)).not.toHaveLength(0);
		expect(occurrences(/text-align:\s*right/g)).toEqual([]);
	});

	it('has no right-aligning class left to reach for', () => {
		expect(occurrences(/\bnumeric\b/g)).toEqual([]);
	});
});

describe('a table row', () => {
	it('is the height the reference gives a row, with its cell padding', () => {
		expect(declarationsFor('.table td')).toMatchObject({
			height: 'var(--row-height)',
			padding: 'var(--cell-padding)'
		});
	});

	it('is separated from the row above it by a hairline along its top', () => {
		expect(declarationsFor('.table tbody tr')).toMatchObject({
			'border-top': 'var(--hairline) solid var(--border)'
		});
	});

	it('draws no rule of its own underneath', () => {
		expect(declarationsFor('.table td')['border-bottom']).toBeUndefined();
		expect(declarationsFor('.table th')['border-bottom']).toBeUndefined();
	});

	it('lifts under the pointer', () => {
		expect(declarationsFor('.table tbody tr:hover')).toMatchObject({
			background: 'var(--surface-hover)'
		});
	});
});

describe('a table header', () => {
	it('is bold at the body size, left-aligned, with the reference cell padding', () => {
		expect(declarationsFor('.table th')).toMatchObject({
			padding: 'var(--cell-padding)',
			'font-weight': 'var(--weight-bold)',
			'font-size': 'var(--type-base)',
			'text-align': 'left'
		});
	});

	it('carries the body colour rather than the dimmed one help text uses', () => {
		expect(declarationsFor('.table th').color).toBeUndefined();
	});
});

const columnsIn = (row: Element): number =>
	[...row.children].reduce((total, cell) => total + Number(cell.getAttribute('colspan') ?? 1), 0);

function shortRows(page: PacerrPage, path: string): string[] {
	const tables = [...page.document.querySelectorAll('table')];
	return tables.flatMap((table, index) => {
		const header = table.querySelector('thead tr');
		if (header === null) return [];
		const headers = columnsIn(header);
		const widths = new Set([...table.querySelectorAll('tbody tr')].map(columnsIn));
		return [...widths]
			.filter((cells) => cells !== headers)
			.map((cells) => `${path} table ${index + 1}: ${headers} headers, ${cells} cells`);
	});
}

const tablesOn = (page: PacerrPage): number => page.document.querySelectorAll('table').length;

describe('every table a view renders', () => {
	it('fills every column its header declares', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'egghead' });
		await pacerr.submit('/', 'chooseLayout', { layout: 'table' });
		await pacerr.submit('/settings/media-management', 'addRemotePathMapping', {
			remotePath: '/data/torrents',
			localPath: '/downloads'
		});
		const source = join(pacerr.paths.root, 'source');
		mkdirSync(source, { recursive: true });
		writeFileSync(join(source, 'One Pace - Reverie 01 [1080p].mkv'), 'video');
		await pacerr.submit('/settings/manual-import', 'saveImportSource', { importSource: source });

		const paths = [
			'/',
			'/activity',
			'/wanted',
			'/arcs/reverie',
			'/arcs/egghead',
			'/system',
			'/settings/media-management',
			'/manual-import'
		];

		let tables = 0;
		const short: string[] = [];
		for (const path of paths) {
			const page = await pacerr.open(path);
			tables += tablesOn(page);
			short.push(...shortRows(page, path));
		}

		expect(tables).toBeGreaterThanOrEqual(8);
		expect(short).toEqual([]);
	});
});
