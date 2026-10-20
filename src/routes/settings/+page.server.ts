import { redirect } from '@sveltejs/kit';
import { forgetSession, rememberSession, sessionCookie } from '../../lib/server/auth/cookie';
import { getApp } from '../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { authentication: locals.authentication };
};

export const actions: Actions = {
	saveAuthentication: async ({ request, cookies, url, locals }) => {
		const submitted = await request.formData();
		const authentication = getApp().authentication;
		const outcome = await authentication.configure({
			enabled: submitted.get('enabled') !== null,
			username: String(submitted.get('username') ?? ''),
			password: String(submitted.get('password') ?? '')
		});
		if (!outcome.ok) return { problem: outcome.problem };

		// Turning a login on from an unauthenticated session would otherwise lock the person who
		// just turned it on straight out of the page they are looking at.
		if (authentication.state().enabled && !locals.authentication.signedIn) {
			rememberSession(cookies, url, authentication.startSession());
		}
		return { saved: true };
	},

	logOut: async ({ cookies, url }) => {
		const sessionId = cookies.get(sessionCookie);
		if (sessionId !== undefined) getApp().authentication.endSession(sessionId);
		forgetSession(cookies, url);
		redirect(303, '/');
	}
};
