import { describe, expect, it } from 'vitest';
import { startPacerr } from './harness/pacerr';

const stateLabels = (page: { attributes(selector: string, name: string): (string | null)[] }) =>
	page.attributes('tbody .state-icon svg', 'aria-label');

describe('the state of a Part', () => {
	it('reads an Unreleased Part as not out yet rather than as a gap in the collection', async () => {
		const pacerr = await startPacerr();

		const labels = stateLabels(await pacerr.open('/arcs/egghead'));

		expect(labels).toHaveLength(38);
		expect(labels.slice(22)).toEqual(Array(16).fill('Unreleased Part'));
	});
});
