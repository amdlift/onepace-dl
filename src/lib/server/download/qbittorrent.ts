import type {
	ConnectionTest,
	DownloadClient,
	DownloadClientConnection,
	DownloadRequest,
	DownloadStatus,
	FilePriority
} from './client';

interface TorrentInfo {
	hash: string;
	progress: number;
	state: string;
	completion_on: number;
	content_path: string;
}

interface TorrentFile {
	index: number;
	name: string;
}

const priorities: Record<FilePriority, string> = { skip: '0', normal: '1' };

/** Metadata for a magnet link arrives from the swarm, so the file list is not there on add. */
const metadataAttempts = 30;
const metadataPause = 1000;

export class QBittorrentClient implements DownloadClient {
	#connection: DownloadClientConnection;
	#session: string | null = null;
	#pause: (milliseconds: number) => Promise<void>;

	constructor(
		connection: DownloadClientConnection,
		pause = (milliseconds: number) =>
			new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
	) {
		this.#connection = connection;
		this.#pause = pause;
	}

	async add(request: DownloadRequest): Promise<void> {
		const form = new FormData();
		form.set('urls', request.magnetUri ?? request.torrentUrl ?? '');
		await this.#call('/api/v2/torrents/add', form);
	}

	async files(infohash: string): Promise<string[]> {
		for (let attempt = 0; attempt < metadataAttempts; attempt += 1) {
			const response = await this.#call(
				`/api/v2/torrents/files?hash=${encodeURIComponent(infohash.toLowerCase())}`
			);
			if (response.status !== 409) {
				const files = (await response.json()) as TorrentFile[];
				if (files.length > 0)
					return [...files]
						.sort((left, right) => left.index - right.index)
						.map((file) => file.name);
			}
			await this.#pause(metadataPause);
		}
		throw new Error(`qBittorrent never produced a file list for ${infohash}`);
	}

	async setFilePriority(
		infohash: string,
		positions: number[],
		priority: FilePriority
	): Promise<void> {
		if (positions.length === 0) return;
		const form = new FormData();
		form.set('hash', infohash.toLowerCase());
		form.set('id', positions.join('|'));
		form.set('priority', priorities[priority]);
		await this.#call('/api/v2/torrents/filePrio', form);
	}

	async statuses(infohashes: string[]): Promise<DownloadStatus[]> {
		if (infohashes.length === 0) return [];
		const hashes = infohashes.map((it) => it.toLowerCase()).join('|');
		const response = await this.#call(
			`/api/v2/torrents/info?hashes=${encodeURIComponent(hashes)}`
		);
		const torrents = (await response.json()) as TorrentInfo[];
		return torrents.map((torrent) => ({
			infohash: torrent.hash.toLowerCase(),
			state: stateOf(torrent),
			progress: torrent.progress,
			contentPath: torrent.content_path === '' ? null : torrent.content_path
		}));
	}

	async saveDirectory(): Promise<string | null> {
		const response = await this.#call('/api/v2/app/preferences');
		const preferences = (await response.json()) as { save_path?: string };
		const path = preferences.save_path ?? '';
		return path === '' ? null : path;
	}

	async remove(infohash: string, deleteData: boolean): Promise<void> {
		const form = new FormData();
		form.set('hashes', infohash.toLowerCase());
		form.set('deleteFiles', String(deleteData));
		await this.#call('/api/v2/torrents/delete', form);
	}

	async test(): Promise<ConnectionTest> {
		let login;
		try {
			login = await this.#logIn();
		} catch (error) {
			return {
				ok: false,
				failure: 'unreachable',
				detail: `Pacerr could not reach ${this.#connection.url}: ${reasonOf(error)}`
			};
		}

		if (login.status === 403)
			return {
				ok: false,
				failure: 'banned',
				detail:
					`${this.#connection.url} has banned this address after too many failed login ` +
					`attempts. It will lift on its own, or sooner if you restart qBittorrent.`
			};
		if (!login.ok)
			return {
				ok: false,
				failure: 'rejected',
				detail: `${this.#connection.url} answered ${login.status}, not like a qBittorrent WebUI.`
			};
		// A wrong password is answered with 200 and no session cookie, so the status says nothing.
		if (this.#session === null)
			return {
				ok: false,
				failure: 'credentials',
				detail: `${this.#connection.url} rejected that username and password.`
			};

		try {
			const version = await (await this.#call('/api/v2/app/version')).text();
			return { ok: true, detail: `Connected to qBittorrent ${version.trim()}.` };
		} catch (error) {
			return {
				ok: false,
				failure: 'unreachable',
				detail: `Pacerr could not reach ${this.#connection.url}: ${reasonOf(error)}`
			};
		}
	}

	async #call(path: string, body?: FormData): Promise<Response> {
		if (this.#session === null) await this.#authenticate();
		let response = await this.#send(path, body);
		if (response.status === 403) {
			// The session expired or qBittorrent restarted; one silent re-login, then give up.
			await this.#authenticate();
			response = await this.#send(path, body);
		}
		if (!response.ok && response.status !== 409)
			throw new Error(`qBittorrent answered ${response.status} for ${path}`);
		return response;
	}

	async #authenticate(): Promise<void> {
		const login = await this.#logIn();
		if (!login.ok) throw new Error(`qBittorrent answered ${login.status} to a login`);
		if (this.#session === null)
			throw new Error('qBittorrent rejected the configured username and password');
	}

	async #logIn(): Promise<Response> {
		this.#session = null;
		const body = new URLSearchParams({
			username: this.#connection.username,
			password: this.#connection.password
		});
		const response = await fetch(new URL('/api/v2/auth/login', this.#connection.url), {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				// qBittorrent rejects any request whose origin is not the WebUI's own address.
				referer: this.#connection.url,
				origin: this.#connection.url
			},
			body
		});
		this.#session = sessionIn(response);
		return response;
	}

	async #send(path: string, body?: FormData): Promise<Response> {
		return fetch(new URL(path, this.#connection.url), {
			method: body === undefined ? 'GET' : 'POST',
			headers: {
				cookie: `SID=${this.#session ?? ''}`,
				referer: this.#connection.url,
				origin: this.#connection.url
			},
			...(body === undefined ? {} : { body })
		});
	}
}

function sessionIn(response: Response): string | null {
	for (const header of response.headers.getSetCookie()) {
		const match = /(?:^|;\s*)SID=([^;]+)/.exec(header);
		if (match !== null) return match[1] ?? null;
	}
	return null;
}

function stateOf(torrent: TorrentInfo): DownloadStatus['state'] {
	if (torrent.state === 'error' || torrent.state === 'missingFiles') return 'failed';
	// There is no completed flag; qBittorrent states the moment it finished instead.
	return torrent.completion_on > 0 || torrent.progress >= 1 ? 'completed' : 'downloading';
}

const reasonOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
