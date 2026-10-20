# Deploying Pacerr

Pacerr is one image, three volumes and a Download Client you already run. Per ADR-0001 it never
speaks BitTorrent itself, so a working deployment is always at least two containers: Pacerr, and a
qBittorrent that Pacerr did not configure.

**Start at the [README](../README.md)** — it carries the quickstart, the volumes, the environment
variables and the user the container runs as. This document is the rest: the parts people only
need once something does not line up.

## Pointing Pacerr at an existing qBittorrent

In **Settings → Download Client**, give the qBittorrent WebUI address (`http://qbittorrent:8080`)
with its username and password, and press **Test**. The test distinguishes unreachable, banned,
rejected credentials and "that address answered, but not like a Download Client", so the message
says which of them you are looking at.

Pacerr never removes a completed torrent of its own accord, and never changes seeding, ratio or
VPN settings. Those stay yours. The one exception is an Upgrade: when a Release you hold is
superseded, the replacement is imported first and only then is the old torrent and its
download-directory copy removed. Your Library copy survives that, because the inode outlives the
download-directory link.

## The download directory must mean the same thing on both sides

qBittorrent reports where it put a completed download using **its own** paths. Pacerr then has to
find that file using **its** paths. If the two containers mount the same storage at different
places, qBittorrent says `/data/torrents/<hash>`, Pacerr looks for `/data/torrents/<hash>`, finds
nothing, and the import fails.

The simplest fix is to mount the download directory **at the same path in both containers** — give
qBittorrent `-v /srv/downloads:/downloads` too, and nothing else is needed.

### When they disagree

When you cannot change qBittorrent's layout — it is on another host, or it predates Pacerr and
other tools depend on its paths — add a **Remote Path Mapping** in **Settings → Remote Path
Mappings**:

| Path on the Download Client | The same place as Pacerr sees it |
| --------------------------- | -------------------------------- |
| `/data/torrents`            | `/downloads`                     |

Every path qBittorrent reports whose prefix matches the left column is rewritten to the right
column before Pacerr touches the filesystem. Where several mappings match, the longest left-hand
path wins, so a mapping for a subdirectory beats one for the volume it sits under.

A Remote Path Mapping only renames a path. The bytes still have to be reachable: both sides must
be looking at the same storage.

## What Pacerr checks at startup

Pacerr validates all three directories on boot and re-checks them on every request, so fixing a
mount clears the warning without restarting anything. It also validates the download directory
**as the Download Client reports it**, once a client is configured and reachable, so a missing or
wrong Remote Path Mapping surfaces immediately rather than at the first import three days later.

Three conditions are kept apart because they have three different fixes:

- **Not found** — nothing is mounted at that path. Mount the volume, point the environment
  variable at where it already is, or, for the download directory, add a Remote Path Mapping.
- **Not writable** — the directory is there but the uid Pacerr runs as cannot write to it. `chown`
  it to that uid, or use `--userns=keep-id` under rootless Podman. The README's *user the container
  runs as* section has the detail.
- **Library and download directory on different filesystems** — not a failure, which is why it is a
  warning and never raises the banner. It is why imports copy instead of hardlinking, which makes
  each Part occupy disk twice for as long as its Release seeds. Mount both from one filesystem to
  hardlink instead.

`/config` is checked before SQLite is opened, and a failure there is fatal: Pacerr cannot run
without its database. It exits naming the path, the uid it is running as, the owner and mode of the
directory, and both fixes — read `docker logs pacerr`. Before that check existed this was an
unexplained `SqliteError: unable to open database file` at boot.

The other two raise a health check, which is visible in **System** and as a banner on every view,
and clears on its own once the mount is fixed.

**Settings → Directories → Test** re-runs exactly the same validation on demand.

## Polling cost

Every poll transfers the whole document, because One Pace serves no `ETag` and no `Last-Modified`.
The numbers and the one lever you have are in the [README](../README.md#what-pacerr-costs-one-pace),
and the reasoning is in
[ADR-0005](adr/0005-poll-one-pace-without-conditional-requests.md).
