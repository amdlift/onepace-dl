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
the Library. The prohibition under Part is on naming a **Pacerr** Part an episode. A media server's
Season and Episode stay confined to the Library edge — generated filenames, season directory names,
Sidecar contents and UI copy — and appear nowhere as a type or column name.
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

**Upstream source**:
One of the two documents One Pace publishes that Pacerr derives everything from: the watch page,
which yields the Catalogue, and the release feed, which yields Releases. They are polled on
different cadences and parsed by different code, but checked identically, and a check of either
ends **updated**, **unchanged**, **unparsed** or **unreachable**.
_Avoid_: Provider, endpoint, remote, upstream on its own

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

**Had**:
A Part the Library holds a file for, together with the Release that file came from. The opposite
of missing, and the only one of the two that survives a restart as a fact rather than a
derivation. An Arc's completeness is stated as how many of its Parts are had.
_Avoid_: Owned, downloaded (that is the transfer), complete, present

**Library**:
The destination directory tree that a media server such as Jellyfin or Plex reads. Its edge is
where Season and Episode appear as words — in generated filenames, season directory names, Sidecar
contents and UI copy — because that is the vocabulary media servers parse. Never as a type or a
column name: Pacerr's own words for what those describe are Arc and Part.
_Avoid_: Media folder, output, destination

**Upgrade**:
Replacing an already-imported Part with a Release that better satisfies the user's preferences,
typically because the earlier Release became outdated or a higher Resolution appeared.
_Avoid_: Update, refresh, replace

### Artwork and metadata

**Backdrop**:
The landscape still the One Pace watch page provides for an Arc. Pacerr shows it in its own views
and never writes it to the Library.
_Avoid_: Cover, poster, art, thumbnail

**Poster**:
The portrait artwork for an Arc, which Pacerr ships rather than scrapes, and writes into the Arc's
season directory for a media server to display. Distinct from the Backdrop in shape, source and
purpose: one is Pacerr's own chrome, the other is Library output.
_Avoid_: Cover (that is the filename, not the concept), backdrop, artwork

**Sidecar**:
A metadata file Pacerr writes into the Library beside what it describes, for a media server to read
instead of consulting an online metadata provider. Covers both the Poster written as `cover.jpg`
and the NFO files describing the show, an Arc and a Part.
_Avoid_: Metadata file (ambiguous with the Catalogue), NFO (that is one format, not the concept)

**Layout**:
One of the three ways the Arcs view arranges the Catalogue — Poster, Overview or Table. Which one
is chosen changes how much artwork an Arc is given and nothing about what is known: every layout
states how many of an Arc's Parts are had. Distinct from a **view**, which is one of the six
destinations in the sidebar; the Arcs view has three layouts, and the other five views have one
arrangement each and so never name it.
_Avoid_: View (that is the sidebar destination), mode, display

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

## The state legend

Pacerr borrows this family of tools' grammar for state — an icon in a narrow column, coloured
pills for counts and qualities — and defines its own meanings, because theirs do not map. An Arc
is a stretch of a recut, not a broadcast series with a run that ends, and two of the six states
below have no equivalent anywhere in that family. See ADR-0010.

Each treatment is a token in `src/app.css`, declared once and named here, so the legend can be
learned rather than inferred from colour.

| State | Treatment | Token | What it means |
| --- | --- | --- | --- |
| **Had** | Success green | `var(--success)` | The Library holds a file for this Part. |
| **Missing, monitored** | Danger red | `var(--danger)` | No file, and the Arc's Monitoring says Pacerr should get one. This is the gap worth acting on. |
| **Missing, not monitored** | Warning orange | `var(--warning)` | No file, and nobody has asked for one. A gap, not a failure. |
| **Downloading** | Purple | `var(--downloading)` | The Download Client is working on a Release that covers this Part, so progress is visible without opening Activity. |
| **Unreleased Part** | Muted grey | `var(--ink-dim)` | One Pace has announced the number and published nothing. A gap in the Catalogue, never a gap in the collection. |
| **To Be Redone** | Brand cyan | `var(--brand)` | The Release Status of the same name: the current Release stands, and the project intends to replace it. A Release state, so it sits alongside any of the five above, and is named in a badge beside the Release rather than in the state column. |

The first five describe a Part and are mutually exclusive, in that order of precedence: a Part
Pacerr has is had even while a newer Release for it is downloading.

The Queue lists Releases rather than Parts, so it borrows the same treatments and keeps the
Download Client's own words for them: a transfer in flight is **Downloading**, a finished one
takes the had treatment under the word **Completed**, a failed one the missing-monitored
treatment under **Failed**, and one the client is not reporting on the muted grey under
**Unknown**.

Warning orange and danger red are spent on nothing else where a Part or a Release is listed.
System speaks its own vocabulary — a Health check is `ok`, `warned` or `failed`, and a History
entry `succeeded`, `warned` or `failed` — and that is deliberately not this legend.
