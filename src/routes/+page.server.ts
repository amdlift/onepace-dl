import { catalogueJob, feedJob } from '../lib/server/app';
import { getApp } from '../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = getApp();
	return { catalogue: app.catalogue.view(), feed: app.releases.view() };
};

export const actions: Actions = {
	refreshCatalogue: async () => {
		await getApp().scheduler.runNow(catalogueJob);
		return { refreshed: true };
	},
	refreshReleases: async () => {
		await getApp().scheduler.runNow(feedJob);
		return { refreshed: true };
	}
};
