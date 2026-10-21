import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtures, startPacerr, type PacerrPage } from './harness/pacerr';

const manifest = JSON.parse(
	readFileSync(new URL('../artwork/posters.json', import.meta.url), 'utf8')
) as { posters: { arc: string }[] };

const rowFor = (page: PacerrPage, title: string): Element => {
	const row = [...page.document.querySelectorAll('tbody tr')].find((candidate) =>
		(candidate.textContent ?? '').includes(title)
	);
	if (row === undefined) throw new Error(`The Arcs view has no row for ${title}`);
	return row;
};

describe('an Arc Pacerr ships a Poster for', () => {
	it('shows the Poster in the Arcs view', async () => {
		const pacerr = await startPacerr();

		const sources = (await pacerr.open('/')).attributes('tbody tr img', 'src');

		expect(sources[0]).toBe('/arcs/romance-dawn/poster');
	});

	it('serves the Poster as a WebP', async () => {
		const pacerr = await startPacerr();

		const response = await pacerr.fetch('/arcs/romance-dawn/poster');
		const bytes = Buffer.from(await response.arrayBuffer());

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/webp');
		expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
		expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
	});
});

describe('a Poster a user has put in the config volume', () => {
	it('is served instead of the one Pacerr ships', async () => {
		const pacerr = await startPacerr();
		const mine = Buffer.from('\x89PNG\r\n\x1a\nthe Poster I chose myself', 'latin1');
		mkdirSync(join(pacerr.paths.config, 'posters'), { recursive: true });
		writeFileSync(join(pacerr.paths.config, 'posters', 'romance-dawn.png'), mine);

		const response = await pacerr.fetch('/arcs/romance-dawn/poster');

		expect(response.headers.get('content-type')).toBe('image/png');
		expect(Buffer.from(await response.arrayBuffer())).toEqual(mine);
	});

	it('cannot be named so that it reads a file from outside the Posters directory', async () => {
		const pacerr = await startPacerr();
		writeFileSync(join(pacerr.paths.config, 'elsewhere.png'), 'not a Poster');

		const response = await pacerr.fetch('/arcs/..%2Felsewhere/poster');

		expect(response.status).toBe(404);
	});
});

describe('an Arc published after the Posters were bundled', () => {
	it('falls back to the Backdrop One Pace publishes for it', async () => {
		const pacerr = await startPacerr({
			watchPage: fixtures.watchPage.replaceAll('romance-dawn', 'romance-dusk')
		});

		const sources = (await pacerr.open('/')).attributes('tbody tr img', 'src');

		expect(sources[0]).toBe(
			`${pacerr.upstream.url}/_next/static/media/50-backdrop-village-cows.0s-z7zeune8vi.jpg`
		);
	});
});

describe('an Arc with neither a Poster nor a Backdrop', () => {
	it('renders a neutral placeholder rather than a broken image', async () => {
		const pacerr = await startPacerr();

		const row = rowFor(await pacerr.open('/'), 'One Piece Fan Letter');

		expect(row.querySelector('img')).toBeNull();
		expect(row.querySelector('.no-cover')).not.toBeNull();
	});
});

describe('the Arcs view', () => {
	it('shows artwork for every Arc in the Catalogue', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/');

		const covers = page.texts('tbody tr td.cover').length;
		const posters = page.attributes('tbody tr td.cover img', 'src').length;
		const placeholders = page.texts('tbody tr td.cover .no-cover').length;
		expect(covers).toBe(38);
		expect(posters + placeholders).toBe(covers);
	});
});

describe('the Poster manifest', () => {
	it('names only Arcs the Catalogue contains', async () => {
		const pacerr = await startPacerr();

		const catalogued = new Set(
			(await pacerr.open('/'))
				.attributes('tbody tr a', 'href')
				.map((href) => (href ?? '').replace('/arcs/', ''))
		);

		const unknown = manifest.posters
			.map((poster) => poster.arc)
			.filter((arc) => !catalogued.has(arc));

		expect(manifest.posters).not.toHaveLength(0);
		expect(unknown).toEqual([]);
	});
});
