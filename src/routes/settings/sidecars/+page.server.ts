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
			seasonNfo: submitted.get('seasonNfo') !== null,
			episodeNfo: submitted.get('episodeNfo') !== null,
			seasonPoster: submitted.get('seasonPoster') !== null
		});
		return { saved: true };
	}
};
