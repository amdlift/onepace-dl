export type ArcsLayout = 'poster' | 'overview' | 'table';

export const arcsLayouts: ArcsLayout[] = ['poster', 'overview', 'table'];

export function formatArcsLayout(layout: ArcsLayout): string {
	return { poster: 'Poster', overview: 'Overview', table: 'Table' }[layout];
}

export function isArcsLayout(value: unknown): value is ArcsLayout {
	return arcsLayouts.some((layout) => layout === value);
}
