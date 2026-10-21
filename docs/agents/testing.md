# Testing

Four seams. Add tests at seam 1 by default; a new seam needs a reason that
"it would be convenient" does not satisfy.

| Seam | What it is | Where |
| --- | --- | --- |
| 1 | The whole application, driven over HTTP | `tests/*.test.ts` via `tests/harness/pacerr.ts` |
| 2 | The Catalogue parser, a pure function with golden-file assertions | `src/lib/server/catalogue/watch-page.test.ts` |
| 3 | Batch expansion, a pure function | `src/lib/server/batch/expansion.test.ts` |
| 4 | The qBittorrent adapter, against a stub HTTP daemon | `src/lib/server/download/qbittorrent.test.ts` |

A good test states a user-visible outcome and asserts nothing about how it was reached. Asserting
that a function was called, or reading a column out of SQLite, tests the implementation.

Seam 4 exists because seam 1 replaces the whole `DownloadClient`, so nothing above it can reach
the two things the adapter decides on its own: which of unreachable, banned, bad credentials or
"not a WebUI" an auth response means, and waiting out the 409 qBittorrent answers with until a
magnet link's metadata arrives. Both are acceptance criteria, and neither is reachable through the
fake. Nothing else belongs here: behaviour goes at seam 1.

## Seam 1

`startPacerr()` boots the real application — real SQLite, real parser, real filesystem — with four
substitutions and nothing else: One Pace over HTTP, the `DownloadClient`, the clock, and the
directories it reads and writes.

```ts
import { fixtures, hours, startPacerr } from './harness/pacerr';

it('picks up an Arc that appeared upstream', async () => {
	const pacerr = await startPacerr();

	pacerr.upstream.watchPage.publish(fixtures.watchPage.replace('Wano', 'Wano Country'));
	await pacerr.advance(hours(24));

	expect((await pacerr.open('/')).text()).toContain('Wano Country');
});
```

The instance stops itself when the test finishes.

- `startPacerr({ configDir, watchPage, feed, now, authentication, downloadsDir,
  libraryFromEnvironment, downloadsFromEnvironment })` — all optional.
  `configDir` boots against state a previous instance left behind; `authentication` is the
  container being given credentials by environment variable; `downloadsDir` mounts the download
  directory somewhere specific, which is how a test puts it on a filesystem the Library cannot be
  hardlinked to; the two `*FromEnvironment` options are the deployment that pins a path with
  `PACERR_LIBRARY_DIR` or `PACERR_DOWNLOADS_DIR`, which Settings then refuses to change.
  `watchPage` defaults to `fixtures.watchPage` and
  `feed` to an empty channel, so a test that wants Releases passes `fixtures.feed`. Both
  fixtures are the real documents, captured from One Pace.
- `pacerr.open(path)` → a `PacerrPage`: `text(selector?)`, `texts(selector)`,
  `attributes(selector, name)`, `document`, `status`.
- `pacerr.submit(path, action, fields?)` — a form action, the way a browser without JavaScript
  submits one. Returns the page as it looks afterwards.
- `pacerr.fetch(path, init?)` — the raw `Response`, for JSON endpoints. Cookies are kept between
  calls the way a browser keeps them; `pacerr.forget()` empties the jar.
- `pacerr.advance(hours(24))` — move the clock and run whatever that made due. Nothing is timed;
  a tick only ever happens because a test asked for one.
- `pacerr.upstream.watchPage` / `.feed` — `publish(body)`, `fail(status)`, `sendValidators()`,
  `requests`, `requestCount`, `body`, `etag`. `publish` between ticks is how a test changes what
  upstream says.
- `pacerr.downloadClient` — the in-memory fake: `added`, `removed`, `deselected()`,
  `complete(infohash, path)`, `progressed(infohash, fraction)`, `reachable`, `failing`,
  `filesPerTorrent`.
- `pacerr.connectDownloadClient()` — point Pacerr at one, which nothing is grabbed without.
- `pacerr.paths` — `config`, `library`, `downloads`, all under a temporary directory. Assert on
  the Library by reading it. Starting up points Pacerr at the Library and the download directory
  through its own Settings, so every test runs against paths configured the way a person does.
- `pacerr.settle()` — let whatever a form action started in the background run to completion.
  Scheduled work is driven by `advance`; work a request triggers, such as a move of the Library,
  is driven by this. Nothing in the background finishes because a test waited.
- `pacerr.hold()` — park background work at its next pause and return once it is all parked, so a
  test can read a job that is still running. `settle()` releases it.
- `pacerr.restart()` — recreate the container: same config volume, everything else new.

The suite builds the app once (`tests/harness/build.ts`) because seam 1 drives the real
adapter-node output over a real socket. Expect the first run after a source change to be slower.
