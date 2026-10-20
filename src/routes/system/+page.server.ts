import { getApp } from '../../lib/server/runtime';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { unmatched: getApp().releases.unmatched() };
};
