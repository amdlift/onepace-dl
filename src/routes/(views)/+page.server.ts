import { isArcsLayout } from '../../lib/arcs-layout';
import { catalogueJob, feedJob } from '../../lib/server/app';
import { arcsView, readArcsLayout, writeArcsLayout } from '../../lib/server/arcs';
import { monitorEveryArc, toggleArcMonitored } from '../../lib/server/monitoring/store';
import { getApp } from '../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = getApp();
	return { catalogue: arcsView(app), feed: app.releases.view(), layout: readArcsLayout(app.db) };
};

export const actions: Actions = {
	chooseLayout: async ({ request }) => {
		const submitted = await request.formData();
		const layout = submitted.get('layout');
		if (isArcsLayout(layout)) writeArcsLayout(getApp().db, layout);
		return { chosen: true };
	},
	toggleMonitoring: async ({ request }) => {
		const submitted = await request.formData();
		const app = getApp();
		toggleArcMonitored(app.db, String(submitted.get('arc')));
		await app.acquisition.run();
		return { monitoring: true };
	},
	monitorAllArcs: async () => {
		const app = getApp();
		monitorEveryArc(app.db);
		await app.acquisition.run();
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
