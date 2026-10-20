import { redirect } from '@sveltejs/kit';
import { forgetSession, rememberSession, sessionCookie } from '../../lib/server/auth/cookie';
import { getApp } from '../../lib/server/runtime';
import { readProfile, writeProfile, type Profile } from '../../lib/server/selection/profile';
import type { Resolution, Variant } from '../../lib/server/catalogue/watch-page';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { authentication: locals.authentication, profile: readProfile(getApp().db) };
};

export const actions: Actions = {
	saveProfile: async ({ request }) => {
		const submitted = await request.formData();
		const profile = profileFrom(submitted);
		if (profile === null) return { profileProblem: 'Choose at least one Resolution.' };
		writeProfile(getApp().db, profile);
		return { saved: true };
	},

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

function profileFrom(submitted: FormData): Profile | null {
	const ordered: Resolution[] = [];
	for (const rank of [1, 2, 3]) {
		const resolution = Number(submitted.get(`resolution-${rank}`));
		if (!isResolution(resolution) || ordered.includes(resolution)) continue;
		ordered.push(resolution);
	}
	if (ordered.length === 0) return null;

	const variant = String(submitted.get('variant') ?? '');
	const cutoff = Number(submitted.get('cutoff'));
	return {
		resolutions: ordered,
		variant: isVariant(variant) ? variant : 'regular',
		cutoff: isResolution(cutoff) ? cutoff : 1080
	};
}

const isResolution = (value: number): value is Resolution =>
	value === 480 || value === 720 || value === 1080;

const isVariant = (value: string): value is Variant =>
	value === 'regular' || value === 'extended' || value === 'alternate';
