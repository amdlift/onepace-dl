import { describe, expect, it } from 'vitest';
import { fixtures, startPacerr } from './harness/pacerr';

describe('the Profile', () => {
	it('starts at 1080p, then 720p, then 480p', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/settings');

		expect(page.text('.order')).toBe('1080p, then 720p, then 480p');
	});

	it('prefers the regular Variant and calls a Part done at 1080p', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/settings');

		expect(page.attributes('select[name="variant"] option[selected]', 'value')).toEqual([
			'regular'
		]);
		expect(page.attributes('select[name="cutoff"] option[selected]', 'value')).toEqual(['1080']);
	});

	it('keeps a Profile the user changed across a restart', async () => {
		const pacerr = await startPacerr();

		await pacerr.submit('/settings', 'saveProfile', {
			'resolution-1': '720',
			'resolution-2': '1080',
			'resolution-3': '',
			variant: 'extended',
			cutoff: '720'
		});
		await pacerr.restart();

		const page = await pacerr.open('/settings');
		expect(page.text('.order')).toBe('720p, then 1080p');
		expect(page.attributes('select[name="variant"] option[selected]', 'value')).toEqual([
			'extended'
		]);
		expect(page.attributes('select[name="cutoff"] option[selected]', 'value')).toEqual(['720']);
	});

	it('refuses a Profile that accepts no Resolution at all', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/settings', 'saveProfile', {
			'resolution-1': '',
			'resolution-2': '',
			'resolution-3': '',
			variant: 'regular',
			cutoff: '1080'
		});

		expect(page.text('.order')).toBe('1080p, then 720p, then 480p');
	});
});

describe('Selection', () => {
	it('takes the Batch for every Part of an Arc it is the only coverage for', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/arcs/reverie');

		expect(page.texts('tbody .grab')).toEqual([
			'Reverie 1080p Regular',
			'Reverie 1080p Regular',
			'Reverie 1080p Regular'
		]);
	});

	it('resolves each Part of a half-recut Arc on its own, never the Arc as a whole', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const grabs = (await pacerr.open('/arcs/fishman-island')).texts('tbody .grab');

		// Per Arc, only these two Parts are newer than the 2017 Batch and the other 22 would be
		// left with nothing. ADR-0003 measured exactly that: 2 of 24.
		expect(grabs[0]).toBe('Fishman Island 01 1080p Regular');
		expect(grabs[1]).toBe('Fishman Island 02 1080p Regular');
		expect(grabs).toHaveLength(24);
		expect(new Set(grabs.slice(2))).toEqual(new Set(['Fishman Island 720p Regular']));
	});

	it('records which Parts a Batch is still needed for', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const flags = (await pacerr.open('/arcs/fishman-island')).texts('tbody .flag');

		expect(flags).toContain('Batch, needed for 22 of 24 Parts');
		expect(flags.filter((flag) => flag.startsWith('Batch,'))).toHaveLength(22);
	});

	it('keeps the preferred Variant even when a later cut is published', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const grabs = (await pacerr.open('/arcs/arlong-park')).texts('tbody .grab');

		expect(grabs[4]).toBe('Arlong Park 05 1080p Regular');
	});

	it('follows the Profile to another Variant when the user prefers one', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		await pacerr.submit('/settings', 'saveProfile', {
			'resolution-1': '1080',
			'resolution-2': '720',
			'resolution-3': '480',
			variant: 'extended',
			cutoff: '1080'
		});

		const grabs = (await pacerr.open('/arcs/arlong-park')).texts('tbody .grab');
		expect(grabs[4]).toBe('Arlong Park 05 Extended 1080p Extended');
	});

	it('leaves a Part alone when no Release reaches a Resolution the Profile accepts', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		await pacerr.submit('/settings', 'saveProfile', {
			'resolution-1': '1080',
			'resolution-2': '',
			'resolution-3': '',
			variant: 'regular',
			cutoff: '1080'
		});

		const page = await pacerr.open('/arcs/thriller-bark');
		expect(page.texts('tbody .grab')).toHaveLength(0);
		expect(page.texts('tbody .none')).toContain('No Release here satisfies the Profile');
	});
});

describe('the Cutoff', () => {
	it('marks a Part below it as still open to a Resolution Upgrade', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const flags = (await pacerr.open('/arcs/thriller-bark')).texts('tbody .flag');

		expect(flags.filter((flag) => flag === 'Below Cutoff')).toHaveLength(22);
	});

	it('leaves a Part at or above it out of Resolution Upgrades', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const flags = (await pacerr.open('/arcs/reverie')).texts('tbody .flag');

		expect(flags).not.toContain('Below Cutoff');
	});

	it('stops wanting an Upgrade once the user lowers it to what they hold', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		await pacerr.submit('/settings', 'saveProfile', {
			'resolution-1': '1080',
			'resolution-2': '720',
			'resolution-3': '480',
			variant: 'regular',
			cutoff: '720'
		});

		const flags = (await pacerr.open('/arcs/thriller-bark')).texts('tbody .flag');
		expect(flags).not.toContain('Below Cutoff');
	});
});

describe('a Batch Release that does not expand cleanly', () => {
	const postEniesLobbyCovers = (chapters: string): string =>
		fixtures.feed.replace('<dd>431–441</dd>', `<dd>${chapters}</dd>`);

	it('still takes the Parts a partial expansion did place', async () => {
		const pacerr = await startPacerr({ feed: postEniesLobbyCovers('431–438') });

		const page = await pacerr.open('/arcs/post-enies-lobby');

		expect(page.texts('tbody .grab')).toEqual([
			'Post-Enies Lobby 01 1080p Regular',
			'Post-Enies Lobby 02 1080p Regular',
			'Post-Enies Lobby 03 1080p Regular',
			'Post-Enies Lobby 720p Regular'
		]);
	});

	it('says which Parts it could not place, rather than dropping them silently', async () => {
		const pacerr = await startPacerr({ feed: postEniesLobbyCovers('431–438') });

		const reasons = (await pacerr.open('/arcs/post-enies-lobby')).texts(
			'tbody td:nth-child(3) .none'
		);

		expect(reasons[0]).toContain('neither clearly covers nor clearly excludes');
		expect(reasons[0]).toContain('post-enies-lobby-05');
		expect(reasons[1]).toBe('No Release covers this Part');
	});

	it('explains a Batch that placed nowhere at all', async () => {
		const pacerr = await startPacerr({ feed: postEniesLobbyCovers('9001–9002') });

		const page = await pacerr.open('/arcs/post-enies-lobby');

		expect(page.texts('tbody .grab')).toHaveLength(3);
		expect(page.texts('tbody td:nth-child(3) .none')[0]).toContain('did not expand');
	});
});

describe('the Wanted view', () => {
	it('names the Release it would grab for each Part it is still missing', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'fishman-island' });

		const grabs = (await pacerr.open('/wanted')).texts('tbody .grab');
		expect(grabs[1]).toBe('Fishman Island 02 1080p Regular');
		expect(grabs[4]).toBe('Fishman Island 720p Regular');
		expect(grabs).toHaveLength(24);
	});
});
