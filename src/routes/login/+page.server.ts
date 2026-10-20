import { redirect } from '@sveltejs/kit';
import { rememberSession } from '../../lib/server/auth/cookie';
import { getApp } from '../../lib/server/runtime';
import type { Actions } from './$types';

export const actions: Actions = {
	logIn: async ({ request, cookies, url }) => {
		const submitted = await request.formData();
		const session = await getApp().authentication.logIn(
			String(submitted.get('username') ?? ''),
			String(submitted.get('password') ?? '')
		);
		if (session === null) return { problem: 'That username and password do not match.' };
		rememberSession(cookies, url, session);
		redirect(303, '/');
	}
};
