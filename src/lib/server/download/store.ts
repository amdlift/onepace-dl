import type { Database } from 'better-sqlite3';
import type { DownloadSource } from './client';

/** A Release Pacerr has handed over, and the Parts it was handed over for. */
export interface Grab {
	infohash: string;
	releaseTitle: string;
	batch: boolean;
	grabbedAt: Date;
	partSlugs: string[];
	partTitles: string[];
}

interface GrabRow {
	infohash: string;
	release_title: string;
	batch: number;
	grabbed_at: string;
	part_slugs: string | null;
	part_titles: string | null;
}

export function readGrabbedInfohashes(db: Database): Set<string> {
	const rows = db.prepare('select infohash from grab').all() as { infohash: string }[];
	return new Set(rows.map((row) => row.infohash));
}

export function readGrabs(db: Database): Grab[] {
	const rows = db
		.prepare(
			`select g.infohash, g.release_title, g.batch, g.grabbed_at,
				group_concat(gp.part_slug, char(10)) as part_slugs,
				group_concat(coalesce(part.title, gp.part_slug), char(10)) as part_titles
			from grab g
			left join grab_part gp on gp.infohash = g.infohash
			left join part on part.slug = gp.part_slug
			group by g.infohash
			order by g.grabbed_at desc, g.infohash`
		)
		.all() as GrabRow[];
	return rows.map((row) => ({
		infohash: row.infohash,
		releaseTitle: row.release_title,
		batch: row.batch === 1,
		grabbedAt: new Date(row.grabbed_at),
		partSlugs: lines(row.part_slugs),
		partTitles: lines(row.part_titles)
	}));
}

export function recordGrab(
	db: Database,
	grab: { infohash: string; releaseTitle: string; batch: boolean; partSlugs: string[] },
	at: Date
): void {
	db.transaction(() => {
		db.prepare(
			'insert or replace into grab (infohash, release_title, batch, grabbed_at) values (?, ?, ?, ?)'
		).run(grab.infohash, grab.releaseTitle, grab.batch ? 1 : 0, at.toISOString());
		const insert = db.prepare(
			'insert or ignore into grab_part (infohash, part_slug) values (?, ?)'
		);
		for (const partSlug of grab.partSlugs) insert.run(grab.infohash, partSlug);
	})();
}

/** Claims a Part against a Release already handed over, so the importer files it too. */
export function linkGrabToPart(db: Database, infohash: string, partSlug: string): void {
	db.prepare('insert or ignore into grab_part (infohash, part_slug) values (?, ?)').run(
		infohash,
		partSlug
	);
}

/** Where each Release can be downloaded from. The feed carries neither for its oldest items. */
export function readReleaseSources(db: Database): Map<string, DownloadSource> {
	const rows = db.prepare('select infohash, magnet_uri, torrent_url from feed_release').all() as {
		infohash: string;
		magnet_uri: string | null;
		torrent_url: string | null;
	}[];
	const sources = new Map<string, DownloadSource>();
	for (const row of rows) {
		if (row.magnet_uri !== null) sources.set(row.infohash, { magnetUri: row.magnet_uri });
		else if (row.torrent_url !== null) sources.set(row.infohash, { torrentUrl: row.torrent_url });
	}
	return sources;
}

/** The Parts a monitored Arc still wants: not marked unwanted, and not already had. */
export function readWantedPartTitles(db: Database): Map<string, string> {
	const rows = db
		.prepare(
			`select part.slug, part.title
			from part
			join monitored_arc on monitored_arc.arc_slug = part.arc_slug
			where part.slug not in (select part_slug from not_wanted_part)
				and part.slug not in (select part_slug from had_part)`
		)
		.all() as { slug: string; title: string }[];
	return new Map(rows.map((row) => [row.slug, row.title]));
}

const lines = (value: string | null): string[] => (value === null ? [] : value.split('\n'));
