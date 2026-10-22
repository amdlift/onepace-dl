import { readFileSync, statSync } from 'node:fs';
import { error } from '@sveltejs/kit';
import { getApp } from '../../../../../lib/server/runtime';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, request }) => {
	const poster = getApp().posters.view(params.slug);
	if (poster === null) error(404, 'Pacerr has no Poster for that Arc');

	const file = statSync(poster.path);
	const etag = `"${file.size.toString(36)}-${Math.trunc(file.mtimeMs).toString(36)}"`;
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers: { etag } });
	}

	return new Response(readFileSync(poster.path), {
		headers: {
			'content-type': poster.contentType,
			// A Poster dropped into the config volume has to appear on the next reload rather than
			// whenever the browser next decides to ask.
			'cache-control': 'no-cache',
			etag
		}
	});
};
