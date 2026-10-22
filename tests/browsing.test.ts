import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { startPacerr, type Pacerr, type PacerrPage } from './harness/pacerr';

/** Directories as this container sees them: the mounts a user would be browsing for. */
function mounted(pacerr: Pacerr, ...paths: string[]): void {
	for (const path of paths) mkdirSync(join(pacerr.paths.root, path), { recursive: true });
}

const seen = (pacerr: Pacerr, path: string): string => join(pacerr.paths.root, path);

const browse = (pacerr: Pacerr, target: string, at?: string): Promise<PacerrPage> =>
	pacerr.open(
		at === undefined
			? `/settings/browse?for=${target}`
			: `/settings/browse?for=${target}&at=${encodeURIComponent(at)}`
	);

const offered = (page: PacerrPage): string[] => page.texts('.directories .name');

/** Which Settings page each path field now lives on. */
const settingsPage: Record<string, string> = {
	library: '/settings/media-management',
	downloads: '/settings/media-management',
	importSource: '/settings/manual-import'
};

const settingsValue = async (pacerr: Pacerr, field: string): Promise<string | null> =>
	(await pacerr.open(settingsPage[field] ?? '/settings')).attributes(
		`input[name="${field}"]`,
		'value'
	)[0] ?? null;

const browseLinks = async (pacerr: Pacerr, path: string): Promise<(string | null)[]> =>
	(await pacerr.open(path)).attributes('a[href^="/settings/browse"]', 'href');

describe('browsing for the Library', () => {
	it('lists the directories it can see and descends into the one picked', async () => {
		const pacerr = await startPacerr();
		mounted(pacerr, 'srv/media/anime', 'srv/media/film', 'srv/torrents');

		expect(offered(await browse(pacerr, 'library', pacerr.paths.root))).toContain('srv');
		expect(offered(await browse(pacerr, 'library', seen(pacerr, 'srv')))).toEqual([
			'media',
			'torrents'
		]);
		expect(offered(await browse(pacerr, 'library', seen(pacerr, 'srv/media')))).toEqual([
			'anime',
			'film'
		]);
	});
});

describe("the container's own system directories", () => {
	it('are left out, so what is offered is the mounts and not a tour of Linux', async () => {
		const pacerr = await startPacerr();
		mounted(pacerr, 'app', 'proc', 'sys', 'dev', 'bin', 'sbin', 'lib', 'lib64');
		mounted(pacerr, 'usr', 'etc', 'var', 'run', 'tmp', 'srv');

		const page = await browse(pacerr, 'library', pacerr.paths.root);

		expect(offered(page)).toContain('srv');
		expect(offered(page)).not.toContain('etc');
		expect(offered(page)).not.toContain('tmp');
		expect(offered(page).filter((name) => name !== 'srv' && name !== 'library')).toEqual([
			'config',
			'downloads',
			'unconfigured'
		]);
	});

	it('does not take the Library with them, which the container mounts next to them', async () => {
		const pacerr = await startPacerr();

		expect(offered(await browse(pacerr, 'library', pacerr.paths.root))).toContain('library');
		expect(await settingsValue(pacerr, 'library')).toBe(pacerr.paths.library);
	});

	it('refuses to open one that was typed in, saying why, rather than showing it', async () => {
		const pacerr = await startPacerr();
		mounted(pacerr, 'etc/secrets');

		const page = await browse(pacerr, 'library', seen(pacerr, 'etc'));

		expect(page.text('.alert')).toContain("container's own system directories");
		expect(offered(page)).not.toContain('secrets');
	});
});

describe('picking a directory for a Settings field', () => {
	it('offers a browser beside every path field Settings holds', async () => {
		const pacerr = await startPacerr();

		expect(await browseLinks(pacerr, '/settings/manual-import')).toEqual([
			'/settings/browse?for=importSource'
		]);
		expect(await browseLinks(pacerr, '/settings/media-management')).toEqual([
			'/settings/browse?for=library',
			'/settings/browse?for=downloads'
		]);
	});

	it('writes the directory it was standing in into the field it was opened for', async () => {
		const pacerr = await startPacerr();
		mounted(pacerr, 'srv/media/one-pace', 'srv/torrents', 'srv/incoming');

		await pacerr.submit('/settings/browse', 'select', {
			for: 'library',
			at: seen(pacerr, 'srv/media/one-pace')
		});
		await pacerr.submit('/settings/browse', 'select', {
			for: 'downloads',
			at: seen(pacerr, 'srv/torrents')
		});
		await pacerr.submit('/settings/browse', 'select', {
			for: 'importSource',
			at: seen(pacerr, 'srv/incoming')
		});

		expect(await settingsValue(pacerr, 'library')).toBe(seen(pacerr, 'srv/media/one-pace'));
		expect(await settingsValue(pacerr, 'downloads')).toBe(seen(pacerr, 'srv/torrents'));
		expect(await settingsValue(pacerr, 'importSource')).toBe(seen(pacerr, 'srv/incoming'));
	});

	it('opens at the directory the field holds, so picking again starts where it is', async () => {
		const pacerr = await startPacerr();
		mounted(pacerr, 'srv/media/one-pace/Season 01');
		await pacerr.submit('/settings/browse', 'select', {
			for: 'library',
			at: seen(pacerr, 'srv/media/one-pace')
		});

		const page = await browse(pacerr, 'library');

		expect(page.attributes('input[name="at"]', 'value')).toEqual([
			seen(pacerr, 'srv/media/one-pace')
		]);
		expect(offered(page)).toEqual(['Season 01']);
	});
});

describe('a path the user already knows', () => {
	it('is pasted into the field above the listing and opened in one step', async () => {
		const pacerr = await startPacerr();
		mounted(pacerr, 'srv/media/anime/One Pace/Season 01');
		const known = seen(pacerr, 'srv/media/anime/One Pace');

		const page = await browse(pacerr, 'library', known);

		expect(page.attributes('input[name="at"]', 'value')).toEqual([known]);
		expect(offered(page)).toEqual(['Season 01']);
		expect(page.html.indexOf('name="at"')).toBeLessThan(page.html.indexOf('class="directories'));
	});

	it('says so when the path names nothing, rather than listing somewhere else', async () => {
		const pacerr = await startPacerr();

		const page = await browse(pacerr, 'library', seen(pacerr, 'srv/nowhere'));

		expect(page.text('.alert')).toContain('found no directory at');
	});
});

describe('what the Settings browser is allowed to reach', () => {
	/** A directory outside the filesystem this instance runs under, which nothing may offer. */
	function elsewhere(): string {
		const path = mkdtempSync(join(tmpdir(), 'pacerr-elsewhere-'));
		mkdirSync(join(path, 'secrets'));
		onTestFinished(() => rmSync(path, { recursive: true, force: true }));
		return path;
	}

	it('refuses a path crafted to climb out of the filesystem it can see', async () => {
		const pacerr = await startPacerr();
		const outside = elsewhere();

		expect((await browse(pacerr, 'library', `${pacerr.paths.root}/../..`)).text('.alert')).toContain(
			'Pacerr will not browse that path'
		);
		expect((await browse(pacerr, 'library', '/etc/ssl')).text('.alert')).toContain(
			'Pacerr will not browse that path'
		);

		const absolute = await browse(pacerr, 'library', outside);
		expect(absolute.text('.alert')).toContain('Pacerr will not browse that path');
		expect(offered(absolute)).not.toContain('secrets');

		await pacerr.submit('/settings/browse', 'select', { for: 'library', at: outside });
		expect(await settingsValue(pacerr, 'library')).toBe(pacerr.paths.library);
	});

	it('refuses a symlink that leads out of it, and does not offer it either', async () => {
		const pacerr = await startPacerr();
		symlinkSync(elsewhere(), seen(pacerr, 'shortcut'));

		expect(offered(await browse(pacerr, 'library', pacerr.paths.root))).not.toContain('shortcut');
		expect(offered(await browse(pacerr, 'library', seen(pacerr, 'shortcut')))).not.toContain(
			'secrets'
		);

		await pacerr.submit('/settings/browse', 'select', {
			for: 'library',
			at: seen(pacerr, 'shortcut')
		});

		expect(await settingsValue(pacerr, 'library')).toBe(pacerr.paths.library);
	});
});

describe('a path field the environment pinned', () => {
	it('offers no browser, and is not overwritten by one driven at it anyway', async () => {
		const pinned = mkdtempSync(join(tmpdir(), 'pacerr-pinned-'));
		onTestFinished(() => rmSync(pinned, { recursive: true, force: true }));
		const pacerr = await startPacerr({ libraryFromEnvironment: pinned });
		mounted(pacerr, 'srv/media');

		expect(await browseLinks(pacerr, '/settings/manual-import')).toEqual([
			'/settings/browse?for=importSource'
		]);
		expect(await browseLinks(pacerr, '/settings/media-management')).toEqual(['/settings/browse?for=downloads']);

		await pacerr.submit('/settings/browse', 'select', {
			for: 'library',
			at: seen(pacerr, 'srv/media')
		});

		expect(await settingsValue(pacerr, 'library')).toBe(pinned);
	});
});
