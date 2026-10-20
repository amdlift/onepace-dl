import { describe, expect, it } from 'vitest';
import { fixtures, startPacerr } from './harness/pacerr';

describe('the Wanted view', () => {
	it('wants nothing while nothing is monitored', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		const page = await pacerr.open('/wanted');

		expect(page.texts('tbody tr')).toEqual([]);
		expect(page.text()).toContain('Nothing is wanted');
	});

	it('lists every Part of a monitored Arc that Pacerr does not have', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const page = await pacerr.open('/wanted');

		const rows = page.texts('tbody tr');
		expect(rows).toHaveLength(3);
		expect(rows[0]).toContain('Reverie');
		expect(rows[0]).toContain('The Fifth Emperor');
		expect(page.texts('tbody .state')).toEqual(Array(3).fill('Release available'));
	});
});

describe('why a Part is not had', () => {
	it('shows a Part with no Release at all as having none, never as a failure', async () => {
		const pacerr = await startPacerr();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const page = await pacerr.open('/wanted');

		expect(page.texts('tbody .state')).toEqual(Array(3).fill('No Release'));
		expect(page.text()).not.toContain('Failed');
	});

	it('keeps a Part One Pace has not released yet apart from one it has', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'egghead' });

		const states = (await pacerr.open('/wanted')).texts('tbody .state');

		expect(states).toHaveLength(38);
		expect(states.slice(0, 22)).toEqual(Array(22).fill('Release available'));
		expect(states.slice(22)).toEqual(Array(16).fill('Not released yet'));
	});
});
