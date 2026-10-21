import { redirect } from '@sveltejs/kit';
import { forgetSession, rememberSession, sessionCookie } from '../../../lib/server/auth/cookie';
import { getApp } from '../../../lib/server/runtime';
import { readNamingTemplate, writeNamingTemplate } from '../../../lib/server/library/store';
import { readImportSource, writeImportSource } from '../../../lib/server/library/manual-import';
import {
	addRemotePathMapping,
	readRemotePathMappings,
	removeRemotePathMapping
} from '../../../lib/server/paths/remote-path-mapping';
import { reportPathValidation, validatePaths } from '../../../lib/server/paths/validation';
import { readProfile, writeProfile, type Profile } from '../../../lib/server/selection/profile';
import type { Resolution, Variant } from '../../../lib/server/catalogue/watch-page';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const app = getApp();
	return {
		authentication: locals.authentication,
		profile: readProfile(app.db),
		namingTemplate: readNamingTemplate(app.db),
		importSource: readImportSource(app.db),
		downloadClient: app.downloads.connection(),
		connection: app.downloads.health(),
		remotePathMappings: readRemotePathMappings(app.db),
		library: app.paths.library(),
		libraryMove: app.moves.current(),
		downloads: app.paths.downloads(),
		paths: validatePaths(app.paths.current(), app.downloads.downloadDirectory())
	};
};

export const actions: Actions = {
	saveDownloadClient: async ({ request }) => {
		const submitted = await request.formData();
		const app = getApp();
		app.downloads.configure({
			url: String(submitted.get('url') ?? '').trim(),
			username: String(submitted.get('username') ?? '').trim(),
			password: String(submitted.get('password') ?? '')
		});
		// Pointing Pacerr at a Download Client is the moment story 65's validation has something new
		// to say, because only the client knows where it will put the files.
		await app.downloads.test();
		await app.acquisition.run();
		return { saved: true };
	},

	testDownloadClient: async () => {
		await getApp().downloads.test();
		return { tested: true };
	},

	saveLibrary: async ({ request }) => {
		const submitted = await request.formData();
		const outcome = getApp().moves.relocate(String(submitted.get('library') ?? ''));
		if (outcome.problem !== null) return { libraryProblem: outcome.problem };
		return { saved: true };
	},

	startLibraryMove: async () => {
		getApp().moves.start();
		return { saved: true };
	},

	dismissLibraryMove: async () => {
		getApp().moves.dismiss();
		return { saved: true };
	},

	saveDownloads: async ({ request }) => {
		const submitted = await request.formData();
		const app = getApp();
		const outcome = app.paths.configure('downloads', String(submitted.get('downloads') ?? ''));
		// Only the Download Client knows where it actually writes, so re-asking is what turns a new
		// download directory into an answer about the path imports will really read.
		await app.downloads.test();
		if (outcome.problem !== null) return { downloadsProblem: outcome.problem };
		return { saved: true };
	},

	testPaths: async () => {
		const app = getApp();
		await app.downloads.test();
		reportPathValidation(validatePaths(app.paths.current(), app.downloads.downloadDirectory()));
		return { tested: true };
	},

	addRemotePathMapping: async ({ request }) => {
		const submitted = await request.formData();
		const remotePath = String(submitted.get('remotePath') ?? '').trim();
		const localPath = String(submitted.get('localPath') ?? '').trim();
		if (remotePath === '' || localPath === '')
			return { mappingProblem: 'A Remote Path Mapping needs both paths.' };
		const app = getApp();
		addRemotePathMapping(app.db, remotePath, localPath);
		await app.imports.run();
		return { saved: true };
	},

	removeRemotePathMapping: async ({ request }) => {
		const submitted = await request.formData();
		removeRemotePathMapping(getApp().db, Number(submitted.get('id')));
		return { saved: true };
	},

	saveProfile: async ({ request }) => {
		const submitted = await request.formData();
		const profile = profileFrom(submitted);
		if (profile === null) return { profileProblem: 'Choose at least one Resolution.' };
		const app = getApp();
		writeProfile(app.db, profile);
		await app.acquisition.run();
		return { saved: true };
	},

	saveNamingTemplate: async ({ request }) => {
		const submitted = await request.formData();
		writeNamingTemplate(getApp().db, String(submitted.get('template') ?? ''));
		return { saved: true };
	},

	saveImportSource: async ({ request }) => {
		const submitted = await request.formData();
		writeImportSource(getApp().db, String(submitted.get('importSource') ?? ''));
		return { saved: true };
	},

	saveAuthentication: async ({ request, cookies, url, locals }) => {
		const submitted = await request.formData();
		const authentication = getApp().authentication;
		const outcome = await authentication.configure({
			enabled: submitted.get('enabled') !== null,
			username: String(submitted.get('username') ?? ''),
			password: String(submitted.get('password') ?? '')
		});
		if (!outcome.ok) return { problem: outcome.problem };

		// Turning a login on from an unauthenticated session would otherwise lock the person who
		// just turned it on straight out of the page they are looking at.
		if (authentication.state().enabled && !locals.authentication.signedIn) {
			rememberSession(cookies, url, authentication.startSession());
		}
		return { saved: true };
	},

	logOut: async ({ cookies, url }) => {
		const sessionId = cookies.get(sessionCookie);
		if (sessionId !== undefined) getApp().authentication.endSession(sessionId);
		forgetSession(cookies, url);
		redirect(303, '/');
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
