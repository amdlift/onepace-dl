import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';
import { fixtures, minutes, startPacerr, type Pacerr } from './harness/pacerr';

const remoteRoot = '/data/torrents';

/**
 * Reverie grabbed, with its three files written where Pacerr can see them but the Download
 * Client reporting them under the root it was configured with instead.
 */
async function grabbedUnderARemoteRoot(): Promise<Pacerr> {
	const pacerr = await startPacerr({ feed: fixtures.feed });
	await pacerr.connectDownloadClient();
	pacerr.downloadClient.filesPerTorrent = 3;
	await pacerr.submit('/', 'toggleMonitoring', { arc: 'reverie' });

	const infohash = pacerr.downloadClient.added.at(-1)!.infohash;
	mkdirSync(join(pacerr.paths.downloads, infohash), { recursive: true });
	for (const position of [1, 2, 3]) {
		writeFileSync(join(pacerr.paths.downloads, infohash, `${position}.mkv`), `video ${position}`);
	}
	pacerr.downloadClient.complete(infohash, join(remoteRoot, infohash));
	return pacerr;
}

describe('a Download Client that reports a path Pacerr does not have', () => {
	it('imports once a Remote Path Mapping says where that path is here', async () => {
		const pacerr = await grabbedUnderARemoteRoot();

		await pacerr.submit('/settings', 'addRemotePathMapping', {
			remotePath: remoteRoot,
			localPath: pacerr.paths.downloads
		});

		expect((await pacerr.open('/arcs/reverie')).texts('tbody .have')).toEqual([
			'Reverie 1080p Regular',
			'Reverie 1080p Regular',
			'Reverie 1080p Regular'
		]);
	});

	it('fails the import, saying which path it could not read, until one is configured', async () => {
		const pacerr = await grabbedUnderARemoteRoot();

		await pacerr.advance(minutes(15));

		const history = (await pacerr.open('/activity')).text('.history');
		expect(history).toContain('Failed to import');
		expect(history).toContain(remoteRoot);
	});
});

describe('a download directory that is not mounted', () => {
	it('says so on every view at startup, naming the path and what to do', async () => {
		const pacerr = await startPacerr();

		rmSync(pacerr.paths.downloads, { recursive: true, force: true });
		await pacerr.restart();

		const banner = (await pacerr.open('/')).text('.banner');
		expect(banner).toContain('Download directory');
		expect(banner).toContain(pacerr.paths.downloads);
		expect(banner).toContain('cannot find the download directory');
		expect(banner).toContain('Remote Path Mapping');
	});

	it('clears on its own once the volume is there', async () => {
		const pacerr = await startPacerr();
		rmSync(pacerr.paths.downloads, { recursive: true, force: true });
		await pacerr.restart();
		expect((await pacerr.open('/')).text('.banner')).toContain('Download directory');

		mkdirSync(pacerr.paths.downloads, { recursive: true });

		expect((await pacerr.open('/')).text('.banner')).toBe('');
	});
});

describe('a Library the container cannot write to', () => {
	it('reads differently from a missing one, and says whose permissions to change', async () => {
		const pacerr = await startPacerr();

		chmodSync(pacerr.paths.library, 0o555);
		onTestFinished(() => chmodSync(pacerr.paths.library, 0o755));
		await pacerr.restart();

		const banner = (await pacerr.open('/')).text('.banner');
		expect(banner).toContain('Library');
		expect(banner).toContain(pacerr.paths.library);
		expect(banner).toContain('cannot write to it');
		expect(banner).toContain(`${process.getuid!()}:${process.getgid!()}`);
		expect(banner).not.toContain('cannot find');
	});
});

describe('a Library and a download directory on different filesystems', () => {
	const onAnotherFilesystem = (): string => {
		const directory = mkdtempSync('/dev/shm/pacerr-downloads-');
		onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
		return directory;
	};

	it('is reported as why imports copy, not as something broken', async () => {
		const pacerr = await startPacerr({ downloadsDir: onAnotherFilesystem() });

		const check = (await pacerr.open('/system'))
			.texts('.checks li')
			.find((entry) => entry.includes('different filesystems'))!;

		expect(check).toContain('Hardlinking');
		expect(check).toContain(pacerr.paths.downloads);
		expect(check).toContain('occupies disk twice');
		expect((await pacerr.open('/')).text('.banner')).toBe('');
	});

	it('says nothing of the sort when they share one', async () => {
		const pacerr = await startPacerr();

		expect((await pacerr.open('/system')).text('.checks')).not.toContain('different filesystems');
	});
});

describe('the Test action for paths', () => {
	it('re-runs the same validation on demand and reports what it found', async () => {
		const pacerr = await startPacerr();

		rmSync(pacerr.paths.downloads, { recursive: true, force: true });
		const after = await pacerr.submit('/settings', 'testPaths');

		expect(after.text('.paths')).toContain('cannot find the download directory');
		expect(after.text('.paths')).toContain(pacerr.paths.downloads);

		mkdirSync(pacerr.paths.downloads, { recursive: true });
		expect((await pacerr.submit('/settings', 'testPaths')).text('.paths')).toContain(
			'can read and write'
		);
	});
});

describe('a config volume the container cannot write to', () => {
	it('says which path and what was wrong, rather than failing as a SQLite error', async () => {
		const configDir = unwritableConfigDirectory();

		const failure = await startPacerr({ configDir }).catch((error: Error) => error);

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain(configDir);
		expect((failure as Error).message).toContain('cannot write to it');
		expect((failure as Error).message).toContain(`${process.getuid!()}:${process.getgid!()}`);
		expect((failure as Error).message).not.toContain('SQLITE');
	});

	it('exits on that sentence alone, rather than looking like a crash', async () => {
		const configDir = unwritableConfigDirectory();

		const run = spawnSync('node', ['server.js'], {
			cwd: fileURLToPath(new URL('../', import.meta.url)),
			encoding: 'utf8',
			env: { ...process.env, PACERR_CONFIG_DIR: configDir, PORT: '0' }
		});

		expect(run.status).toBe(1);
		expect(run.stderr).toContain('cannot write to it');
		expect(run.stderr).not.toContain('    at ');
		expect(run.stderr.split('\n').filter((line) => line.trim() !== '')).toHaveLength(1);
	});
});

function unwritableConfigDirectory(): string {
	const configDir = mkdtempSync(join(tmpdir(), 'pacerr-config-'));
	onTestFinished(() => {
		chmodSync(configDir, 0o755);
		rmSync(configDir, { recursive: true, force: true });
	});
	chmodSync(configDir, 0o555);
	return configDir;
}

describe('a Download Client that saves somewhere Pacerr cannot reach', () => {
	it('says so at startup, rather than at the first import days later', async () => {
		const pacerr = await startPacerr();
		pacerr.downloadClient.savePath = remoteRoot;

		await pacerr.connectDownloadClient();

		const banner = (await pacerr.open('/')).text('.banner');
		expect(banner).toContain('cannot find the download directory');
		expect(banner).toContain(remoteRoot);
		expect(banner).toContain('Remote Path Mapping');
	});

	it('clears once a Remote Path Mapping says where that path is here', async () => {
		const pacerr = await startPacerr();
		pacerr.downloadClient.savePath = remoteRoot;
		await pacerr.connectDownloadClient();

		await pacerr.submit('/settings', 'addRemotePathMapping', {
			remotePath: remoteRoot,
			localPath: pacerr.paths.downloads
		});

		expect((await pacerr.open('/')).text('.banner')).toBe('');
	});

	it('is not raised against a Download Client that cannot be asked where it saves', async () => {
		const pacerr = await startPacerr();
		pacerr.downloadClient.savePath = remoteRoot;
		await pacerr.connectDownloadClient();
		expect((await pacerr.open('/')).text('.banner')).toContain('cannot find');

		pacerr.downloadClient.reachable = false;
		await pacerr.submit('/settings', 'testPaths');

		expect((await pacerr.open('/')).text('.banner')).not.toContain('cannot find');
	});
});
