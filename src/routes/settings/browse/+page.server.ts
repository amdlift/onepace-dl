import { statSync } from 'node:fs';
import { basename } from 'node:path';
import { redirect } from '@sveltejs/kit';
import type { App } from '../../../lib/server/app';
import { readImportSource, writeImportSource } from '../../../lib/server/library/manual-import';
import {
	browsableDirectories,
	parentOf,
	permit,
	type BrowsePolicy
} from '../../../lib/server/paths/browse';
import { getApp } from '../../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

/** The Settings fields a browse can fill in. */
type BrowseTarget = 'library' | 'downloads' | 'importSource';

const subjects: Record<BrowseTarget, string> = {
	library: 'Library',
	downloads: 'download directory',
	importSource: 'Import Source'
};

// Total, like Manual Import's own coercion: a crafted or mistyped value names one of the three
// fields or none, never a fourth thing to write.
const browseTarget = (requested: unknown): BrowseTarget =>
	requested === 'downloads' || requested === 'importSource' ? requested : 'library';

export const load: PageServerLoad = async ({ url }) => {
	const app = getApp();
	const target = browseTarget(url.searchParams.get('for'));
	const policy = app.paths.browsePolicy();
	const asked = url.searchParams.get('at');
	const opened = openable(policy, asked ?? configured(app, target));
	// Only a path the user named earns a complaint: starting at a Library that is not mounted yet
	// is an ordinary first run, and the Directories check already says so.
	const problem = asked === null ? null : opened.problem;
	const directory = opened.path ?? policy.root;
	return {
		target,
		subject: subjects[target],
		directory,
		problem,
		parent: parentOf(policy, directory),
		directories: browsableDirectories(policy, directory).map((path) => ({
			path,
			name: basename(path)
		}))
	};
};

export const actions: Actions = {
	select: async ({ request }) => {
		const submitted = await request.formData();
		const app = getApp();
		const target = browseTarget(submitted.get('for'));
		const policy = app.paths.browsePolicy();
		const wanted = String(submitted.get('at') ?? '').trim();
		const chosen = wanted === '' ? null : permit(policy, wanted);
		if (chosen === null) return { problem: policy.refusal };
		if (target === 'importSource') {
			writeImportSource(app.db, chosen);
			redirect(303, '/settings');
		}
		const outcome = app.paths.configure(target, chosen);
		if (!outcome.ok) return { problem: outcome.problem };
		redirect(303, '/settings');
	}
};

interface Opened {
	path: string | null;
	problem: string | null;
}

function openable(policy: BrowsePolicy, wanted: string | null): Opened {
	if (wanted === null || wanted.trim() === '') return { path: null, problem: null };
	const permitted = permit(policy, wanted.trim());
	if (permitted === null) return { path: null, problem: policy.refusal };
	if (statSync(permitted, { throwIfNoEntry: false })?.isDirectory() !== true)
		return { path: null, problem: `Pacerr found no directory at ${permitted}.` };
	return { path: permitted, problem: null };
}

const configured = (app: App, target: BrowseTarget): string | null =>
	target === 'importSource' ? readImportSource(app.db) : app.paths[target]().path;
