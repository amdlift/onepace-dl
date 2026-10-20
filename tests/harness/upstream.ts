import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';

export interface UpstreamRequest {
	headers: Record<string, string>;
}

/**
 * One document One Pace publishes. Tests reshape upstream between scheduler ticks through this:
 * `upstream.watchPage.publish(html)`, `upstream.watchPage.fail(503)`.
 */
export class UpstreamResource {
	readonly requests: UpstreamRequest[] = [];
	#body: string;
	#status = 200;
	#contentType: string;
	#sendsValidators = false;
	#lastModified: string | null = null;

	constructor(body: string, contentType: string) {
		this.#body = body;
		this.#contentType = contentType;
	}

	publish(body: string): void {
		this.#body = body;
		this.#status = 200;
		this.#lastModified = new Date().toUTCString();
	}

	fail(status: number): void {
		this.#status = status;
	}

	/**
	 * One Pace serves no `ETag` or `Last-Modified` and ignores conditional requests, so the stub
	 * does the same by default. Turn this on to exercise the 304 path Pacerr keeps for the day
	 * upstream starts caching.
	 */
	sendValidators(): void {
		this.#sendsValidators = true;
		this.#lastModified ??= new Date().toUTCString();
	}

	get body(): string {
		return this.#body;
	}

	get requestCount(): number {
		return this.requests.length;
	}

	get etag(): string {
		return `"${createHash('sha256').update(this.#body).digest('hex').slice(0, 16)}"`;
	}

	handle(request: IncomingMessage, response: ServerResponse): void {
		this.requests.push({ headers: Object.fromEntries(Object.entries(request.headers) as [string, string][]) });

		if (this.#status !== 200) {
			response.writeHead(this.#status, { 'content-type': 'text/plain' });
			response.end('upstream is unwell');
			return;
		}

		if (this.#sendsValidators) {
			const lastModified = this.#lastModified ?? new Date().toUTCString();
			if (
				request.headers['if-none-match'] === this.etag ||
				request.headers['if-modified-since'] === lastModified
			) {
				response.writeHead(304, { etag: this.etag, 'last-modified': lastModified });
				response.end();
				return;
			}
			response.writeHead(200, {
				'content-type': this.#contentType,
				etag: this.etag,
				'last-modified': lastModified
			});
		} else {
			response.writeHead(200, { 'content-type': this.#contentType });
		}
		response.end(this.#body);
	}
}

const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>One Pace</title><lastBuildDate>Thu, 01 Jan 1970 00:00:00 GMT</lastBuildDate></channel></rss>`;

export class Upstream {
	readonly watchPage: UpstreamResource;
	readonly feed: UpstreamResource;
	#server: Server;
	#url = '';

	private constructor(watchPage: string, feed: string) {
		this.watchPage = new UpstreamResource(watchPage, 'text/html; charset=utf-8');
		this.feed = new UpstreamResource(feed, 'application/rss+xml');
		this.#server = createServer((request, response) => {
			const path = (request.url ?? '').split('?')[0];
			if (path === '/en/watch') return this.watchPage.handle(request, response);
			if (path === '/en/releases/rss.xml') return this.feed.handle(request, response);
			response.writeHead(404, { 'content-type': 'text/plain' });
			response.end(`One Pace publishes nothing at ${path}`);
		});
	}

	static async start(watchPage: string, feed: string = emptyFeed): Promise<Upstream> {
		const upstream = new Upstream(watchPage, feed);
		await new Promise<void>((resolve) => upstream.#server.listen(0, '127.0.0.1', resolve));
		const { port } = upstream.#server.address() as AddressInfo;
		upstream.#url = `http://127.0.0.1:${port}`;
		return upstream;
	}

	get url(): string {
		return this.#url;
	}

	async stop(): Promise<void> {
		this.#server.closeAllConnections();
		await new Promise<void>((resolve) => this.#server.close(() => resolve()));
	}
}
