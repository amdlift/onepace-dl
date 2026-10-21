import { failingChecks, healthChecks } from '../../lib/server/health/checks';
import { getApp } from '../../lib/server/runtime';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => ({
	failing: failingChecks(healthChecks(getApp()))
});
