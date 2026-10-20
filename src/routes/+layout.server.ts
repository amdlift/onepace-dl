import { failingChecks, healthChecks } from '../lib/server/health/checks';
import { getApp } from '../lib/server/runtime';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// The login page wears this layout too, so a Pacerr exposed beyond a LAN would otherwise tell
	// anyone who reaches it what is wrong with the installation.
	const visible = !locals.authentication.enabled || locals.authentication.signedIn;
	return { failing: visible ? failingChecks(healthChecks(getApp())) : [] };
};
