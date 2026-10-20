# Deploying Pacerr

Pacerr is one image, three volumes and a Download Client you already run. Per ADR-0001 it never
speaks BitTorrent itself, so a working deployment is always at least two containers: Pacerr, and a
qBittorrent that Pacerr did not configure.

## Volumes

| Mount        | Holds                                                     | Override               |
| ------------ | --------------------------------------------------------- | ---------------------- |
| `/config`    | `pacerr.db` — the Catalogue, Monitoring, Profile, History | `PACERR_CONFIG_DIR`    |
| `/library`   | The Library a media server reads                          | `PACERR_LIBRARY_DIR`   |
| `/downloads` | The download directory the Download Client writes into    | `PACERR_DOWNLOADS_DIR` |

Everything Pacerr must not lose lives in `/config`, so recreating the container loses nothing as
long as that volume survives.

```sh
docker run -d --name pacerr \
  -p 8787:3000 \
  -v pacerr-config:/config \
  -v /srv/media/one-pace:/library \
  -v /srv/downloads:/downloads \
  ghcr.io/amdlift/pacerr:latest
```

## The user the container runs as

The image runs as `node`, **uid 1000, gid 1000**. Every bind-mounted volume must be writable by
that user.

- **Named volumes** (`-v pacerr-config:/config`) are created with the right owner and need nothing.
- **Bind mounts under rootful Docker**: `chown -R 1000:1000` the host directory.
- **Bind mounts under rootless Podman**: your own uid maps to uid 0 inside the container, so the
  mount appears owned by `0:0` and `node` cannot write to it. Run with `--userns=keep-id`, or use
  named volumes.

Getting this wrong used to kill Pacerr at boot with `SqliteError: unable to open database file`.
It now exits with the path, the uid it is running as, the owner and mode of the directory, and
both fixes — read `docker logs pacerr`.

## Pointing Pacerr at an existing qBittorrent

In **Settings → Download Client**, give the qBittorrent WebUI address (`http://qbittorrent:8080`)
with its username and password, and press **Test**. The test distinguishes unreachable, banned,
rejected credentials and "that address answered, but not like a Download Client", so the message
says which of them you are looking at.

Pacerr never removes a completed torrent of its own accord, and never changes seeding, ratio or
VPN settings. Those stay yours.

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
mount clears the warning without restarting anything. Three conditions are kept apart because they
have three different fixes:

- **Not found** — nothing is mounted at that path. Mount the volume, point the environment
  variable at where it already is, or, for the download directory, add a Remote Path Mapping.
- **Not writable** — the directory is there but uid 1000 cannot write to it. `chown` it, or use
  `--userns=keep-id` under rootless Podman. See above.
- **Library and download directory on different filesystems** — not a failure. It is why imports
  copy instead of hardlinking, which makes each Part occupy disk twice for as long as its Release
  seeds. Mount both from one filesystem to hardlink instead.

`/config` is checked before SQLite is opened, and a failure there is fatal: Pacerr cannot run
without its database. The other two raise a health check, which is visible in **System** and as a
banner on every view, and clears on its own once the mount is fixed.

**Settings → Directories → Test** re-runs exactly the same validation on demand.

## Environment variables

| Variable                         | Default               | Purpose                                   |
| -------------------------------- | --------------------- | ----------------------------------------- |
| `PORT`                           | `3000`                | Port to listen on                         |
| `HOST`                           | `0.0.0.0`             | Address to bind                           |
| `PACERR_CONFIG_DIR`              | `/config`             | Where `pacerr.db` lives                   |
| `PACERR_LIBRARY_DIR`             | `/library`            | The Library                               |
| `PACERR_DOWNLOADS_DIR`           | `/downloads`          | The download directory                    |
| `PACERR_AUTH_USERNAME`           | unset                 | Configures the login from the environment |
| `PACERR_AUTH_PASSWORD`           | unset                 | Configures the login from the environment |
| `PACERR_CATALOGUE_INTERVAL_HOURS` | `24`                 | How often the watch page is scraped       |
| `PACERR_FEED_INTERVAL_MINUTES`   | `15`                  | How often the release feed is polled      |
| `PACERR_ONEPACE_URL`             | `https://onepace.net` | Where the Catalogue and feed come from    |

Authentication is off by default. Setting both `PACERR_AUTH_*` variables turns it on and takes the
account out of Settings; otherwise configure it in **Settings → Security**.
