import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import { formatCoverage } from '../../format';
import type { Posters } from '../artwork';
import {
	readArcDescription,
	readPartDescription,
	type StoredArcDescription,
	type StoredPartDescription
} from '../catalogue/store';
import type { Coverage } from '../catalogue/watch-page';
import { showTitle } from './naming';
import { readHadParts, type HadPart } from './store';

/**
 * What one Sidecar is about, in Pacerr's words: the show, an Arc, a Part. The element a media
 * server reads is a media server's word for the same thing and is settled below; where the file
 * goes is the caller's to say, because that follows the rendered path of the media.
 */
export type SidecarKind = 'show' | 'arc' | 'part';

export interface SidecarDocument {
	kind: SidecarKind;
	title: string;
	plot: string | null;
}

// Sidecar contents are the Library edge, so this is where an Arc becomes a season and a Part an
// episode: these are the element names a media server looks for and nothing else parses.
const rootElement: Record<SidecarKind, string> = {
	show: 'tvshow',
	arc: 'season',
	part: 'episodedetails'
};

/**
 * The kinds of Sidecar a user can switch off, which is every kind there is. A Poster is a Sidecar
 * too, so it carries a switch alongside the three NFO documents.
 */
export type SidecarSwitch = 'showNfo' | 'arcNfo' | 'partNfo' | 'arcPoster';

export type SidecarSwitches = Record<SidecarSwitch, boolean>;

interface SidecarRow {
	show_nfo: number;
	arc_nfo: number;
	part_nfo: number;
	arc_poster: number;
}

export function readSidecarSwitches(db: Database): SidecarSwitches {
	const row = db
		.prepare('select show_nfo, arc_nfo, part_nfo, arc_poster from sidecar where id = 1')
		.get() as SidecarRow;
	return {
		showNfo: row.show_nfo === 1,
		arcNfo: row.arc_nfo === 1,
		partNfo: row.part_nfo === 1,
		arcPoster: row.arc_poster === 1
	};
}

export function writeSidecarSwitches(db: Database, switches: SidecarSwitches): void {
	db.prepare(
		'update sidecar set show_nfo = ?, arc_nfo = ?, part_nfo = ?, arc_poster = ? ' +
			'where id = 1'
	).run(
		flag(switches.showNfo),
		flag(switches.arcNfo),
		flag(switches.partNfo),
		flag(switches.arcPoster)
	);
}

const flag = (value: boolean): number => (value ? 1 : 0);

/**
 * Asked inside each write rather than at its call sites, so that every path into the Library — an
 * import, a Manual Import, a refresh after a Catalogue scrape — is governed by the switch without
 * each having to remember to ask.
 */
const writes = (db: Database, kind: SidecarSwitch): boolean => readSidecarSwitches(db)[kind];

/** Writes one document into the Library, unless what is there already says exactly that. */
export function writeSidecar(
	library: string,
	sidecarPath: string,
	document: SidecarDocument
): void {
	const destination = join(library, sidecarPath);
	const rendered = render(document);
	if (alreadySays(destination, rendered)) return;
	mkdirSync(dirname(destination), { recursive: true });
	writeFileSync(destination, rendered);
}

// Every Sidecar is offered again after every clean scrape, so rewriting one whose content has not
// moved would restamp most of the Library for a correction to a single description.
const alreadySays = (destination: string, rendered: string): boolean =>
	existsSync(destination) && readFileSync(destination, 'utf8') === rendered;

/**
 * Offers every Sidecar again from the Catalogue as it now stands, so a description One Pace
 * corrected reaches the Library instead of going stale in it. Only a Part Pacerr holds a file for
 * is described, and the show only once the Library holds one, so a correction upstream never
 * conjures a season of metadata and no video.
 */
export function refreshSidecars(db: Database, library: string): void {
	const had = [...readHadParts(db).values()];
	// A Part a half-finished move has left behind is described in the Library still holding it,
	// so a correction upstream never files metadata into one the media has not reached.
	const rootOf = (part: HadPart): string => part.libraryRoot ?? library;
	for (const root of new Set(had.map(rootOf))) writeShowSidecar(db, root);
	for (const part of had) {
		writeArcSidecar(db, rootOf(part), part.arcSlug, part.libraryPath);
		writePartSidecar(db, rootOf(part), part.partSlug, part.libraryPath);
	}
}

/** Where the Sidecar describing the file at one Library path lives. */
export const sidecarPathFor = (libraryPath: string): string =>
	`${libraryPath.slice(0, libraryPath.length - extname(libraryPath).length)}.nfo`;

/**
 * The Sidecars describing the season directory a file at one Library path sits in and the show
 * the Library holds, which every Part filed beside it shares rather than owns. Derived from the
 * rendered path, so a naming template of the user's own keeps them with the media either way.
 */
export const sharedSidecarPaths = (libraryPath: string): string[] => [
	join(dirname(libraryPath), 'season.nfo'),
	join(dirname(libraryPath), 'cover.jpg'),
	'tvshow.nfo'
];

/** Describes the one show the Library holds, at its root, where a media server looks for it. */
export function writeShowSidecar(db: Database, library: string): void {
	if (!writes(db, 'showNfo')) return;
	writeSidecar(library, 'tvshow.nfo', {
		kind: 'show',
		title: showTitle,
		plot: showDescription
	});
}

// One Pace's own account of itself, because nothing in the Catalogue describes the project, only
// the Arcs and Parts within it.
const showDescription =
	'One Pace is a fan project that recuts the One Piece anime in an endeavor to bring it more ' +
	'in line with the pacing of the original manga by Eiichiro Oda. The team accomplishes this ' +
	'by removing filler scenes not present in the source material, fixing animation errors, and ' +
	'correcting subtitles.';

/** Describes the Arc a Part belongs to, in the season directory that Part's file landed in. */
export function writeArcSidecar(
	db: Database,
	library: string,
	arcSlug: string,
	libraryPath: string
): void {
	if (!writes(db, 'arcNfo')) return;
	const arc = readArcDescription(db, arcSlug);
	if (arc === null) return;
	writeSidecar(library, join(dirname(libraryPath), 'season.nfo'), describing(arc));
}

// Every special shares one season, so naming that season after an Arc would retitle the whole of
// it after whichever special was imported last. ADR-0008 settles that against #29's criterion.
const describing = (arc: StoredArcDescription): SidecarDocument =>
	arc.special
		? { kind: 'arc', title: 'Specials', plot: null }
		: { kind: 'arc', title: arc.title, plot: arc.description };

/** Describes the Part whose file has just landed at `libraryPath`, beside that file. */
export function writePartSidecar(
	db: Database,
	library: string,
	partSlug: string,
	libraryPath: string
): void {
	if (!writes(db, 'partNfo')) return;
	const part = readPartDescription(db, partSlug);
	if (part === null) return;
	writeSidecar(library, sidecarPathFor(libraryPath), {
		kind: 'part',
		title: part.title,
		plot: plotOf(part)
	});
}

/**
 * The Arc's Poster, written beside the Part that has just landed rather than into the directory
 * the season index names, so a user-supplied template cannot file a Part in one directory and the
 * artwork for it in another. Nothing is written for an Arc Pacerr has no Poster for, and nothing
 * is written at all until a Part is there to be shown, so a media server is never offered a season
 * of artwork and no video.
 */
export function writeArcPoster(
	db: Database,
	posters: Posters,
	library: string,
	libraryPath: string,
	arcSlug: string
): void {
	if (!writes(db, 'arcPoster')) return;
	const poster = posters.library(arcSlug);
	if (poster === null) return;
	copyFileSync(poster.path, join(library, dirname(libraryPath), 'cover.jpg'));
}

/**
 * Coverage goes in the plot rather than in elements of its own, because a media server displays
 * the plot and silently drops any element it does not recognise — and Coverage is the one thing
 * about a Part no metadata provider could ever supply.
 */
function plotOf(part: StoredPartDescription): string | null {
	const covered = [
		covering('Manga chapters', part.chapters),
		covering('Anime episodes', part.episodes)
	].filter((line) => line !== null);
	const paragraphs = [part.description, covered.length === 0 ? null : covered.join('\n')].filter(
		(paragraph) => paragraph !== null
	);
	return paragraphs.length === 0 ? null : paragraphs.join('\n\n');
}

const covering = (label: string, coverage: Coverage | null): string | null => {
	const formatted = formatCoverage(coverage);
	return formatted === null ? null : `${label} ${formatted}`;
};

function render(document: SidecarDocument): string {
	const root = rootElement[document.kind];
	const lines = [
		'<?xml version="1.0" encoding="utf-8" standalone="yes"?>',
		`<${root}>`,
		`\t<title>${escaped(document.title)}</title>`
	];
	if (document.plot !== null) lines.push(`\t<plot>${escaped(document.plot)}</plot>`);
	lines.push(`</${root}>`);
	return `${lines.join('\n')}\n`;
}

// A description is free text from someone else's website, and an unescaped angle bracket in it
// would leave a media server reading a document that does not parse.
const escaped = (value: string): string =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
