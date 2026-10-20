import { getApp } from '../../lib/server/runtime';
import { wantedView } from '../../lib/server/wanted';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { wanted: wantedView(getApp().db) };
};
