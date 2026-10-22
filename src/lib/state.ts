/**
 * The five states a Part can be in, mutually exclusive and in that order of precedence. The state
 * column carries one of these; see ADR-0010 for why the reference's legend could not be borrowed.
 */
export type PartState = 'had' | 'downloading' | 'missing' | 'unmonitored' | 'unreleased';

/**
 * The six states Pacerr colours. `to-be-redone` describes a Release rather than a Part, so it sits
 * alongside any of the five and is named in a badge beside the Release instead of in the column.
 */
export type State = PartState | 'to-be-redone';

export function formatState(state: State): string {
	return {
		had: 'Had',
		downloading: 'Downloading',
		missing: 'Missing, monitored',
		unmonitored: 'Missing, not monitored',
		unreleased: 'Unreleased Part',
		'to-be-redone': 'To Be Redone'
	}[state];
}

export type TransferState = 'downloading' | 'completed' | 'failed' | 'unknown';

/**
 * How a transfer reads in the legend. The Queue lists Releases rather than Parts, so it borrows
 * the treatments and keeps the Download Client's own words for them.
 */
export function transferTreatment(state: TransferState): PartState {
	const treatments: Record<TransferState, PartState> = {
		downloading: 'downloading',
		completed: 'had',
		failed: 'missing',
		unknown: 'unreleased'
	};
	return treatments[state];
}
