import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceDirectory = fileURLToPath(new URL('../src', import.meta.url));

function everyFileUnder(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? everyFileUnder(join(directory, entry.name))
			: [join(directory, entry.name)]
	);
}

/** Every file that styles a table or renders one, read off the checked-in tree. */
function everyStyledSource(): { file: string; contents: string }[] {
	return everyFileUnder(sourceDirectory)
		.filter((file) => file.endsWith('.css') || file.endsWith('.svelte'))
		.map((file) => ({ file, contents: readFileSync(file, 'utf8') }));
}

const occurrences = (pattern: RegExp): string[] =>
	everyStyledSource().flatMap(({ file, contents }) =>
		[...contents.matchAll(pattern)].map(() => file)
	);

describe('a table column', () => {
	it('is never right-aligned', () => {
		expect(occurrences(/text-align:\s*left/g)).not.toHaveLength(0);
		expect(occurrences(/text-align:\s*right/g)).toEqual([]);
	});

	it('has no right-aligning class left to reach for', () => {
		expect(occurrences(/\bnumeric\b/g)).toEqual([]);
	});
});

const tokenSheet = join(sourceDirectory, 'app.css');

function declarationsFor(selector: string): Record<string, string> {
	const rule = readFileSync(tokenSheet, 'utf8')
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

describe('a table row', () => {
	it('is the height the reference gives a row, with its cell padding', () => {
		expect(declarationsFor('.table td')).toMatchObject({
			height: 'var(--row-height)',
			padding: 'var(--cell-padding)'
		});
	});

	it('is separated from the row above it by a hairline along its top', () => {
		expect(declarationsFor('.table tbody tr')).toMatchObject({
			'border-top': 'var(--hairline) solid var(--border)'
		});
	});

	it('draws no rule of its own underneath', () => {
		expect(declarationsFor('.table td')['border-bottom']).toBeUndefined();
		expect(declarationsFor('.table th')['border-bottom']).toBeUndefined();
	});

	it('lifts under the pointer', () => {
		expect(declarationsFor('.table tbody tr:hover')).toMatchObject({
			background: 'var(--surface-hover)'
		});
	});
});
