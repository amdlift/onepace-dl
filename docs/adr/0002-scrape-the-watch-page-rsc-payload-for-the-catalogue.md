# Scrape the watch page RSC payload for the catalogue

One Pace publishes no API. The RSS feed is a flat chronological list of Releases: it cannot say how
Parts group into Arcs, how many Parts an Arc has, or which Parts are planned but unreleased — all of
which Pacerr needs to render "monitor this Arc" meaningfully. That structure does exist, as JSON
embedded in the `self.__next_f` React Server Components payload of `/en/watch`. So Pacerr reads both
sources: the watch page for the Catalogue, the RSS feed for Releases, **joined on infohash**.

## Why infohash and not title

The watch page renders each current Release as a magnet link against a specific Part, so it yields
`infohash → Part` directly. The RSS `guid` is `urn:btih:<infohash>`, so it yields
`infohash → pubDate, Variant, Release Status, size`. Measured against a live fetch of both, 262 of
the 263 infohashes on the watch page are present in the feed.

Matching on names was tried and rejected: the two sources disagree. The feed says "Arabasta" where
the Catalogue slug is `alabasta`; "The Adventures of Buggy's Crew" slugifies to `buggy-s-crew`
against a Catalogue `buggys-crew`; and Variant suffixes like `Wano 02 Extended` are not Arc names at
all. See ADR-0004.

## Consequences

The RSC payload is an undocumented internal format belonging to someone else's Next.js build, and it
will change without warning. All parsing of it is confined to a single adapter module covered by
golden-file tests against a checked-in fixture, so a redesign upstream fails loudly in one place
rather than corrupting the Catalogue. The Catalogue is cached in SQLite and only replaced when a
scrape parses cleanly, so a broken upstream degrades Pacerr to "no new Parts discovered" rather than
wiping what it already knows, and the health banner makes that state visible.

The page lists only current Releases, so outdated Releases in the feed have no Catalogue entry. This
is useful rather than a gap: a Release we hold has gone outdated exactly when its infohash drops out
of the page's current set.

The two sources are polled at different rates (feed every 15 minutes, Catalogue daily), so a new
Release can briefly have no Part mapping. An unknown infohash triggers an out-of-band Catalogue
refresh; if it is still unmapped afterwards it is parked as an Unmatched Release and surfaced in
System rather than guessed at.
