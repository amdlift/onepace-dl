export type CoverageTerm = { from: number; to: number } | { text: string };

export interface Coverage {
	terms: CoverageTerm[];
	coverStories: boolean;
}

export interface Part {
	slug: string;
	arcSlug: string;
	number: number;
	title: string;
	description: string | null;
	chapters: Coverage | null;
	episodes: Coverage | null;
	toBeRedone: boolean;
}

export interface UnreleasedPart {
	arcSlug: string;
	number: number;
}

export interface Arc {
	slug: string;
	title: string;
	description: string | null;
	special: boolean;
	unfinished: boolean;
	chapters: Coverage | null;
	episodes: Coverage | null;
	coverImageUrl: string | null;
	parts: Part[];
	unreleasedParts: UnreleasedPart[];
}

export type Resolution = 480 | 720 | 1080;

export type Variant = 'regular' | 'extended' | 'alternate';

export interface BatchScope {
	complete: boolean;
	partCount: number;
	partRange: string | null;
}

export interface CatalogueRelease {
	infohash: string;
	arcSlug: string;
	partSlugs: string[];
	resolution: Resolution;
	variant: Variant;
	sizeLabel: string | null;
	batchScope: BatchScope | null;
}

export interface Catalogue {
	arcs: Arc[];
	releases: CatalogueRelease[];
}

export class WatchPageParseError extends Error {
	constructor(reason: string) {
		super(`the One Pace watch page did not parse: ${reason}`);
		this.name = 'WatchPageParseError';
	}
}

export function parseCatalogue(html: string): Catalogue {
	const timeline = findTimeline(readFlightRows(html));
	const segments = readList(timeline.segments, 'segments');
	if (segments.length === 0) throw new WatchPageParseError('the Catalogue lists no Arcs');

	const releases: ReleaseIndex = new Map();
	const arcs = segments.map((segment, index) => readArc(segment, `segments[${index}]`, releases));
	return { arcs, releases: [...releases.values()] };
}

type ReleaseIndex = Map<string, CatalogueRelease>;

function readArc(value: unknown, where: string, releases: ReleaseIndex): Arc {
	const segment = readObject(value, where);
	const slug = readText(segment.slug, `${where}.slug`);
	const backdrops = readList(segment.backdrops, `${where}.backdrops`);

	for (const [index, download] of readList(segment.downloads, `${where}.downloads`).entries()) {
		recordRelease(download, `${where}.downloads[${index}]`, slug, null, releases);
	}

	return {
		slug,
		title: readText(segment.title, `${where}.title`),
		description: readOptional(segment.description, `${where}.description`, readText),
		special: readFlag(segment.special, `${where}.special`),
		unfinished: readFlag(segment.unfinished, `${where}.unfinished`),
		chapters: readOptional(segment.chapters, `${where}.chapters`, readCoverage),
		episodes: readOptional(segment.episodes, `${where}.episodes`, readCoverage),
		coverImageUrl:
			backdrops.length === 0
				? null
				: readText(
						readObject(backdrops[0], `${where}.backdrops[0]`).src,
						`${where}.backdrops[0].src`
					),
		parts: readList(segment.parts, `${where}.parts`).map((part, index) =>
			readPart(part, `${where}.parts[${index}]`, slug, releases)
		),
		unreleasedParts: readList(segment.unreleasedParts, `${where}.unreleasedParts`).map(
			(unreleased, index) => ({
				arcSlug: slug,
				number: readNumber(
					readObject(unreleased, `${where}.unreleasedParts[${index}]`).part,
					`${where}.unreleasedParts[${index}].part`
				)
			})
		)
	};
}

function readPart(value: unknown, where: string, arcSlug: string, releases: ReleaseIndex): Part {
	const part = readObject(value, where);
	const slug = readText(part.slug, `${where}.slug`);

	for (const [index, download] of readList(part.downloads, `${where}.downloads`).entries()) {
		recordRelease(download, `${where}.downloads[${index}]`, arcSlug, slug, releases);
	}

	return {
		slug,
		arcSlug,
		number: readNumber(part.part, `${where}.part`),
		title: readText(part.title, `${where}.title`),
		description: readOptional(part.description, `${where}.description`, readText),
		chapters: readOptional(part.chapters, `${where}.chapters`, readCoverage),
		episodes: readOptional(part.episodes, `${where}.episodes`, readCoverage),
		toBeRedone: readFlag(part.toBeRedone, `${where}.toBeRedone`)
	};
}

function readCoverage(value: unknown, where: string): Coverage {
	const coverage = readObject(value, where);
	return {
		terms: readList(coverage.terms, `${where}.terms`).map((term, index) =>
			readCoverageTerm(term, `${where}.terms[${index}]`)
		),
		coverStories: readFlag(coverage.coverStories, `${where}.coverStories`)
	};
}

function readCoverageTerm(value: unknown, where: string): CoverageTerm {
	const term = readObject(value, where);
	if (term.text !== undefined) return { text: readText(term.text, `${where}.text`) };
	return { from: readNumber(term.from, `${where}.from`), to: readNumber(term.to, `${where}.to`) };
}

function recordRelease(
	value: unknown,
	where: string,
	arcSlug: string,
	partSlug: string | null,
	releases: ReleaseIndex
): void {
	const download = readObject(value, where);
	const ownInfohash =
		infohashIn(readOptional(download.magnetHref, `${where}.magnetHref`, readText)) ??
		infohashIn(readOptional(download.id, `${where}.id`, readText));

	// A Part covered only by a Batch Release carries no magnet of its own: it anchors at the Batch,
	// which may sit on another page entirely, so the infohash comes out of that anchor.
	const infohash =
		ownInfohash ?? infohashIn(readOptional(download.batchHref, `${where}.batchHref`, readText));
	if (infohash === null) throw new WatchPageParseError(`${where} names no infohash`);

	const release = releases.get(infohash) ?? {
		infohash,
		arcSlug,
		partSlugs: [],
		resolution: readResolution(download.resolution, `${where}.resolution`),
		variant: readVariant(
			readOptional(download.variant, `${where}.variant`, readText),
			`${where}.variant`
		),
		sizeLabel: null,
		batchScope: readOptional(download.scope, `${where}.scope`, readBatchScope)
	};
	if (partSlug !== null && !release.partSlugs.includes(partSlug)) release.partSlugs.push(partSlug);
	// A Part covered by a Batch labels its own share of that Batch, not the Release's size.
	if (ownInfohash !== null)
		release.sizeLabel = readOptional(download.sizeLabel, `${where}.sizeLabel`, readText);
	releases.set(infohash, release);
}

function readBatchScope(value: unknown, where: string): BatchScope {
	const scope = readObject(value, where);
	const range = readText(scope.range, `${where}.range`);
	return {
		complete: readFlag(scope.complete, `${where}.complete`),
		partCount: readNumber(scope.count, `${where}.count`),
		partRange: range === '' ? null : range
	};
}

function readResolution(value: unknown, where: string): Resolution {
	const resolution = readNumber(value, where);
	if (resolution !== 480 && resolution !== 720 && resolution !== 1080)
		throw new WatchPageParseError(`${where} is an unknown Resolution ${resolution}`);
	return resolution;
}

function readVariant(variant: string | null, where: string): Variant {
	if (variant === null) return 'regular';
	if (variant === 'extended') return 'extended';
	// Alternates are qualified by which cut they are, e.g. "alternate_g8" for Skypiea's G-8 edit.
	if (variant.startsWith('alternate')) return 'alternate';
	throw new WatchPageParseError(`${where} is an unknown Variant ${variant}`);
}

const INFOHASH = /[0-9a-f]{40}/i;

function infohashIn(href: string | null): string | null {
	const found = href === null ? null : INFOHASH.exec(href);
	return found === null ? null : found[0].toLowerCase();
}

// Fields the payload omits serialize as this string, not as null and not as a missing key.
const ABSENT = '$undefined';

function readOptional<T>(
	value: unknown,
	where: string,
	read: (value: unknown, where: string) => T
): T | null {
	return value === undefined || value === ABSENT ? null : read(value, where);
}

function readText(value: unknown, where: string): string {
	if (typeof value !== 'string') throw new WatchPageParseError(`${where} is not text`);
	return value;
}

function readNumber(value: unknown, where: string): number {
	if (typeof value !== 'number') throw new WatchPageParseError(`${where} is not a number`);
	return value;
}

function readFlag(value: unknown, where: string): boolean {
	if (typeof value !== 'boolean') throw new WatchPageParseError(`${where} is not a flag`);
	return value;
}

function readList(value: unknown, where: string): unknown[] {
	if (!Array.isArray(value)) throw new WatchPageParseError(`${where} is not a list`);
	return value;
}

function readObject(value: unknown, where: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new WatchPageParseError(`${where} is not an object`);
	return value as Record<string, unknown>;
}

type FlightRows = Map<string, string>;

function readFlightRows(html: string): FlightRows {
	const needle = 'self.__next_f.push(';
	const streams = new Map<number, string>();
	let cursor = 0;
	while (true) {
		const start = html.indexOf(needle, cursor);
		if (start === -1) break;
		const open = start + needle.length;
		const end = endOfCallArgument(html, open);
		// Pushes sharing a stream id are one stream cut into pieces: they have to be concatenated
		// before being split into rows, or a row straddling two pushes is lost.
		const [streamId, chunk] = JSON.parse(html.slice(open, end)) as [number, string];
		streams.set(streamId, (streams.get(streamId) ?? '') + chunk);
		cursor = end;
	}
	if (streams.size === 0)
		throw new WatchPageParseError('the page embeds no self.__next_f payload at all');

	const rows: FlightRows = new Map();
	for (const stream of streams.values()) {
		for (const line of stream.split('\n')) {
			const row = /^([0-9a-f]+):(.*)$/s.exec(line);
			if (row !== null) rows.set(row[1]!, row[2]!);
		}
	}
	return rows;
}

function endOfCallArgument(source: string, start: number): number {
	let depth = 0;
	let quote: string | null = null;
	let escaped = false;
	for (let index = start; index < source.length; index++) {
		const character = source[index]!;
		if (quote !== null) {
			if (escaped) escaped = false;
			else if (character === '\\') escaped = true;
			else if (character === quote) quote = null;
			continue;
		}
		if (character === '"' || character === "'" || character === '`') quote = character;
		else if (character === '[' || character === '(') depth++;
		else if (character === ']' || character === ')') {
			depth--;
			if (depth === 0) return index + 1;
		}
	}
	throw new WatchPageParseError('a self.__next_f.push call is never closed');
}

function findTimeline(rows: FlightRows): Record<string, unknown> {
	for (const [rowId, raw] of rows) {
		if (!raw.includes('"timeline"') || !raw.includes('"segments"')) continue;
		const element = readList(parseRow(raw, rowId), `row ${rowId}`);
		const props = readObject(element[3], `row ${rowId} props`);
		const data = readObject(props.data, `row ${rowId} props.data`);
		return readObject(
			dereference(data.timeline, rows, new Map()),
			`row ${rowId} props.data.timeline`
		);
	}
	throw new WatchPageParseError('no Catalogue is embedded in the page');
}

function parseRow(raw: string, rowId: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		throw new WatchPageParseError(`row ${rowId} is not JSON`);
	}
}

const REFERENCE = /^\$([0-9a-f]+):(.*)$/;

function dereference(value: unknown, rows: FlightRows, parsedRows: Map<string, unknown>): unknown {
	if (typeof value === 'string') {
		const reference = REFERENCE.exec(value);
		return reference === null
			? value
			: dereference(follow(reference[1]!, reference[2]!, rows, parsedRows), rows, parsedRows);
	}
	if (Array.isArray(value)) return value.map((entry) => dereference(entry, rows, parsedRows));
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, dereference(entry, rows, parsedRows)])
		);
	}
	return value;
}

// Some fields are backreferences to a value serialized under another row, written as
// "$<rowId>:<path>" — left unfollowed they would be stored as that literal string.
function follow(
	rowId: string,
	path: string,
	rows: FlightRows,
	parsedRows: Map<string, unknown>
): unknown {
	if (!parsedRows.has(rowId)) {
		const raw = rows.get(rowId);
		if (raw === undefined)
			throw new WatchPageParseError(`a backreference points at row ${rowId}, which is not there`);
		parsedRows.set(rowId, parseRow(raw, rowId));
	}

	let current = parsedRows.get(rowId);
	for (const step of path.split(':')) {
		// "props" is not a key: it is index 3 of a serialized React element ["$", type, key, props].
		if (step === 'props' && Array.isArray(current) && current[0] === '$') current = current[3];
		else if (Array.isArray(current)) current = current[Number(step)];
		else if (current !== null && typeof current === 'object')
			current = (current as Record<string, unknown>)[step];
		else
			throw new WatchPageParseError(
				`the backreference $${rowId}:${path} runs past the end of the payload`
			);
	}
	return current;
}
