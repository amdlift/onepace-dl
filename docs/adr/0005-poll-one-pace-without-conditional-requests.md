# Poll One Pace without conditional requests

Story 58 asks that polling use conditional requests, so that Pacerr is not repeatedly pulling
megabytes of unchanged data from a volunteer project's servers. One Pace does not serve them.
Pacerr sends `If-Modified-Since` and `If-None-Match` on every poll and honours a `304` if one ever
arrives, but today every poll transfers the whole document, and the operator who is about to point
Pacerr at onepace.net is the person entitled to know that.

## What upstream actually serves

Measured against the live site:

| | Watch page `/en/watch` | Release feed `/en/releases/rss.xml` |
| --- | --- | --- |
| `ETag` | absent | absent |
| `Last-Modified` | absent | absent |
| `If-None-Match` | answered `200` with the whole body | answered `200` with the whole body |
| `If-Modified-Since` | answered `200` with the whole body | answered `200` with the whole body |
| `Range` | ignored | ignored |
| Size | ~5.1 MB | ~1.9 MB |

At the default cadence — the feed every fifteen minutes, the watch page every twenty-four hours —
that is about **180 MB of feed and 5 MB of watch page a day**, near enough 5.5 GB a month, and
almost all of it is a document that has not changed.

## Considered Options

- **Send the conditional headers and report the saving.** What a naive reading of story 58 yields,
  and what the code would look like if nobody had checked. Rejected as a claim: Pacerr would be
  reporting a bandwidth saving it is not making.
- **Fetch a byte range and compare the head of the document.** Rejected because `Range` is ignored,
  and because a prefix of an RSC payload or an RSS channel says nothing about whether the rest
  changed.
- **Poll less often.** Available to the operator, not a decision for Pacerr to take on their
  behalf: fifteen minutes is what story 55 asks for, and the cost is theirs to weigh.

## Consequences

Nothing can be saved on the wire, so the saving is taken after the bytes arrive. The feed's own
`lastBuildDate` short-circuits reparsing it; the watch page has no equivalent, so Pacerr stores a
SHA-256 of the body and compares that. Both spare the parse — a 5 MB RSC payload is the expensive
part locally — and neither spares the transfer.

The conditional headers are sent anyway. They cost nothing, and the day One Pace puts a cache in
front of the site, Pacerr starts taking 304s without a change.

The only lever over bandwidth is cadence, and both are configurable:
`PACERR_FEED_INTERVAL_MINUTES` (default 15) and `PACERR_CATALOGUE_INTERVAL_HOURS` (default 24).
Doubling the feed interval halves the bill. This is documented in `docs/deployment.md` rather than
left for an operator to discover from their own egress graphs.
