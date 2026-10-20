import { error } from '@sveltejs/kit';
import { arcDetailView } from '../../../lib/server/arc-detail';
import { toggleArcMonitored, togglePartWanted } from '../../../lib/server/monitoring/store';
import { getApp } from '../../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const arc = arcDetailView(getApp().db, params.slug);
	if (arc === null) error(404, 'The Catalogue lists no such Arc');
	return { arc };
};

export const actions: Actions = {
	toggleMonitoring: async ({ params }) => {
		toggleArcMonitored(getApp().db, params.slug);
		return { monitoring: true };
	},
	togglePartWanted: async ({ request }) => {
		const submitted = await request.formData();
		togglePartWanted(getApp().db, String(submitted.get('part')));
		return { monitoring: true };
	}
};
