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
