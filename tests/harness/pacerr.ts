import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse
} from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { onTestFinished } from 'vitest';
import { declareConnectionProtocol, protocolHeader } from '../../src/lib/connection-protocol';
import type { App } from '../../src/lib/server/app';
import { getApp, setRuntime, stopApp, type EnvironmentPaths } from '../../src/lib/server/runtime';
import { hours, minutes, ManualClock } from './clock';
import { FakeDownloadClient } from './download-client';
import { PacerrPage } from './page';
import { Upstream } from './upstream';

export { days, hours, minutes, seconds } from './clock';
export { PacerrPage } from './page';
export { FakeDownloadClient } from './download-client';

const repoRoot = new URL('../../', import.meta.url);

export const fixtures = {
	watchPage: readFileSync(
		new URL('src/lib/server/catalogue/fixtures/watch-page.html', repoRoot),
		'utf8'
	),
	feed: readFileSync(new URL('src/lib/server/releases/fixtures/feed.xml', repoRoot), 'utf8')
};

export interface StartOptions {
	/** Pass a previous instance's `paths.config` to boot against the state it left behind. */
	configDir?: string;
	/** What the Catalogue scrape finds on the first tick. Defaults to the checked-in watch page. */
	watchPage?: string;
	feed?: string;
	now?: Date;
	/** Credentials the container was given by environment variable. */
	authentication?: { username: string; password: string };
	/**
	 * Where the download directory is mounted. Pass a path on another filesystem to boot the
	 * deployment whose Library and downloads cannot be hardlinked between.
	 */
	downloadsDir?: string;
	/** Paths the container was pinned to by environment variable, which Settings cannot change. */
	libraryFromEnvironment?: string;
	downloadsFromEnvironment?: string;
}

export interface PacerrPaths {
	config: string;
	library: string;
	downloads: string;
}

type ConnectHandler = (
	request: IncomingMessage,
	response: ServerResponse,
	next: () => void
) => void;

let handler: ConnectHandler | null = null;

async function loadHandler(): Promise<ConnectHandler> {
	process.env.PROTOCOL_HEADER ??= protocolHeader;
	handler ??= (
		(await import(/* @vite-ignore */ new URL('build/handler.js', repoRoot).href)) as {
			handler: ConnectHandler;
		}
	).handler;
	return handler;
}

/**
 * Pacerr booted end to end: real SQLite, real parser, real filesystem, with One Pace, the
 * Download Client and the clock substituted. Drive it the way a person does — over HTTP.
 */
export class Pacerr {
	#server: Server | null = null;
	#app: App | null = null;
	#url = '';
	#cookies = new Map<string, string>();
	#unconfigured: string;

	private constructor(
		readonly upstream: Upstream,
		readonly clock: ManualClock,
		readonly downloadClient: FakeDownloadClient,
		readonly paths: PacerrPaths,
		unconfigured: string,
		readonly environmentCredentials: { username: string; password: string } | null,
		readonly environmentPaths: EnvironmentPaths
	) {
		this.#unconfigured = unconfigured;
	}

	static async start(options: StartOptions = {}): Promise<Pacerr> {
		const root = mkdtempSync(join(tmpdir(), 'pacerr-'));
		const paths: PacerrPaths = {
			config: options.configDir ?? join(root, 'config'),
			library: join(root, 'library'),
			downloads: options.downloadsDir ?? join(root, 'downloads')
		};
		// Where an unconfigured Pacerr would mount them, and somewhere no test ever looks: the
		// Library a test reads is then only ever one Settings was actually told about.
		const unconfigured = join(root, 'unconfigured');
		for (const path of [...Object.values(paths), unconfigured]) {
			mkdirSync(path, { recursive: true });
		}

		const pacerr = new Pacerr(
			await Upstream.start(options.watchPage ?? fixtures.watchPage, options.feed),
			new ManualClock(options.now ?? new Date('2026-10-19T22:00:00Z')),
			new FakeDownloadClient(),
			paths,
			unconfigured,
			options.authentication ?? null,
			{
				library: options.libraryFromEnvironment ?? null,
				downloads: options.downloadsFromEnvironment ?? null
			}
		);
		onTestFinished(async () => {
			await pacerr.stop();
			await pacerr.upstream.stop();
			rmSync(root, { recursive: true, force: true });
		});
		await pacerr.#boot();
		await pacerr.#configureDirectories();
		return pacerr;
	}

	get url(): string {
		return this.#url;
	}

	/** Move time forward and let the Scheduler run whatever that made due. */
	async advance(milliseconds: number): Promise<void> {
		this.clock.advance(milliseconds);
		await this.#running().scheduler.tick();
	}

	/** Let whatever a form action started in the background run to completion. */
	async settle(): Promise<void> {
		await this.#running().background.settle();
	}

	/** Park background work at its next pause, so a test can read a job that is still running. */
	async hold(): Promise<void> {
		await this.#running().background.hold();
	}

	async fetch(path: string, init?: RequestInit): Promise<Response> {
		const headers = new Headers(init?.headers);
		if (this.#cookies.size > 0 && !headers.has('cookie')) {
			headers.set(
				'cookie',
				[...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ')
			);
		}
		const response = await fetch(new URL(path, this.#url), { ...init, headers });
		this.#keepCookies(response);
		return response;
	}

	/** Empty the cookie jar: the same Pacerr, opened in a browser that has never seen it. */
	forget(): void {
		this.#cookies.clear();
	}

	async open(path: string): Promise<PacerrPage> {
		const response = await this.fetch(path);
		return new PacerrPage(response.status, await response.text());
	}

	/** Submit a form action, the way a browser without JavaScript does. */
	async submit(
		path: string,
		action: string,
		fields: Record<string, string> = {}
	): Promise<PacerrPage> {
		const response = await this.fetch(`${path}?/${action}`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', origin: this.#url },
			body: new URLSearchParams(fields).toString()
		});
		const body = await response.text();
		if (response.status >= 400) throw new Error(`${action} failed: ${response.status} ${body}`);
		return this.open(path);
	}

	/** Point Pacerr at a Download Client, the way a user does before anything can be grabbed. */
	async connectDownloadClient(): Promise<void> {
		await this.submit('/settings', 'saveDownloadClient', {
			url: 'http://qbittorrent.test:8080',
			username: 'admin',
			password: 'adminadmin'
		});
	}

	/**
	 * Point Pacerr at this test's directories the way a person does — by typing them into Settings
	 * — so every test runs against a Library that was configured through the application itself.
	 */
	async #configureDirectories(): Promise<void> {
		const credentials = this.environmentCredentials;
		if (credentials !== null) await this.submit('/login', 'logIn', credentials);
		await this.submit('/settings', 'saveLibrary', { library: this.paths.library });
		await this.submit('/settings', 'saveDownloads', { downloads: this.paths.downloads });
		if (credentials !== null) this.forget();
	}

	/** Recreate the container: same config volume and same upstream, everything else new. */
	async restart(): Promise<void> {
		await this.stop();
		await this.#boot();
	}

	async stop(): Promise<void> {
		const server = this.#server;
		this.#server = null;
		this.#app = null;
		if (server !== null) {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
		stopApp();
	}

	async #boot(): Promise<void> {
		setRuntime({
			clock: this.clock,
			downloadClients: () => this.downloadClient,
			onePaceBaseUrl: this.upstream.url,
			paths: {
				config: this.paths.config,
				library: this.#unconfigured,
				downloads: this.#unconfigured
			},
			catalogueRefreshInterval: hours(24),
			feedPollInterval: minutes(15),
			polls: false,
			environmentCredentials: this.environmentCredentials,
			environmentPaths: this.environmentPaths
		});
		this.#app = getApp();
		await this.#app.ready;

		const handle = await loadHandler();
		const server = createServer((request, response) => {
			declareConnectionProtocol(request);
			handle(request, response, () => void response.writeHead(404).end('no route'));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		this.#server = server;
		this.#url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}

	#keepCookies(response: Response): void {
		for (const header of response.headers.getSetCookie()) {
			const pair = header.split(';')[0] ?? '';
			const separator = pair.indexOf('=');
			const name = pair.slice(0, separator).trim();
			const value = pair.slice(separator + 1).trim();
			if (value === '' || /max-age=0/i.test(header)) this.#cookies.delete(name);
			else this.#cookies.set(name, value);
		}
	}

	#running(): App {
		if (this.#app === null) throw new Error('Pacerr is not running');
		return this.#app;
	}
}

export const startPacerr = (options?: StartOptions): Promise<Pacerr> => Pacerr.start(options);
