import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceDirectory = fileURLToPath(new URL('../src', import.meta.url));
const tokenSheet = join(sourceDirectory, 'app.css');

const measured = JSON.parse(
	readFileSync(new URL('./fixtures/tokens.json', import.meta.url), 'utf8')
) as Record<string, { role: string; value: string }>;

const rootBlock = (): string => {
	const sheet = readFileSync(tokenSheet, 'utf8');
	return sheet.slice(sheet.indexOf('{') + 1, sheet.indexOf('}'));
};

const declaredTokens = (): Record<string, string> =>
	Object.fromEntries(
		[...rootBlock().matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
			declaration[1] ?? '',
			(declaration[2] ?? '').trim()
		])
	);

function everyFileUnder(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? everyFileUnder(join(directory, entry.name))
			: [join(directory, entry.name)]
	);
}

/** Every rule the application styles itself with, with the token declarations themselves removed. */
function stylesheetsOutsideTheTokenSheet(): { file: string; css: string }[] {
	return everyFileUnder(sourceDirectory)
		.filter((file) => file.endsWith('.css') || file.endsWith('.svelte'))
		.map((file) => {
			const contents = readFileSync(file, 'utf8');
			if (file === tokenSheet) return { file, css: contents.replace(rootBlock(), '') };
			const styles = [...contents.matchAll(/<style>([\s\S]*?)<\/style>/g)];
			return { file, css: styles.map(([, css]) => css).join('\n') };
		})
		.filter(({ css }) => css.trim() !== '');
}

const colours =
	/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|color-mix)\(|(?<![\w-])(?:white|black|red|green|blue|gray|grey|silver|orange|yellow|purple|cyan|magenta)(?![\w-])/gi;

const sizedProperties =
	/(?:^|[\s;{])(font-family|font-size|line-height|letter-spacing|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|(?:row-|column-)?gap|border-radius)\s*:\s*([^;}]+)/g;

const keywords = ['0', 'auto', 'inherit', 'initial', 'normal', 'none'];

describe('the token sheet', () => {
	it('declares every token at the measured value, and declares nothing else', () => {
		const reference = Object.fromEntries(
			Object.entries(measured).map(([token, { value }]) => [token, value])
		);

		expect(declaredTokens()).toEqual(reference);
	});
});

describe('a stylesheet outside the token sheet', () => {
	it('names no colour of its own', () => {
		const stylesheets = stylesheetsOutsideTheTokenSheet();

		const hardcoded = stylesheets.flatMap(({ file, css }) =>
			(css.match(colours) ?? []).map((literal) => `${file}: ${literal}`)
		);

		expect(rootBlock().match(colours) ?? []).not.toHaveLength(0);
		expect(stylesheets.length).toBeGreaterThan(1);
		expect(hardcoded).toEqual([]);
	});

	it('names no size, spacing or typeface of its own', () => {
		const stylesheets = stylesheetsOutsideTheTokenSheet();

		const hardcoded = stylesheets.flatMap(({ file, css }) =>
			[...css.matchAll(sizedProperties)]
				.map((declaration) => ({
					property: declaration[1] ?? '',
					value: (declaration[2] ?? '').trim()
				}))
				.filter(({ value }) =>
					value.split(/\s+/).some((part) => !part.startsWith('var(') && !keywords.includes(part))
				)
				.map(({ property, value }) => `${file}: ${property}: ${value}`)
		);

		expect(stylesheets.length).toBeGreaterThan(1);
		expect(hardcoded).toEqual([]);
	});
});
