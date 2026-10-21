/**
 * The three ways the Arcs view can be looked at. Choosing one costs no information: each states
 * how many of an Arc's Parts are had, and differs only in how much artwork it gives the Arc.
 */
export type ArcsLayout = 'poster' | 'overview' | 'table';

export const arcsLayouts: ArcsLayout[] = ['poster', 'overview', 'table'];

export function formatArcsLayout(layout: ArcsLayout): string {
	return { poster: 'Poster', overview: 'Overview', table: 'Table' }[layout];
}

export function isArcsLayout(value: unknown): value is ArcsLayout {
	return arcsLayouts.some((layout) => layout === value);
}
