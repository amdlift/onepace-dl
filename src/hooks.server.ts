import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { sessionCookie } from './lib/server/auth/cookie';
import { ConfigurationError } from './lib/server/paths/validation';
import { getApp } from './lib/server/runtime';

export const loginPath = '/login';

export const init: ServerInit = async () => {
	try {
		await getApp().ready;
	} catch (error) {
		if (!(error instanceof ConfigurationError)) throw error;
		// Expected, already said in one sentence that names the path and both fixes. Letting it
		// unwind would print that sentence again under a stack trace from inside the bundle.
		console.error(`Pacerr: ${error.message}`);
		process.exit(1);
	}
};

/**
 * The one gate. Every view, form action, endpoint and `__data.json` request SvelteKit serves passes
 * through `handle` before it is routed, so nothing can be reachable without being named here.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const authentication = getApp().authentication;
	const state = authentication.state();
	const sessionId = event.cookies.get(sessionCookie);
	const signedIn =
		state.enabled && sessionId !== undefined && authentication.recognises(sessionId);

	event.locals.authentication = { ...state, signedIn };

	const atLogin = routeOf(event.url.pathname) === loginPath;
	if (!state.enabled || signedIn) return atLogin ? seeOther('/') : resolve(event);
	return atLogin ? resolve(event) : seeOther(loginPath);
};

function routeOf(pathname: string): string {
	const route = pathname.replace(/\/__data\.json$/, '').replace(/(.)\/+$/, '$1');
	return route === '' ? '/' : route;
}

const seeOther = (location: string): Response =>
	new Response(null, { status: 303, headers: { location } });
