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
