import { describe, expect, it } from 'vitest';
import { fixtures, startPacerr } from './harness/pacerr';

describe('the Arc detail view', () => {
	it("lists an Arc's Parts in order", async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/arcs/reverie');

		expect(page.text('h1')).toContain('Reverie');
		expect(page.texts('tbody tr td:first-child')).toEqual(['1', '2', '3']);
		expect(page.texts('tbody tr')[0]).toContain('The Fifth Emperor');
	});

	it('shows Parts One Pace has announced but not released as gaps', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/arcs/egghead');

		const rows = page.texts('tbody tr');
		expect(rows).toHaveLength(38);
		expect(rows[21]).toContain('Kuma Bear');
		expect(rows[22]).toContain('Not released yet');
		expect(rows.at(-1)).toContain('Not released yet');
	});

	it('is reachable from the Arcs view', async () => {
		const pacerr = await startPacerr();

		const links = (await pacerr.open('/')).attributes('tbody tr a', 'href');

		expect(links).toContain('/arcs/reverie');
	});
});

describe('the to-be-redone badge', () => {
	it('badges a Part whose current Release One Pace means to recut', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const badges = (await pacerr.open('/arcs/zou')).texts('tbody .badge');

		expect(badges).toHaveLength(10);
		expect(badges[0]).toBe('To Be Redone');
	});

	it('leaves a Part whose Release stands alone', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		expect((await pacerr.open('/arcs/wano')).texts('tbody .badge')).toHaveLength(0);
	});
});
