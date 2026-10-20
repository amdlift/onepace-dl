import { createHash } from 'node:crypto';

export interface SourceValidators {
	bodySha256: string | null;
	etag: string | null;
	lastModified: string | null;
}

export type WatchPageFetch =
	| { kind: 'unchanged'; validators: SourceValidators }
	| { kind: 'changed'; body: string; validators: SourceValidators };

export const noValidators: SourceValidators = {
	bodySha256: null,
	etag: null,
	lastModified: null
};

/**
 * One Pace sends no `ETag` or `Last-Modified` and answers every conditional request with the whole
 * body, so the stored body hash — not a 304 — is what actually spares the reparse. The conditional
 * headers are sent anyway: they cost nothing and start working the day upstream caches.
 */
export async function fetchWatchPage(
	baseUrl: string,
	stored: SourceValidators
): Promise<WatchPageFetch> {
	const headers = new Headers();
	if (stored.etag !== null) headers.set('if-none-match', stored.etag);
	if (stored.lastModified !== null) headers.set('if-modified-since', stored.lastModified);

	const response = await fetch(new URL('/en/watch', baseUrl), { headers });
	if (response.status === 304) return { kind: 'unchanged', validators: stored };
	if (!response.ok) throw new Error(`One Pace answered ${response.status} to the watch page`);

	const body = await response.text();
	const validators: SourceValidators = {
		bodySha256: createHash('sha256').update(body).digest('hex'),
		etag: response.headers.get('etag'),
		lastModified: response.headers.get('last-modified')
	};
	if (validators.bodySha256 === stored.bodySha256) return { kind: 'unchanged', validators };
	return { kind: 'changed', body, validators };
}
