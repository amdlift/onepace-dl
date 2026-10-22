import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rootBlock, stylesheetsOutsideTheTokenSheet } from './harness/sources';

const measured = JSON.parse(
	readFileSync(new URL('./fixtures/tokens.json', import.meta.url), 'utf8')
) as Record<string, { role: string; value: string }>;

const declaredTokens = (): Record<string, string> =>
	Object.fromEntries(
		[...rootBlock().matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((declaration) => [
			declaration[1] ?? '',
			(declaration[2] ?? '').trim()
		])
	);

const colours =
	/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|color-mix)\(|(?<![\w-])(?:white|black|red|green|blue|gray|grey|silver|orange|yellow|purple|cyan|magenta)(?![\w-])/gi;

const sizedProperties =
	/(?:^|[\s;{])(font-family|font-size|line-height|letter-spacing|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|(?:row-|column-)?gap|border-radius)\s*:\s*([^;}]+)/g;

const keywords = ['0', 'auto', 'inherit', 'initial', 'normal', 'none'];

const lengths = /(?<![\w-])\d*\.?\d+(?:px|rem|em|pt)(?![\w-])/gi;

// A media query is evaluated before custom properties resolve, so its breakpoint cannot be one.
const outsideMediaQueries = (css: string): string => css.replace(/@[a-z-]+[^{;]*/gi, '');

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

	it('measures nothing of its own, whatever it is the property measures', () => {
		const stylesheets = stylesheetsOutsideTheTokenSheet();

		const measurements = stylesheets.flatMap(({ file, css }) =>
			(outsideMediaQueries(css).match(lengths) ?? []).map((literal) => `${file}: ${literal}`)
		);

		expect(rootBlock().match(lengths) ?? []).not.toHaveLength(0);
		expect(measurements).toEqual([]);
	});
});
