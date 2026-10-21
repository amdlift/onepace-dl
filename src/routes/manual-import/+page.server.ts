import {
	browsableRoot,
	importableFiles,
	manualImport,
	readImportSource,
	readSelectableParts,
	rootDirectory,
	suggestPart,
	type ConfirmedImport
} from '../../lib/server/library/manual-import';
import { getApp } from '../../lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

const partField = 'part:';

export const load: PageServerLoad = async ({ url }) => {
	const app = getApp();
	const root = browsableRoot(url.searchParams.get('root'));
	const directory = rootDirectory(app.db, app.paths.library().path, root);
	const parts = readSelectableParts(app.db);
	const files = directory === null ? [] : importableFiles(directory);
	const requested = url.searchParams.get('part');
	return {
		root,
		directory,
		importSource: readImportSource(app.db),
		parts,
		// Arriving from a Wanted row narrows the page to filling that one gap, which is the only
		// difference between the two ways in.
		fillingPart: parts.find((part) => part.slug === requested) ?? null,
		files: files.map((path) => ({ path, suggestedPartSlug: suggestPart(path, parts) }))
	};
};

export const actions: Actions = {
	import: async ({ request }) => {
		const submitted = await request.formData();
		const app = getApp();
		const root = browsableRoot(submitted.get('root'));
		const library = app.paths.library().path;
		manualImport(
			app.db,
			app.runtime.clock,
			library,
			rootDirectory(app.db, library, root),
			confirmedIn(submitted),
			submitted.get('placing') === 'move' ? 'move' : 'hardlink'
		);
		return { imported: true };
	},

	/** The Wanted row action: one Part, and the one file the user picked for it. */
	importOne: async ({ request }) => {
		const submitted = await request.formData();
		const app = getApp();
		const root = browsableRoot(submitted.get('root'));
		const path = String(submitted.get('file') ?? '');
		const partSlug = String(submitted.get('part') ?? '');
		const library = app.paths.library().path;
		manualImport(
			app.db,
			app.runtime.clock,
			library,
			rootDirectory(app.db, library, root),
			path === '' || partSlug === '' ? [] : [{ path, partSlug }],
			submitted.get('placing') === 'move' ? 'move' : 'hardlink'
		);
		return { imported: true };
	}
};

function confirmedIn(submitted: FormData): ConfirmedImport[] {
	const confirmed: ConfirmedImport[] = [];
	for (const [field, value] of submitted.entries()) {
		if (!field.startsWith(partField)) continue;
		const partSlug = String(value);
		// An empty field is the user declining to place that file, which is the whole point of
		// leaving a low-confidence suggestion blank.
		if (partSlug === '') continue;
		confirmed.push({ path: field.slice(partField.length), partSlug });
	}
	return confirmed;
}
