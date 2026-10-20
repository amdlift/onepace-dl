import { error } from '@sveltejs/kit';
import { arcDetailView } from '../../../lib/server/arc-detail';
import { getApp } from '../../../lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const arc = arcDetailView(getApp().db, params.slug);
	if (arc === null) error(404, 'The Catalogue lists no such Arc');
	return { arc };
};
