# Testing

Three seams, fixed by the spec. Add tests at seam 1 by default; a new seam needs a reason that
"it would be convenient" does not satisfy.

| Seam | What it is | Where |
| --- | --- | --- |
| 1 | The whole application, driven over HTTP | `tests/*.test.ts` via `tests/harness/pacerr.ts` |
| 2 | The Catalogue parser, a pure function with golden-file assertions | `src/lib/server/catalogue/watch-page.test.ts` |
| 3 | Batch expansion, a pure function | not written yet |

A good test states a user-visible outcome and asserts nothing about how it was reached. Asserting
that a function was called, or reading a column out of SQLite, tests the implementation.

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

- `startPacerr({ configDir, watchPage, feed, now, authentication })` — all optional. `configDir`
  boots against state a previous instance left behind; `authentication` is the container being
  given credentials by environment variable.
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
- `pacerr.downloadClient` — the in-memory fake: `added`, `removed`, `complete(infohash, path)`,
  `reachable`.
- `pacerr.paths` — `config`, `library`, `downloads`, all under a temporary directory. Assert on
  the Library by reading it.
- `pacerr.restart()` — recreate the container: same config volume, everything else new.

The suite builds the app once (`tests/harness/build.ts`) because seam 1 drives the real
adapter-node output over a real socket. Expect the first run after a source change to be slower.
