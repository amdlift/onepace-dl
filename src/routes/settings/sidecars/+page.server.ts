import { readSidecarSwitches, writeSidecarSwitches } from '../../../lib/server/library/sidecars';
import { getApp } from '../../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	switches: readSidecarSwitches(getApp().db)
});

export const actions: Actions = {
	saveSidecars: async ({ request }) => {
		const submitted = await request.formData();
		// A browser submits nothing at all for an unticked box, so absence is what "off" looks like.
		writeSidecarSwitches(getApp().db, {
			showNfo: submitted.get('showNfo') !== null,
			arcNfo: submitted.get('arcNfo') !== null,
			partNfo: submitted.get('partNfo') !== null,
			arcPoster: submitted.get('arcPoster') !== null
		});
		return { saved: true };
	}
};
