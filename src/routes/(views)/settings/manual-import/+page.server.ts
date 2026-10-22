import { readImportSource, writeImportSource } from '../../../../lib/server/library/manual-import';
import { getApp } from '../../../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	importSource: readImportSource(getApp().db)
});

export const actions: Actions = {
	saveImportSource: async ({ request }) => {
		const submitted = await request.formData();
		writeImportSource(getApp().db, String(submitted.get('importSource') ?? ''));
		return { saved: true };
	}
};
