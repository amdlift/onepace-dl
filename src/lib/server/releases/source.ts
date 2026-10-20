export interface FeedValidators {
	etag: string | null;
	lastModified: string | null;
}

export type FeedFetch =
	| { kind: 'unchanged'; validators: FeedValidators }
	| { kind: 'fetched'; body: string; validators: FeedValidators };

export const noFeedValidators: FeedValidators = { etag: null, lastModified: null };

/**
 * One Pace sends no `ETag` or `Last-Modified` and answers every conditional request with the whole
 * body, so in practice the feed's own `lastBuildDate` is what spares the reparse. The conditional
 * headers are sent anyway: they cost nothing and start working the day upstream caches.
 */
export async function fetchFeed(baseUrl: string, stored: FeedValidators): Promise<FeedFetch> {
	const headers = new Headers();
	if (stored.etag !== null) headers.set('if-none-match', stored.etag);
	if (stored.lastModified !== null) headers.set('if-modified-since', stored.lastModified);

	const response = await fetch(new URL('/en/releases/rss.xml', baseUrl), { headers });
	if (response.status === 304) return { kind: 'unchanged', validators: stored };
	if (!response.ok) throw new Error(`One Pace answered ${response.status} to the release feed`);

	return {
		kind: 'fetched',
		body: await response.text(),
		validators: {
			etag: response.headers.get('etag'),
			lastModified: response.headers.get('last-modified')
		}
	};
}
