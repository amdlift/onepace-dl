import { getApp } from '../../../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = getApp();
	return {
		downloadClient: app.downloads.connection(),
		connection: app.downloads.health()
	};
};

export const actions: Actions = {
	saveDownloadClient: async ({ request }) => {
		const submitted = await request.formData();
		const app = getApp();
		app.downloads.configure({
			url: String(submitted.get('url') ?? '').trim(),
			username: String(submitted.get('username') ?? '').trim(),
			password: String(submitted.get('password') ?? '')
		});
		// Pointing Pacerr at a Download Client is the moment story 65's validation has something new
		// to say, because only the client knows where it will put the files.
		await app.downloads.test();
		await app.acquisition.run();
		return { saved: true };
	},

	testDownloadClient: async () => {
		await getApp().downloads.test();
		return { tested: true };
	}
};
