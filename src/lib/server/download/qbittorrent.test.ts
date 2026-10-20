import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { QBittorrentClient } from './qbittorrent';

interface Recorded {
	path: string;
	contentType: string;
	body: string;
}

type Answer = (request: IncomingMessage, response: ServerResponse) => void;

/**
 * qBittorrent as far as Pacerr can tell: the WebUI's HTTP surface, scripted per test. Seam 4 —
 * the triage this adapter does over auth responses and over metadata that has not arrived cannot
 * be reached from seam 1, which replaces this whole module with a fake.
 */
class StubDaemon {
	readonly received: Recorded[] = [];
	readonly answers = new Map<string, Answer>();
	#server: Server;
	#url = '';

	private constructor() {
		this.#server = createServer((request, response) => {
			const path = (request.url ?? '').split('?')[0] ?? '';
			const chunks: Buffer[] = [];
			request.on('data', (chunk: Buffer) => chunks.push(chunk));
			request.on('end', () => {
				this.received.push({
					path,
					contentType: request.headers['content-type'] ?? '',
					body: Buffer.concat(chunks).toString('utf8')
				});
				const answer = this.answers.get(path) ?? notFound;
				answer(request, response);
			});
		});
	}

	static async start(): Promise<StubDaemon> {
		const daemon = new StubDaemon();
		daemon.answers.set('/api/v2/auth/login', signIn);
		await new Promise<void>((resolve) => daemon.#server.listen(0, '127.0.0.1', resolve));
		daemon.#url = `http://127.0.0.1:${(daemon.#server.address() as AddressInfo).port}`;
		return daemon;
	}

	get url(): string {
		return this.#url;
	}

	client(): QBittorrentClient {
		return new QBittorrentClient(
			{ url: this.#url, username: 'admin', password: 'adminadmin' },
			async () => {}
		);
	}

	pathsCalled(path: string): Recorded[] {
		return this.received.filter((request) => request.path === path);
	}

	async stop(): Promise<void> {
		this.#server.closeAllConnections();
		await new Promise<void>((resolve) => this.#server.close(() => resolve()));
	}
}

const signIn: Answer = (_request, response) => {
	response.writeHead(200, { 'set-cookie': 'SID=abc123; path=/; HttpOnly' });
	response.end('Ok.');
};

const notFound: Answer = (_request, response) => {
	response.writeHead(404, { 'content-type': 'text/plain' });
	response.end('Not Found');
};

const json =
	(payload: unknown): Answer =>
	(_request, response) => {
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(JSON.stringify(payload));
	};

const ok =
	(body = 'Ok.'): Answer =>
	(_request, response) => {
		response.writeHead(200, { 'content-type': 'text/plain' });
		response.end(body);
	};

const status =
	(code: number): Answer =>
	(_request, response) => {
		response.writeHead(code, { 'content-type': 'text/plain' });
		response.end('no');
	};

let daemon: StubDaemon | null = null;

const start = async (): Promise<StubDaemon> => {
	daemon = await StubDaemon.start();
	return daemon;
};

afterEach(async () => {
	await daemon?.stop();
	daemon = null;
});

describe('handing a Release to qBittorrent', () => {
	it('submits a magnet URI as the multipart form the API insists on', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/torrents/add', ok());

		await stub.client().add({ infohash: 'abcd', magnetUri: 'magnet:?xt=urn:btih:abcd' });

		const [added] = stub.pathsCalled('/api/v2/torrents/add');
		expect(added?.contentType).toContain('multipart/form-data');
		expect(added?.body).toContain('magnet:?xt=urn:btih:abcd');
	});

	it('submits a torrent URL for a Release the feed carries no magnet for', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/torrents/add', ok());

		await stub.client().add({ infohash: 'abcd', torrentUrl: 'https://onepace.net/a.torrent' });

		expect(stub.pathsCalled('/api/v2/torrents/add')[0]?.body).toContain(
			'https://onepace.net/a.torrent'
		);
	});
});

describe('leaving files out of a Batch', () => {
	it('waits for the metadata a magnet link does not arrive with', async () => {
		const stub = await start();
		let attempts = 0;
		stub.answers.set('/api/v2/torrents/files', (request, response) => {
			attempts += 1;
			if (attempts < 3) return status(409)(request, response);
			return json([
				{ index: 1, name: 'Part 02.mkv' },
				{ index: 0, name: 'Part 01.mkv' }
			])(request, response);
		});

		const files = await stub.client().files('ABCD');

		expect(files).toEqual(['Part 01.mkv', 'Part 02.mkv']);
		expect(attempts).toBe(3);
	});

	it('asks for zero priority on the positions it does not need', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/torrents/filePrio', ok());

		await stub.client().setFilePriority('ABCD', [0, 3], 'skip');

		const body = stub.pathsCalled('/api/v2/torrents/filePrio')[0]?.body ?? '';
		expect(body).toContain('0|3');
		expect(body).toContain('priority');
		expect(body).toMatch(/name="priority"[\s\S]*?0/);
	});
});

describe('reading what the daemon is doing', () => {
	it('calls a torrent complete on the moment it finished, not on its state string', async () => {
		const stub = await start();
		stub.answers.set(
			'/api/v2/torrents/info',
			json([
				{
					hash: 'AAAA',
					progress: 1,
					state: 'stalledUP',
					completion_on: 1760000000,
					content_path: '/downloads/Reverie'
				},
				{ hash: 'BBBB', progress: 0.5, state: 'downloading', completion_on: 0, content_path: '' },
				{ hash: 'CCCC', progress: 0.2, state: 'error', completion_on: 0, content_path: '' }
			])
		);

		const statuses = await stub.client().statuses(['AAAA', 'BBBB', 'CCCC']);

		expect(statuses).toEqual([
			{
				infohash: 'aaaa',
				state: 'completed',
				progress: 1,
				contentPath: '/downloads/Reverie'
			},
			{ infohash: 'bbbb', state: 'downloading', progress: 0.5, contentPath: null },
			{ infohash: 'cccc', state: 'failed', progress: 0.2, contentPath: null }
		]);
	});

	it('removes a torrent with or without the data it downloaded', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/torrents/delete', ok());
		const client = stub.client();

		await client.remove('AAAA', false);
		await client.remove('BBBB', true);

		const bodies = stub.pathsCalled('/api/v2/torrents/delete').map((request) => request.body);
		expect(bodies[0]).toMatch(/name="deleteFiles"[\s\S]*?false/);
		expect(bodies[1]).toMatch(/name="deleteFiles"[\s\S]*?true/);
	});
});

describe('testing the connection', () => {
	it('names the daemon it reached', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/app/version', ok('v5.0.3'));

		expect(await stub.client().test()).toEqual({
			ok: true,
			detail: 'Connected to qBittorrent v5.0.3.'
		});
	});

	it('calls a login answered without a session bad credentials, not a failure', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/auth/login', ok('Fails.'));

		const outcome = await stub.client().test();

		expect(outcome.ok).toBe(false);
		expect(outcome).toMatchObject({ failure: 'credentials' });
	});

	it('calls a forbidden login a ban, because that is what qBittorrent means by it', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/auth/login', status(403));

		const outcome = await stub.client().test();

		expect(outcome).toMatchObject({ failure: 'banned' });
		expect(outcome.detail).toContain('too many failed login attempts');
	});

	it('calls an address that answers something else rejected rather than unreachable', async () => {
		const stub = await start();
		stub.answers.set('/api/v2/auth/login', status(404));

		expect(await stub.client().test()).toMatchObject({ failure: 'rejected' });
	});

	it('calls an address that answers nothing at all unreachable', async () => {
		const stub = await start();
		const url = stub.url;
		await stub.stop();
		daemon = null;

		const outcome = await new QBittorrentClient(
			{ url, username: 'admin', password: 'adminadmin' },
			async () => {}
		).test();

		expect(outcome).toMatchObject({ failure: 'unreachable' });
	});
});
