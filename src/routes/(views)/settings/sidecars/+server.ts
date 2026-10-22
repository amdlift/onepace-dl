import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** The Sidecar switches moved to the Metadata page, and a bookmark to them still works. */
export const GET: RequestHandler = () => {
	redirect(308, '/settings/metadata');
};
