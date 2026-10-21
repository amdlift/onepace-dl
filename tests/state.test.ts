import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PacerrPage } from './harness/page';
import { fixtures, minutes, startPacerr } from './harness/pacerr';

const stateLabels = (page: PacerrPage): (string | null)[] =>
	page.attributes('tbody .state-icon svg', 'aria-label');

describe('the state of a Part', () => {
	it('reads an Unreleased Part as not out yet rather than as a gap in the collection', async () => {
		const pacerr = await startPacerr();

		const labels = stateLabels(await pacerr.open('/arcs/egghead'));

		expect(labels).toHaveLength(38);
		expect(labels.slice(22)).toEqual(Array(16).fill('Unreleased Part'));
	});

	it('makes a gap in a monitored Arc stand out from one in an Arc nobody asked for', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const unmonitored = stateLabels(await pacerr.open('/arcs/reverie'));
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		const monitored = stateLabels(await pacerr.open('/arcs/reverie'));

		expect(unmonitored).toEqual(Array(3).fill('Missing, not monitored'));
		expect(monitored).toEqual(Array(3).fill('Missing, monitored'));
	});

	it('tells a Part being downloaded apart from one that is merely missing', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		expect(stateLabels(await pacerr.open('/arcs/reverie'))).toEqual(Array(3).fill('Downloading'));
	});

	it('reads a Part Pacerr holds as had', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		pacerr.finishDownload(3);

		await pacerr.advance(minutes(15));

		expect(stateLabels(await pacerr.open('/arcs/reverie'))).toEqual(Array(3).fill('Had'));
	});

	it('keeps saying what it knows while the Download Client is unreachable', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		pacerr.downloadClient.reachable = false;

		const page = await pacerr.open('/arcs/reverie');

		expect(page.status).toBe(200);
		expect(stateLabels(page)).toEqual(Array(3).fill('Missing, monitored'));
	});
});

describe('the state of a wanted Part', () => {
	it('carries the same legend down the Wanted list', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'egghead' });

		const labels = stateLabels(await pacerr.open('/wanted'));

		expect(labels).toHaveLength(38);
		expect(labels.slice(0, 22)).toEqual(Array(22).fill('Missing, monitored'));
		expect(labels.slice(22)).toEqual(Array(16).fill('Unreleased Part'));
	});

	it('shows progress on a wanted Part without opening Activity', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		expect(stateLabels(await pacerr.open('/wanted'))).toEqual(Array(3).fill('Downloading'));
	});

	it('keeps listing what is wanted while the Download Client is unreachable', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		pacerr.downloadClient.reachable = false;

		const page = await pacerr.open('/wanted');

		expect(page.status).toBe(200);
		expect(stateLabels(page)).toEqual(Array(3).fill('Missing, monitored'));
	});
});

describe('a Release One Pace means to recut', () => {
	it('is marked on the Wanted list too, not only on the Arc it belongs to', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'zou' });

		const badges = (await pacerr.open('/wanted')).texts('tbody .badge');

		expect(badges).toHaveLength(10);
		expect(badges[0]).toBe('To Be Redone');
	});
});

describe('the state of a Release in the Queue', () => {
	it("carries the same treatments, in the Download Client's own words", async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const inFlight = stateLabels(await pacerr.open('/activity'));
		pacerr.downloadClient.complete(pacerr.downloadClient.added[0]!.infohash, '/downloads/x');
		const finished = stateLabels(await pacerr.open('/activity'));

		expect(inFlight).toEqual(['Downloading']);
		expect(finished).toEqual(['Completed']);
	});
});

describe('a count and a quality', () => {
	it('reads as a pill rather than as running text', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/');

		expect(page.texts('tbody .had .pill')[0]).toBe('0 of 4');
		expect(page.texts('tbody .had .pill.complete')).toEqual([]);
	});

	it('marks an Arc Pacerr holds in full', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		pacerr.finishDownload(3);
		await pacerr.advance(minutes(15));

		const page = await pacerr.open('/');

		expect(page.texts('tbody .had .pill.complete')).toEqual(['3 of 3']);
	});

	it('shows the Resolution of a Release as a pill wherever one is described', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/arcs/zou');

		const qualities = page.texts('tbody .resolution');
		expect(qualities.length).toBeGreaterThan(0);
		expect(page.texts('tbody .resolution:not(.pill)')).toEqual([]);
	});
});

const sourceDirectory = fileURLToPath(new URL('../src', import.meta.url));

// Every file that styles a view where a Part or a Release is listed, and so where the legend has
// to hold. System is left out deliberately: a Health check and a History outcome are their own
// vocabularies, not this one.
const legendViews = [
	'app.css',
	join('routes', '+page.svelte'),
	join('routes', 'arcs', '[slug]', '+page.svelte'),
	join('routes', 'wanted', '+page.svelte'),
	join('routes', 'activity', '+page.svelte')
];

function everyRule(): { selector: string; declarations: string }[] {
	return legendViews
		.flatMap((file) => {
			const contents = readFileSync(join(sourceDirectory, file), 'utf8');
			if (file.endsWith('.css')) return [contents];
			return [...contents.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(([, css]) => css ?? '');
		})
		.flatMap((css) => [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)])
		.map((rule) => ({ selector: (rule[1] ?? '').trim(), declarations: rule[2] ?? '' }));
}

const colourOf = (selector: string): string | undefined =>
	everyRule()
		.find((rule) => rule.selector === selector)
		?.declarations.match(/color:\s*([^;]+);/)?.[1]
		?.trim();

const selectorsPainted = (token: string): string[] =>
	everyRule()
		.filter((rule) => new RegExp(`color:\\s*var\\(${token}\\)`).test(rule.declarations))
		.map((rule) => rule.selector)
		.sort();

describe('the legend', () => {
	it('gives each of the six states a treatment of its own, every one a token', () => {
		const treatments = {
			had: colourOf('.state-icon.had'),
			missing: colourOf('.state-icon.missing'),
			unmonitored: colourOf('.state-icon.unmonitored'),
			downloading: colourOf('.state-icon.downloading'),
			unreleased: colourOf('.state-icon.unreleased'),
			toBeRedone: colourOf('.state-icon.to-be-redone')
		};

		expect(treatments).toEqual({
			had: 'var(--success)',
			missing: 'var(--danger)',
			unmonitored: 'var(--warning)',
			downloading: 'var(--downloading)',
			unreleased: 'var(--ink-dim)',
			toBeRedone: 'var(--brand)'
		});
	});

	it('names a to-be-redone Release in the same cyan wherever it is named', () => {
		expect(colourOf('.badge.redone')).toBe(colourOf('.state-icon.to-be-redone'));
	});

	it('spends warning orange on nothing but a gap nobody is monitoring', () => {
		expect(everyRule().length).toBeGreaterThan(0);
		expect(selectorsPainted('--warning')).toEqual(['.badge.unfinished', '.state-icon.unmonitored']);
	});

	it('spends danger red on nothing but a gap somebody is monitoring', () => {
		expect(selectorsPainted('--danger')).toEqual(['.event.bad', '.state-icon.missing']);
	});
});
