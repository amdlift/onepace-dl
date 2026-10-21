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
