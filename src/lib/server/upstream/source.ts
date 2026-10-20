export interface Validators {
	etag: string | null;
	lastModified: string | null;
}

export type UpstreamFetch =
	| { kind: 'unchanged'; validators: Validators }
	| { kind: 'fetched'; body: string; validators: Validators };

/**
 * One document One Pace publishes, fetched.
 *
 * Per ADR-0005 One Pace serves no `ETag` and no `Last-Modified` and answers every conditional
 * request with the whole body, so the 304 branch below has never been taken against the real site.
 * The headers are sent anyway: they cost nothing and start working the day upstream puts a cache
 * in front of itself. What actually spares work is the freshness token each document derives from
 * the body it just paid for, which is the caller's business rather than this function's.
 */
export async function fetchUpstream(
	document: { url: URL; subject: string },
	stored: Validators
): Promise<UpstreamFetch> {
	const headers = new Headers();
	if (stored.etag !== null) headers.set('if-none-match', stored.etag);
	if (stored.lastModified !== null) headers.set('if-modified-since', stored.lastModified);

	const response = await fetch(document.url, { headers });
	if (response.status === 304) return { kind: 'unchanged', validators: stored };
	if (!response.ok)
		throw new Error(`One Pace answered ${response.status} to ${document.subject}`);

	return {
		kind: 'fetched',
		body: await response.text(),
		validators: {
			etag: response.headers.get('etag'),
			lastModified: response.headers.get('last-modified')
		}
	};
}
