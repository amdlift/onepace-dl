import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tokenSheet = fileURLToPath(new URL('../src/app.css', import.meta.url));

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

describe('a setting', () => {
	it('is a row of the label column, gutter and control column the reference measures', () => {
		expect(declarationsFor('.setting')).toMatchObject({
			'grid-template-columns': 'var(--label-width) var(--control-width)',
			gap: 'var(--label-gutter)'
		});
	});

	it('right-aligns its label against the gutter without a table alignment', () => {
		expect(declarationsFor('.setting > .label')).toMatchObject({ 'justify-self': 'end' });
	});

	it('gives the control column the whole of its width', () => {
		expect(declarationsFor('.setting > .control')).toMatchObject({ 'grid-column': '2' });
	});

	it('dims its help text to the help colour', () => {
		expect(declarationsFor('.help')).toMatchObject({ color: 'var(--ink-dim)' });
	});
});
