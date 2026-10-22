import type { Database } from 'better-sqlite3';
import { isArcsLayout, type ArcsLayout } from '../arcs-layout';
import type { App } from './app';
import { arcArtwork, type ArcArtwork } from './artwork';
import type { ArcListing, CatalogueView } from './catalogue/service';
import type { Resolution } from './catalogue/watch-page';
import { readHadPartCountsByArc } from './library/store';
import { readMonitoredArcs } from './monitoring/store';
import { select } from './selection/selection';

/**
 * Set where every Part of an Arc that Pacerr can cover at all comes out of a Batch Release. That
 * is story 6's whole point: it is the reason such an Arc sits at a lower Resolution than Arcs One
 * Pace has since re-cut Part by Part, and it is only legible from the Arcs view.
 */
export interface BatchOnlyCoverage {
	/** Null where the Batches covering the Arc do not agree on one. */
	resolution: Resolution | null;
}

export interface ArcSummary extends ArcListing {
	artwork: ArcArtwork;
	monitored: boolean;
	hadCount: number;
	batchOnly: BatchOnlyCoverage | null;
}

export interface ArcsView extends Omit<CatalogueView, 'arcs'> {
	arcs: ArcSummary[];
}

export function arcsView(app: App): ArcsView {
	const catalogue = app.catalogue.view();
	const monitored = readMonitoredArcs(app.db);
	const had = readHadPartCountsByArc(app.db);
	const batchOnly = batchOnlyArcs(app.db);
	return {
		...catalogue,
		arcs: catalogue.arcs.map((arc) => ({
			...arc,
			artwork: arcArtwork(app.posters, arc.slug, arc.coverImageUrl),
			monitored: monitored.has(arc.slug),
			hadCount: had.get(arc.slug) ?? 0,
			batchOnly: batchOnly.get(arc.slug) ?? null
		}))
	};
}

export function readArcsLayout(db: Database): ArcsLayout {
	const row = db.prepare('select layout from arcs_layout where id = 1').get() as {
		layout: string;
	};
	return isArcsLayout(row.layout) ? row.layout : 'table';
}

export function writeArcsLayout(db: Database, layout: ArcsLayout): void {
	db.prepare('update arcs_layout set layout = ? where id = 1').run(layout);
}

function batchOnlyArcs(db: Database): Map<string, BatchOnlyCoverage> {
	const selection = select(db);
	const resolutions = new Map<string, Set<Resolution>>();
	const perPart = new Set<string>();

	for (const row of db.prepare('select slug, arc_slug from part').all() as {
		slug: string;
		arc_slug: string;
	}[]) {
		const chosen = selection.parts.get(row.slug);
		if (chosen === undefined || !chosen.chosen) continue;
		if (!chosen.release.batch) {
			perPart.add(row.arc_slug);
			continue;
		}
		const seen = resolutions.get(row.arc_slug) ?? new Set<Resolution>();
		seen.add(chosen.release.resolution);
		resolutions.set(row.arc_slug, seen);
	}

	const batchOnly = new Map<string, BatchOnlyCoverage>();
	for (const [arcSlug, seen] of resolutions) {
		if (perPart.has(arcSlug)) continue;
		batchOnly.set(arcSlug, { resolution: seen.size === 1 ? [...seen][0]! : null });
	}
	return batchOnly;
}
