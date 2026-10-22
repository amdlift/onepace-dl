/**
 * The six states Pacerr colours. Five describe a Part and are mutually exclusive; `to-be-redone`
 * describes a Release, which is why it can sit alongside any of the other five. The reference's
 * legend could not be borrowed for either group — see ADR-0010.
 */
export type State = 'had' | 'downloading' | 'missing' | 'unmonitored' | 'unreleased' | 'to-be-redone';

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

/** What the Download Client says about a transfer. Unknown while it is not saying. */
export type TransferState = 'downloading' | 'completed' | 'failed' | 'unknown';

/**
 * How a transfer reads in the legend. The Queue lists Releases rather than Parts, so it borrows
 * the treatments and keeps the Download Client's own words for them.
 */
export function transferTreatment(state: TransferState): State {
	const treatments: Record<TransferState, State> = {
		downloading: 'downloading',
		completed: 'had',
		failed: 'missing',
		unknown: 'unreleased'
	};
	return treatments[state];
}
