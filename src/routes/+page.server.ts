import { catalogueJob, feedJob } from '../lib/server/app';
import { arcsView } from '../lib/server/arcs';
import { getApp } from '../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = getApp();
	return { catalogue: arcsView(app), feed: app.releases.view() };
};

export const actions: Actions = {
	toggleMonitoring: async ({ request }) => {
		const submitted = await request.formData();
		getApp().monitoring.toggleArc(String(submitted.get('arc')));
		return { monitoring: true };
	},
	monitorAllArcs: async () => {
		getApp().monitoring.monitorEveryArc();
		return { monitoring: true };
	},
	refreshCatalogue: async () => {
		await getApp().scheduler.runNow(catalogueJob);
		return { refreshed: true };
	},
	refreshReleases: async () => {
		await getApp().scheduler.runNow(feedJob);
		return { refreshed: true };
	}
};
