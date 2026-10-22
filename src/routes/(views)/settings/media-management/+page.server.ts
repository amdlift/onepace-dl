import { getApp } from '../../../../lib/server/runtime';
import { readNamingTemplate, writeNamingTemplate } from '../../../../lib/server/library/store';
import {
	addRemotePathMapping,
	readRemotePathMappings,
	removeRemotePathMapping
} from '../../../../lib/server/paths/remote-path-mapping';
import { reportPathValidation, validatePaths } from '../../../../lib/server/paths/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = getApp();
	return {
		namingTemplate: readNamingTemplate(app.db),
		remotePathMappings: readRemotePathMappings(app.db),
		library: app.paths.library(),
		libraryMove: app.moves.current(),
		downloads: app.paths.downloads(),
		paths: validatePaths(app.paths.current(), app.downloads.downloadDirectory())
	};
};

export const actions: Actions = {
	saveNamingTemplate: async ({ request }) => {
		const submitted = await request.formData();
		writeNamingTemplate(getApp().db, String(submitted.get('template') ?? ''));
		return { saved: true };
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
	}
};
