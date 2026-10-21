# Pacerr

Automated acquisition and library management for [One Pace](https://onepace.net), in the shape of
the \*arr tools you already run.

One Pace recuts One Piece continuously and irregularly. Parts appear months apart, whole Arcs are
re-cut years after their first Batch Release, and most of what the release feed contains is already
superseded. Keeping a local copy current by hand means re-checking a feed, working out which of
several Releases covering the same Part is the one worth having, noticing when something you
already hold has quietly been replaced, and renaming every file into a shape a media server can
parse.

Sonarr cannot help: it is built around broadcast television, and no metadata provider knows what a
One Pace Arc is.

## What it does

- **Shows you the whole Catalogue** — every Arc, how many of its Parts you have, and which ones you
  are missing.
- **Monitors the Arcs you choose.** Monitoring is a standing instruction, so Parts released in
  future are covered without revisiting anything. Nothing is monitored on a fresh install.
- **Picks the best Release for each Part**, against one global Profile: an ordered Resolution
  preference, a preferred Variant, and a Cutoff. The unit is the Part, never the Arc — an Arc
  mid-re-cut gives you the new Parts where they exist and the old Batch Release elsewhere.
- **Hands Releases to a Download Client you already run**, so your seeding, ratio and VPN
  configuration keeps applying. Pacerr never speaks BitTorrent itself.
- **Files completed downloads into your Library** under a name Jellyfin and Plex parse, hardlinking
  where it can.
- **Notices when a Release you hold is superseded**, acquires the replacement, imports it over the
  old file, and reclaims the download-directory copy.
- **Says when something is wrong** — a broken scrape, an unreachable Download Client, a failed
  import — instead of going quiet.

For files you already have, **Manual Import** brings them in under human confirmation, so adopting
Pacerr does not mean re-downloading a collection.

## Quickstart

You need a qBittorrent that Pacerr did not configure. Pacerr does not ship one.

1. **Grab the compose file** and edit the two bind mounts to point at your media and your download
   directory:

   ```sh
   curl -O https://raw.githubusercontent.com/amdlift/onepace-dl/main/docker-compose.yml
   ```

   ```yaml
   volumes:
     - pacerr-config:/config
     - /srv/media/one-pace:/library # <- your Library
     - /srv/downloads:/downloads # <- the same files qBittorrent writes
   ```

2. **Start it:**

   ```sh
   docker compose up -d
   ```

3. **Open** <http://localhost:8787>. Pacerr scrapes the Catalogue on first boot, so you should see
   every Arc within a few seconds.

4. **Point it at qBittorrent** in **Settings → Download Client**: the WebUI address
   (`http://qbittorrent:8080`), username and password. Press **Test** — it reports which of
   unreachable, banned, wrong credentials or "that is not a Download Client" you are looking at.

5. **Monitor something.** This is the step that is easy to miss: **a fresh install monitors
   nothing**, deliberately, so that starting Pacerr does not immediately queue hundreds of
   gigabytes. Toggle Monitoring on the Arcs you want, or use **Monitor all Arcs** if you want the
   lot. Grabs begin on the next pass.

Check **System** if anything looks wrong. It carries the status of the Catalogue scrape, the feed
poll and the Download Client, and a banner appears on every view while a check is failing.

### If the import fails and the file is nowhere

Almost always this: qBittorrent reports where it put a download using **its own** paths, and Pacerr
looks for that path in **its** filesystem. Mount the download directory at the same path in both
containers, or add a **Remote Path Mapping** in Settings. See
[docs/deployment.md](docs/deployment.md).

## Volumes

| Mount        | Holds                                                     | Set in                             |
| ------------ | --------------------------------------------------------- | ---------------------------------- |
| `/config`    | `pacerr.db` — the Catalogue, Monitoring, Profile, History | `PACERR_CONFIG_DIR`                |
| `/library`   | The Library a media server reads                          | Settings → Directories             |
| `/downloads` | The download directory the Download Client writes into    | Settings → Directories             |

Everything Pacerr must not lose lives in `/config`, so recreating the container loses nothing as
long as that volume survives.

Those two paths are only where the image mounts them. Point Pacerr at an existing layout —
`/zfspool/media/Anime/One Pace`, say — in **Settings → Directories**, and mount it in the container
at whatever path you type there. The setting lives in `/config` and survives being recreated. The
config directory is the exception: Pacerr cannot read a setting out of a database it has not opened
yet, so that one stays an environment variable.

Keep `/library` and `/downloads` **on the same filesystem** if you can. Pacerr hardlinks imports so
a Part does not occupy disk twice while it seeds; across a filesystem boundary it falls back to
copying and tells you it did.

### The user the container runs as

The image runs as **uid 1000**, and does **not** take `PUID`/`PGID` —
[ADR-0007](docs/adr/0007-run-as-a-fixed-uid.md) explains why. Use Compose's own `user:` key instead.
Every bind mount must be writable by whoever you set there. Named volumes need nothing; bind mounts
under rootful Docker want `chown -R 1000:1000`; bind mounts under rootless Podman want
`--userns=keep-id`.

Get this wrong and Pacerr exits at boot naming the path, the uid it is running as, the owner and
mode of the directory, and both fixes. Read `docker logs pacerr`.

## Environment variables

| Variable                          | Default               | Purpose                                                        |
| --------------------------------- | --------------------- | -------------------------------------------------------------- |
| `TZ`                              | `Etc/UTC`             | Zone that History and System timestamps render in               |
| `PORT`                            | `3000`                | Port to listen on inside the container                         |
| `HOST`                            | `0.0.0.0`             | Address to bind                                                |
| `PACERR_CONFIG_DIR`               | `/config`             | Where `pacerr.db` lives                                        |
| `PACERR_LIBRARY_DIR`              | unset                 | Pins the Library, making the Settings field read-only          |
| `PACERR_DOWNLOADS_DIR`            | unset                 | Pins the download directory the same way                       |
| `PACERR_AUTH_USERNAME`            | unset                 | Configures the login from the environment                      |
| `PACERR_AUTH_PASSWORD`            | unset                 | Configures the login from the environment                      |
| `PACERR_FEED_INTERVAL_MINUTES`    | `15`                  | How often the release feed is polled                           |
| `PACERR_CATALOGUE_INTERVAL_HOURS` | `24`                  | How often the watch page is scraped                            |
| `PACERR_ONEPACE_URL`              | `https://onepace.net` | Where the Catalogue and feed come from                         |

The image sets neither `PACERR_LIBRARY_DIR` nor `PACERR_DOWNLOADS_DIR`, because a variable that is
always set would permanently lock both fields. Set one only if you want a deployment to configure
Pacerr from outside: the value then wins, and Settings shows it read-only saying where it came from.

Authentication is **off by default**, so a first run behind a VPN or a reverse proxy is not gated
behind creating an account. Setting both `PACERR_AUTH_*` variables turns it on and takes the account
out of Settings; otherwise enable it in **Settings → Security**. There is at most one account, and
no registration flow.

## How your Library ends up looking

Arcs are rendered as seasons and Parts as episodes, in the `SxxEyy` form Jellyfin and Plex parse
without a custom agent. This is the one place Pacerr speaks a media server's vocabulary.

```text
One Pace/
└── Alabasta/
    └── Season 08/
        └── Alabasta - S08E01 - Alabasta 01 [1080p].mkv
```

An Arc's season number is assigned the first time Pacerr sees that Arc and then persisted, never
recomputed from its position in the Catalogue — so an Arc appearing upstream cannot renumber a
Library you already have. Specials and one-off entries take season zero, each with its own episode
number. The template is configurable in Settings.

## What Pacerr costs One Pace

One Pace serves no `ETag` and no `Last-Modified`, and answers a conditional request with the whole
body, so **every poll transfers the whole document**. Pacerr sends the conditional headers anyway
and will take a `304` the day upstream offers one, but today the bytes move:

| Document     | Size    | Default cadence  | Per day |
| ------------ | ------- | ---------------- | ------- |
| Release feed | ~1.9 MB | every 15 minutes | ~180 MB |
| Watch page   | ~5.1 MB | every 24 hours   | ~5 MB   |

Roughly 5.5 GB a month off a volunteer project's servers, almost all of it unchanged. The only
lever is cadence: doubling `PACERR_FEED_INTERVAL_MINUTES` halves the bill, and since One Pace
publishes irregularly and months apart, an hour costs very little in freshness. See
[ADR-0005](docs/adr/0005-poll-one-pace-without-conditional-requests.md).

## Documentation

- [docs/deployment.md](docs/deployment.md) — Remote Path Mappings, the startup checks and what each
  diagnostic means, filesystem layout
- [GLOSSARY.md](GLOSSARY.md) — the vocabulary, which is binding on the code and not just the prose
- [docs/adr/](docs/adr/) — the decisions that constrain this codebase and why

## Scope

Pacerr manages One Pace. It is not a general downloader and does not grow abstractions
anticipating one. It ships no Download Client, implements only qBittorrent, has one Profile and at
most one account, and does not transcode, serve or play anything — it produces a Library, and a
media server reads it.

## Legal posture

One Pace distributes fan re-cuts of licensed anime. Pacerr automates acquiring them in the same way
and to the same degree that Sonarr automates acquiring television. This is noted so nobody
discovers it as a surprise.

## Licence

[MIT](LICENSE).
