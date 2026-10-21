import { getApp } from '../../../lib/server/runtime';
import { readProfile, writeProfile, type Profile } from '../../../lib/server/selection/profile';
import type { Resolution, Variant } from '../../../lib/server/catalogue/watch-page';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	profile: readProfile(getApp().db)
});

export const actions: Actions = {
	saveProfile: async ({ request }) => {
		const submitted = await request.formData();
		const profile = profileFrom(submitted);
		if (profile === null) return { profileProblem: 'Choose at least one Resolution.' };
		const app = getApp();
		writeProfile(app.db, profile);
		await app.acquisition.run();
		return { saved: true };
	}
};

function profileFrom(submitted: FormData): Profile | null {
	const ordered: Resolution[] = [];
	for (const rank of [1, 2, 3]) {
		const resolution = Number(submitted.get(`resolution-${rank}`));
		if (!isResolution(resolution) || ordered.includes(resolution)) continue;
		ordered.push(resolution);
	}
	if (ordered.length === 0) return null;

	const variant = String(submitted.get('variant') ?? '');
	const cutoff = Number(submitted.get('cutoff'));
	return {
		resolutions: ordered,
		variant: isVariant(variant) ? variant : 'regular',
		cutoff: isResolution(cutoff) ? cutoff : 1080
	};
}

const isResolution = (value: number): value is Resolution =>
	value === 480 || value === 720 || value === 1080;

const isVariant = (value: string): value is Variant =>
	value === 'regular' || value === 'extended' || value === 'alternate';
