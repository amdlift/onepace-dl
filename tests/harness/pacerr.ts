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
import { getApp, setRuntime, stopApp } from '../../src/lib/server/runtime';
import { hours, ManualClock } from './clock';
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
	)
};

export interface StartOptions {
	/** Pass a previous instance's `paths.config` to boot against the state it left behind. */
	configDir?: string;
	/** What the Catalogue scrape finds on the first tick. Defaults to the checked-in watch page. */
	watchPage?: string;
	feed?: string;
	now?: Date;
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

	private constructor(
		readonly upstream: Upstream,
		readonly clock: ManualClock,
		readonly downloadClient: FakeDownloadClient,
		readonly paths: PacerrPaths
	) {}

	static async start(options: StartOptions = {}): Promise<Pacerr> {
		const root = mkdtempSync(join(tmpdir(), 'pacerr-'));
		const paths: PacerrPaths = {
			config: options.configDir ?? join(root, 'config'),
			library: join(root, 'library'),
			downloads: join(root, 'downloads')
		};
		for (const path of Object.values(paths)) mkdirSync(path, { recursive: true });

		const pacerr = new Pacerr(
			await Upstream.start(options.watchPage ?? fixtures.watchPage, options.feed),
			new ManualClock(options.now ?? new Date('2026-10-19T22:00:00Z')),
			new FakeDownloadClient(),
			paths
		);
		onTestFinished(async () => {
			await pacerr.stop();
			await pacerr.upstream.stop();
			rmSync(root, { recursive: true, force: true });
		});
		await pacerr.#boot();
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

	async fetch(path: string, init?: RequestInit): Promise<Response> {
		return fetch(new URL(path, this.#url), init);
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
			downloadClient: this.downloadClient,
			onePaceBaseUrl: this.upstream.url,
			paths: this.paths,
			catalogueRefreshInterval: hours(24),
			polls: false
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

	#running(): App {
		if (this.#app === null) throw new Error('Pacerr is not running');
		return this.#app;
	}
}

export const startPacerr = (options?: StartOptions): Promise<Pacerr> => Pacerr.start(options);
