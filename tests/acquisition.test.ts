import { describe, expect, it } from 'vitest';
import { days, fixtures, hours, startPacerr } from './harness/pacerr';

describe('the Download Client connection', () => {
	it('is configured in Settings and survives a restart', async () => {
		const pacerr = await startPacerr();

		await pacerr.submit('/settings/download-client', 'saveDownloadClient', {
			url: 'http://qbittorrent.lan:8080',
			username: 'admin',
			password: 'hunter2'
		});
		await pacerr.restart();

		const page = await pacerr.open('/settings/download-client');
		expect(page.attributes('input[name="url"]', 'value')).toEqual([
			'http://qbittorrent.lan:8080'
		]);
		expect(
			page.attributes('form[action="?/saveDownloadClient"] input[name="username"]', 'value')
		).toEqual(['admin']);
	});

	it('confirms a working connection when the user tests it', async () => {
		const pacerr = await startPacerr();
		await pacerr.connectDownloadClient();

		const page = await pacerr.submit('/settings/download-client', 'testDownloadClient');

		expect(page.text('.connection')).toContain('Connected to qBittorrent');
	});

	it('says which way the connection is broken, not merely that it is', async () => {
		const pacerr = await startPacerr();
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.failing = 'credentials';

		const page = await pacerr.submit('/settings/download-client', 'testDownloadClient');

		expect(page.text('.connection')).toContain('rejected that username and password');
	});

	it('tells a daemon that is down apart from one that has banned us', async () => {
		const pacerr = await startPacerr();
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.reachable = false;

		const down = await pacerr.submit('/settings/download-client', 'testDownloadClient');
		expect(down.text('.connection')).toContain('unreachable');

		pacerr.downloadClient.reachable = true;
		pacerr.downloadClient.failing = 'banned';
		const banned = await pacerr.submit('/settings/download-client', 'testDownloadClient');
		expect(banned.text('.connection')).toContain('banned');
	});

	it('says nothing is configured rather than reporting a connection failure', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.submit('/settings/download-client', 'testDownloadClient');

		expect(page.text('.connection')).toBe('No Download Client is configured.');
	});
});

describe('grabbing', () => {
	it('hands the Release selected for a monitored Arc to the Download Client', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		expect(pacerr.downloadClient.added).toHaveLength(1);
		expect(pacerr.downloadClient.added[0]?.magnetUri).toContain('magnet:?xt=urn:btih:');
	});

	it('leaves an Arc nobody monitors alone', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();

		await pacerr.advance(hours(24));

		expect(pacerr.downloadClient.added).toEqual([]);
	});

	it('grabs a Release once, however often it is asked to look again', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		await pacerr.advance(hours(24));
		await pacerr.advance(hours(24));

		expect(pacerr.downloadClient.added).toHaveLength(1);
	});

	it('grabs nothing until there is a Download Client to grab with', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		expect(pacerr.downloadClient.added).toEqual([]);

		await pacerr.connectDownloadClient();
		expect(pacerr.downloadClient.added).toHaveLength(1);
	});
});

describe('a Batch Release needed for only some of its Parts', () => {
	const fishmanIsland = async (filesPerTorrent: number) => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = filesPerTorrent;
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'fishman-island' });
		return pacerr;
	};

	it('leaves out the files a newer per-Part Release already covers', async () => {
		const pacerr = await fishmanIsland(24);

		// The two Parts One Pace has re-cut are the first two of the Arc, so the Batch is wanted
		// for everything but its first two files.
		expect(pacerr.downloadClient.deselected().map((it) => it.positions)).toEqual([[0, 1]]);
	});

	it('takes every file of a Batch that is still the only coverage its Arc has', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 3;

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		expect(pacerr.downloadClient.added).toHaveLength(1);
		expect(pacerr.downloadClient.deselected()).toEqual([]);
	});
});

describe('the Activity view', () => {
	it('shows a Release that is downloading, and how far it has got', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		pacerr.downloadClient.progressed(pacerr.downloadClient.added[0]!.infohash, 0.42);

		const page = await pacerr.open('/activity');
		expect(page.text('tbody tr')).toContain('Reverie');
		expect(page.texts('tbody .progress')).toEqual(['42%']);
	});

	it('says the Download Client is unreachable rather than showing an empty queue', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		pacerr.downloadClient.reachable = false;

		const page = await pacerr.open('/activity');

		expect(page.text('.alert')).toContain('unreachable');
		expect(page.text()).not.toContain('Nothing is downloading');
	});

	it('never removes a completed torrent of its own accord', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });
		const infohash = pacerr.downloadClient.added[0]!.infohash;

		pacerr.downloadClient.complete(infohash, '/downloads/Reverie');
		await pacerr.advance(days(7));
		await pacerr.open('/activity');

		expect(pacerr.downloadClient.removed).toEqual([]);
		expect(pacerr.downloadClient.added.map((it) => it.infohash)).toEqual([infohash]);
	});
});

describe('History', () => {
	it('records every grab with its Release and the Part it was grabbed for', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const rows = (await pacerr.open('/activity')).texts('.history tbody tr');
		expect(rows).toHaveLength(3);
		expect(rows[0]).toContain('Grabbed');
		expect(rows[0]).toContain('Reverie');
		expect(rows.join(' ')).toContain('The Fifth Emperor');
	});

	it('survives the feed and the Catalogue being replaced underneath it', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		pacerr.upstream.feed.publish(fixtures.feed.replace(/<item>[\s\S]*<\/item>/, ''));
		await pacerr.advance(hours(24));

		const rows = (await pacerr.open('/activity')).texts('.history tbody tr');
		expect(rows).toHaveLength(3);
		expect(rows[0]).toContain('Reverie');
	});

	it('says so when a Batch does not contain the files Pacerr expected', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.filesPerTorrent = 23;

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'fishman-island' });

		expect(pacerr.downloadClient.deselected()).toEqual([]);
		const history = (await pacerr.open('/activity')).text('.history');
		expect(history).toContain('23 files');
		expect(history).toContain('24 Parts');
	});

	it('reports a grab that the Download Client refused, with the reason', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.connectDownloadClient();
		pacerr.downloadClient.reachable = false;

		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const history = (await pacerr.open('/activity')).text('.history');
		expect(history).toContain('Failed');
		expect(history).toContain('unreachable');
	});
});

describe('a Download Client Pacerr cannot use', () => {
	it('says there is none configured rather than looking like an idle week', async () => {
		const pacerr = await startPacerr({ feed: fixtures.feed });
		await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

		const page = await pacerr.open('/activity');

		expect(page.text('.alert')).toBe('No Download Client is configured.');
	});
});
