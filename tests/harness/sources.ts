import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceDirectory = fileURLToPath(new URL('../../src', import.meta.url));

export const tokenSheet = join(sourceDirectory, 'app.css');

export function everyFileUnder(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? everyFileUnder(join(directory, entry.name))
			: [join(directory, entry.name)]
	);
}

/** Every file the interface is styled from, read off the checked-in tree. */
export const everyStyledSource = (): { file: string; contents: string }[] =>
	everyFileUnder(sourceDirectory)
		.filter((file) => file.endsWith('.css') || file.endsWith('.svelte'))
		.map((file) => ({ file, contents: readFileSync(file, 'utf8') }));

/** The token declarations themselves: everything up to the end of the first rule in the sheet. */
export const rootBlock = (): string => {
	const sheet = readFileSync(tokenSheet, 'utf8');
	return sheet.slice(sheet.indexOf('{') + 1, sheet.indexOf('}'));
};

/** Every rule the interface is styled with, with the token declarations themselves removed. */
export const stylesheetsOutsideTheTokenSheet = (): { file: string; css: string }[] =>
	everyStyledSource()
		.map(({ file, contents }) => ({
			file,
			css:
				file === tokenSheet
					? contents.replace(rootBlock(), '')
					: [...contents.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n')
		}))
		.filter(({ css }) => css.trim() !== '');

/** What one selector declares, in the token sheet unless another file is named. */
export function declarationsFor(selector: string, file = tokenSheet): Record<string, string> {
	const rule = readFileSync(file, 'utf8')
		.split('}')
		.map((block) => block.split('{'))
		.find(([heading, body]) => body !== undefined && heading?.trim() === selector);

	return Object.fromEntries(
		[...(rule?.[1] ?? '').matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
			declaration[1] ?? '',
			(declaration[2] ?? '').trim()
		])
	);
}
