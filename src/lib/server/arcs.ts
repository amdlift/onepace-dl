import type { App } from './app';
import type { ArcListing, CatalogueView } from './catalogue/service';
import { readHadPartCountsByArc } from './library/store';

export interface ArcSummary extends ArcListing {
	monitored: boolean;
	hadCount: number;
}

export interface ArcsView extends Omit<CatalogueView, 'arcs'> {
	arcs: ArcSummary[];
}

export function arcsView(app: App): ArcsView {
	const catalogue = app.catalogue.view();
	const monitored = app.monitoring.monitoredArcs();
	const had = readHadPartCountsByArc(app.db);
	return {
		...catalogue,
		arcs: catalogue.arcs.map((arc) => ({
			...arc,
			monitored: monitored.has(arc.slug),
			hadCount: had.get(arc.slug) ?? 0
		}))
	};
}
