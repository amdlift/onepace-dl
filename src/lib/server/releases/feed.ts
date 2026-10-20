import type { Coverage, CoverageTerm, Resolution, Variant } from '../catalogue/watch-page';

export type ReleaseStatus = 'current' | 'outdated' | 'to-be-redone';

export interface FeedRelease {
	infohash: string;
	title: string;
	publishedAt: Date;
	variant: Variant;
	status: ReleaseStatus;
	resolution: Resolution | null;
	chapters: Coverage | null;
	episodes: Coverage | null;
	magnetUri: string | null;
	torrentUrl: string | null;
}

export interface Feed {
	lastBuildDate: Date | null;
	releases: FeedRelease[];
}

export class FeedParseError extends Error {
	constructor(reason: string) {
		super(`the One Pace release feed did not parse: ${reason}`);
		this.name = 'FeedParseError';
	}
}

export function parseFeed(xml: string): Feed {
	// Eighty-odd of the oldest items carry a urn:crc32 guid and no infohash, magnet or enclosure
	// at all. Nothing identifies or downloads them, and per ADR-0004 their titles never could.
	const releases = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
		.map((match) => readRelease(match[1]!))
		.filter((release): release is FeedRelease => release !== null);

	return { lastBuildDate: readLastBuildDate(xml), releases };
}

/**
 * Cheap enough to run on every poll: One Pace honours no conditional request, so this is the
 * only thing standing between an unchanged feed and reparsing six hundred items.
 */
export function readLastBuildDate(xml: string): Date | null {
	if (!xml.includes('<channel>')) throw new FeedParseError('it is not an RSS channel');
	const firstItem = xml.indexOf('<item>');
	const channel = xml.slice(0, firstItem === -1 ? undefined : firstItem);
	return readDate(elementIn(channel, 'lastBuildDate'));
}

function readRelease(item: string): FeedRelease | null {
	const infohash = infohashIn(item);
	if (infohash === null) return null;

	const publishedAt = readDate(elementIn(item, 'pubDate'));
	if (publishedAt === null)
		throw new FeedParseError(`the Release ${infohash} states no publication date`);

	const categories = [...item.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/g)].map((match) =>
		decode(match[1]!).trim()
	);
	const terms = describedTerms(item);

	return {
		infohash,
		title: decode(elementIn(item, 'title') ?? '').trim(),
		publishedAt,
		variant: variantIn(categories),
		status: statusIn(categories),
		resolution: readResolution(terms.get('Resolution')),
		chapters: readCoverage(terms.get('Covered manga chapters')),
		episodes: readCoverage(terms.get('Covered anime episodes')),
		magnetUri: elementIn(item, 'torrent:magnetURI'),
		torrentUrl: attributeIn(item, 'enclosure', 'url')
	};
}

const INFOHASH = /\b[0-9a-f]{40}\b/i;

function infohashIn(item: string): string | null {
	const stated = elementIn(item, 'torrent:infoHash');
	if (stated !== null && INFOHASH.test(stated)) return stated.toLowerCase();
	const magnet = elementIn(item, 'torrent:magnetURI') ?? elementIn(item, 'guid') ?? '';
	const found = INFOHASH.exec(magnet);
	return found === null ? null : found[0].toLowerCase();
}

function variantIn(categories: string[]): Variant {
	const stated = categories.find((category) => category.startsWith('variant/'));
	if (stated === undefined) return 'regular';
	const variant = stated.slice('variant/'.length);
	if (variant === 'regular' || variant === 'extended') return variant;
	// Alternates are qualified by which cut they are, e.g. "alternate_g8" for Skypiea's G-8 edit.
	if (variant.startsWith('alternate')) return 'alternate';
	throw new FeedParseError(`${stated} is an unknown Variant`);
}

// One Pace states only the exceptions: a Release with neither category is current.
function statusIn(categories: string[]): ReleaseStatus {
	if (categories.includes('outdated')) return 'outdated';
	if (categories.includes('to-be-redone')) return 'to-be-redone';
	return 'current';
}

/** The `<dl>` of `<dt>`/`<dd>` pairs the item's CDATA description opens with. */
function describedTerms(item: string): Map<string, string> {
	const description = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(item);
	const list = description === null ? null : /<dl>([\s\S]*?)<\/dl>/.exec(description[1]!);
	if (list === null) return new Map();

	return new Map(
		[...list[1]!.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map((pair) => [
			decode(pair[1]!).trim(),
			decode(pair[2]!).trim()
		])
	);
}

function readResolution(stated: string | undefined): Resolution | null {
	if (stated === undefined) return null;
	const resolution = Number(stated.replace(/p$/, ''));
	if (resolution !== 480 && resolution !== 720 && resolution !== 1080)
		throw new FeedParseError(`${stated} is an unknown Resolution`);
	return resolution;
}

const COVER_STORIES = /\s+cover stories$/;
const RANGE = /^(\d+)\s*[–—-]\s*(\d+)$/;

function readCoverage(stated: string | undefined): Coverage | null {
	if (stated === undefined || stated === '') return null;
	const coverStories = COVER_STORIES.test(stated);
	const terms = stated
		.replace(COVER_STORIES, '')
		.split(',')
		.map((term) => term.trim())
		.filter((term) => term !== '')
		.map(readCoverageTerm);
	return terms.length === 0 ? null : { terms, coverStories };
}

function readCoverageTerm(term: string): CoverageTerm {
	const range = RANGE.exec(term);
	if (range !== null) return { from: Number(range[1]), to: Number(range[2]) };
	if (/^\d+$/.test(term)) return { from: Number(term), to: Number(term) };
	return { text: term };
}

function elementIn(source: string, name: string): string | null {
	const found = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(source);
	return found === null ? null : decode(found[1]!);
}

function attributeIn(source: string, element: string, name: string): string | null {
	const tag = new RegExp(`<${element}\\b[^>]*>`).exec(source);
	if (tag === null) return null;
	const found = new RegExp(`\\b${name}="([^"]*)"`).exec(tag[0]);
	return found === null ? null : decode(found[1]!);
}

function readDate(value: string | null): Date | null {
	if (value === null) return null;
	const date = new Date(value.trim());
	return Number.isNaN(date.getTime()) ? null : date;
}

const NAMED: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'"
};

function decode(text: string): string {
	return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, entity: string) => {
		if (entity.startsWith('#x') || entity.startsWith('#X'))
			return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
		if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
		return NAMED[entity] ?? whole;
	});
}
