import { describe, expect, it } from 'vitest';
import { fixtures, startPacerr } from './harness/pacerr';

const stateLabels = (page: { attributes(selector: string, name: string): (string | null)[] }) =>
	page.attributes('tbody .state-icon svg', 'aria-label');

describe('the state of a Part', () => {
	it('reads an Unreleased Part as not out yet rather than as a gap in the collection', async () => {
		const pacerr = await startPacerr();

		const labels = stateLabels(await pacerr.open('/arcs/egghead'));

		expect(labels).toHaveLength(38);
		expect(labels.slice(22)).toEqual(Array(16).fill('Unreleased Part'));
	});
	it('tells a Part being downloaded apart from one that is merely missing', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		expect(stateLabels(await pacerr.open('/arcs/reverie'))).toEqual(
			Array(3).fill('Downloading')
		);
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
