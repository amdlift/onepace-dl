import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import type { Database } from 'better-sqlite3';
import { formatCoverage } from '../../format';
import { readPartDescription, type StoredPartDescription } from '../catalogue/store';
import type { Coverage } from '../catalogue/watch-page';

/**
 * Sidecars are the Library edge, so this is one of the few places `episode` is a media server's
 * word rather than One Piece's. A document names the element a media server looks for; where it
 * goes is the caller's to say, because that follows the rendered path of the file it describes.
 */
export type SidecarKind = 'episode';

export interface SidecarDocument {
	kind: SidecarKind;
	title: string;
	plot: string | null;
}

const rootElement: Record<SidecarKind, string> = { episode: 'episodedetails' };

/** Writes one document into the Library at a path relative to its root. */
export function writeSidecar(
	library: string,
	sidecarPath: string,
	document: SidecarDocument
): void {
	const destination = join(library, sidecarPath);
	mkdirSync(dirname(destination), { recursive: true });
	writeFileSync(destination, render(document));
}

/** Where the Sidecar describing the file at one Library path lives. */
export const sidecarPathFor = (libraryPath: string): string =>
	`${libraryPath.slice(0, libraryPath.length - extname(libraryPath).length)}.nfo`;

/** Describes the Part whose file has just landed at `libraryPath`, beside that file. */
export function writeEpisodeSidecar(
	db: Database,
	library: string,
	partSlug: string,
	libraryPath: string
): void {
	const part = readPartDescription(db, partSlug);
	if (part === null) return;
	writeSidecar(library, sidecarPathFor(libraryPath), {
		kind: 'episode',
		title: part.title,
		plot: plotOf(part)
	});
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
