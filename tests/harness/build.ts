import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Seam 1 drives the real adapter-node build over HTTP, so the suite needs one. Rebuilt only when
 * something it is built from has moved on.
 */
export default function build(): void {
	const handler = join(repoRoot, 'build', 'handler.js');
	if (modifiedAt(handler) > newestSourceChange()) return;
	execFileSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
}

function newestSourceChange(): number {
	const roots = ['src', 'package.json', 'vite.config.ts'].map((it) => join(repoRoot, it));
	return Math.max(...roots.map(newestWithin));
}

function newestWithin(path: string): number {
	const stats = statSync(path, { throwIfNoEntry: false });
	if (stats === undefined) return 0;
	if (!stats.isDirectory()) return stats.mtimeMs;
	return Math.max(
		stats.mtimeMs,
		...readdirSync(path).map((entry) => newestWithin(join(path, entry)))
	);
}

const modifiedAt = (path: string): number =>
	statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0;
