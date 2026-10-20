import { catalogueJob } from '../lib/server/app';
import { getApp } from '../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { catalogue: getApp().catalogue.view() };
};

export const actions: Actions = {
	refreshCatalogue: async () => {
		await getApp().scheduler.runNow(catalogueJob);
		return { refreshed: true };
	}
};
