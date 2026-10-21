import { readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';

/**
 * How far a browse may reach: one root, less the names it hides directly beneath that root. The
 * two screens that browse differ only in those two values, so the confinement below is written
 * once and parameterised rather than copied.
 */
export interface BrowsePolicy {
	root: string;
	hidden: ReadonlySet<string>;
	/** What Pacerr says when it refuses a path, in the vocabulary of the screen that asked. */
	refusal: string;
}

export const hidesNothing: ReadonlySet<string> = new Set<string>();

// The spec's `/lib*` is a distribution's multilib set, enumerated rather than matched by prefix
// because `/library` is where an unconfigured Pacerr mounts the Library and has to stay reachable.
const systemDirectories: ReadonlySet<string> = new Set([
	'app',
	'proc',
	'sys',
	'dev',
	'bin',
	'sbin',
	'lib',
	'lib32',
	'lib64',
	'libx32',
	'usr',
	'etc',
	'var',
	'run',
	'tmp'
]);

/**
 * Anywhere readable on the filesystem this install can see, less the container's own system
 * directories, so what Settings offers is effectively the user's mounts.
 *
 * `root` is the filesystem root Pacerr runs under: `/` in the container, and the temporary
 * directory a test runs in at seam 1. The hidden names hang off it instead of being absolute paths
 * precisely so that they are substituted along with it — a literal `/tmp` would hide the directory
 * a test keeps its own Library in.
 */
export const filesystemPolicy = (root: string): BrowsePolicy => ({
	root,
	hidden: systemDirectories,
	refusal:
		'Pacerr will not browse that path, because it is either outside the filesystem this ' +
		"container can see or one of the container's own system directories."
});

/**
 * The absolute path `candidate` names within the policy, or null when it names anything the policy
 * does not reach. Resolved through symlinks, because a link inside the root is still a way out of
 * it, and every listing filters through this too, so nothing can be offered that would be refused.
 */
export function permit(policy: BrowsePolicy, candidate: string): string | null {
	const base = realOf(resolve(policy.root));
	const full = realOf(resolve(policy.root, candidate));
	if (!within(base, full)) return null;
	const top = relative(base, full).split(sep)[0] ?? '';
	return policy.hidden.has(top) ? null : resolve(policy.root, candidate);
}

/** The directories directly inside `directory` that the policy also reaches, named absolutely. */
export function browsableDirectories(policy: BrowsePolicy, directory: string): string[] {
	let entries: string[];
	try {
		entries = readdirSync(directory);
	} catch {
		return [];
	}
	const found: string[] = [];
	for (const entry of entries) {
		const path = permit(policy, resolve(directory, entry));
		if (path === null) continue;
		if (statSync(path, { throwIfNoEntry: false })?.isDirectory() === true) found.push(path);
	}
	return found.sort((left, right) => basename(left).localeCompare(basename(right)));
}

export function parentOf(policy: BrowsePolicy, directory: string): string | null {
	const above = dirname(directory);
	return above === directory ? null : permit(policy, above);
}

// A root of `/` is its own separator, so the prefix a child carries is not always `root + sep`.
const within = (base: string, path: string): boolean =>
	path === base || path.startsWith(base.endsWith(sep) ? base : base + sep);

function realOf(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}
