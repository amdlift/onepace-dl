import { activityView } from '../../../lib/server/activity';
import { getApp } from '../../../lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { activity: await activityView(getApp()) };
};
