# Pacerr

Pacerr monitors the One Pace project's release feed and automatically acquires and organises
its video releases into a media library. This glossary fixes the vocabulary the codebase uses,
because three overlapping naming systems meet here: One Pace's own (arcs and parts), a media
server's (seasons and episodes), and BitTorrent's (torrents and infohashes).

## Language

### The catalogue

**Arc**:
A named stretch of the One Pace recut, such as Wano or Fishman Island. The top level of the
catalogue and the unit a user chooses to monitor.
_Avoid_: Season (reserve for the library edge), saga, chapter

**Part**:
One numbered instalment within an Arc, such as Wano 54. Some Arcs consist of a single unnumbered
Part. The smallest unit the catalogue tracks.
_Avoid_: Episode (reserve for the library edge), entry, instalment

**Coverage**:
The stretch of *One Piece* an Arc, a Part or a Release recuts, stated as the manga **chapters** and
the anime **episodes** it spans. One Pace publishes it on the watch page and in the feed, and Batch
expansion reads it to work out which Parts a Batch Release contains.

This is the one place `chapter` and `episode` are legitimate as field, type and column names: they
are *One Piece*'s units for the source material One Pace cut from, not a media server's units for
the Library. The prohibition under Part is on naming a **Pacerr** Part an episode. `library/naming.ts`
remains the only place Pacerr speaks a media server's Season and Episode.
_Avoid_: Range, span, extent

**Unreleased Part**:
A Part that the catalogue knows is planned but which has no Release yet. Visible in the UI as a
gap, never downloadable.
_Avoid_: Missing part, pending part

**Catalogue**:
The full tree of Arcs and their Parts, derived from the One Pace watch page. Describes what
*should* exist, independent of what has been published.
_Avoid_: Series, index, library (library is the output, not the catalogue)

### Releases

**Release**:
One published torrent from the One Pace project. Identified by its infohash. A Release covers
either a single Part or, for a Batch Release, a contiguous run of Parts.
_Avoid_: Download (that's the act), torrent, item, entry

**Batch Release**:
A Release covering an entire Arc or a range of Parts in one torrent, typically published when an
Arc has no per-Part Releases yet and often at a lower Resolution than later per-Part Releases.
Its coverage can overlap per-Part Releases for the same Arc.
_Avoid_: Bundle, pack, season pack

**Variant**:
Which cut of a Part a Release contains: regular, extended, or alternate. Orthogonal to Resolution
and to Release Status.
_Avoid_: Edition, version, type

**Resolution**:
The vertical pixel count of a Release: 1080p, 720p, or 480p.
_Avoid_: Quality (quality is the profile that selects on resolution, not the resolution itself)

**Release Status**:
Where a Release stands in the One Pace project's own lifecycle: **current** (the Release to
prefer), **outdated** (superseded by a newer Release of the same Part), or **to-be-redone**
(current, but the project intends to replace it). A majority of Releases in the feed are
outdated, so this is a first-class state rather than a filter.
_Avoid_: Deprecated, stale, obsolete

### Acquisition

**Monitoring**:
A user's standing instruction that Pacerr should acquire and keep current every Part of a given
Arc, including Parts released in future.
_Avoid_: Watching (ambiguous with viewing), tracking, subscribing

**Grab**:
Handing a Release to the Download Client, the moment Pacerr commits to acquiring it.
_Avoid_: Fetch, queue, snatch

**Download Client**:
The external BitTorrent daemon that Pacerr delegates all transfers to. Pacerr never moves bytes
over BitTorrent itself.
_Avoid_: Torrent client, backend, downloader

**Import**:
Taking a completed download and placing it in the Library under a media-server-legible path,
after which the Part counts as acquired.
_Avoid_: Organise, move, file, sort

**Library**:
The destination directory tree that a media server such as Jellyfin or Plex reads. The only
place Season and Episode appear as words, because that is the vocabulary media servers parse.
_Avoid_: Media folder, output, destination

**Upgrade**:
Replacing an already-imported Part with a Release that better satisfies the user's preferences,
typically because the earlier Release became outdated or a higher Resolution appeared.
_Avoid_: Update, refresh, replace

### Selection

**Profile**:
The single global set of preferences Pacerr selects Releases against: an ordered Resolution
preference, a Variant preference, and a Cutoff. There is exactly one, because Pacerr manages one
show.
_Avoid_: Quality profile, preset, settings

**Cutoff**:
The Resolution at or above which a Part is considered done, so Pacerr stops looking for Upgrades
to it.
_Avoid_: Target, ceiling, threshold

**Unmatched Release**:
A Release present in the feed whose infohash does not appear in the Catalogue, so Pacerr cannot
tell which Part it covers. Parked and surfaced rather than guessed at or discarded.
_Avoid_: Orphan, unknown release, unparsed

### Bringing in files

**Manual Import**:
The user-driven operation of taking a video file that Pacerr did not download and recording it as
the file for a Part. Always confirmed by a human, never run unattended.
_Avoid_: Scan, adopt, library import

**Import Source**:
The configured directory that Manual Import browses. Bounds what Pacerr will offer to read, as
distinct from the Library, which is what Pacerr writes.
_Avoid_: Source folder, watch folder (nothing is watched)

**Remote Path Mapping**:
A configured rewrite from a path as the Download Client reports it to the equivalent path as
Pacerr sees it, for deployments where the two do not share a mount layout.
_Avoid_: Path translation, path alias
