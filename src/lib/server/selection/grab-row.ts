import type { PartSelection } from './selection';

/** What Pacerr would grab for one Part, as a row states it. */
export type GrabRow =
	| {
			chosen: true;
			title: string;
			resolution: number;
			variant: 'regular' | 'extended' | 'alternate';
			batch: boolean;
			neededPartCount: number;
			coveredPartCount: number;
			belowCutoff: boolean;
	  }
	| { chosen: false; reason: string };

export function grabRow(selected: PartSelection | undefined): GrabRow {
	if (selected === undefined || !selected.chosen)
		return { chosen: false, reason: selected?.reason ?? 'No Release covers this Part' };
	return {
		chosen: true,
		title: selected.release.title,
		resolution: selected.release.resolution,
		variant: selected.release.variant,
		batch: selected.release.batch,
		neededPartCount: selected.release.neededParts.length,
		coveredPartCount: selected.release.coveredParts.length,
		belowCutoff: selected.belowCutoff
	};
}
