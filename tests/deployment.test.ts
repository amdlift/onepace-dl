import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
			'Reverie 1080p',
			'Reverie 1080p',
			'Reverie 1080p'
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
		const configDir = mkdtempSync(join(tmpdir(), 'pacerr-config-'));
		onTestFinished(() => {
			chmodSync(configDir, 0o755);
			rmSync(configDir, { recursive: true, force: true });
		});
		chmodSync(configDir, 0o555);

		const failure = await startPacerr({ configDir }).catch((error: Error) => error);

		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain(configDir);
		expect((failure as Error).message).toContain('cannot write to it');
		expect((failure as Error).message).toContain(`${process.getuid!()}:${process.getgid!()}`);
		expect((failure as Error).message).not.toContain('SQLITE');
	});
});
