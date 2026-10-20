# Delegate transfers to an external download client

Pacerr never speaks BitTorrent itself. It resolves a Release to a magnet URI or `.torrent` URL and
hands it to an external daemon over that daemon's HTTP API, then polls for completion — the model
Sonarr uses. qBittorrent is the only implementation we ship, behind a `DownloadClient` interface so
Transmission or Deluge can be added without touching the scheduler or importer.

## Considered Options

- **Embed a BitTorrent engine in Pacerr.** One container, nothing to configure. Rejected because it
  makes us responsible for seeding, ratio rules, DHT, port forwarding, resume state and VPN binding —
  a large surface that users already solve with a dedicated client they trust.
- **HTTP-fetch from the Pixeldrain mirrors and skip BitTorrent entirely.** Far simpler, and the feed
  does carry Pixeldrain links. Rejected because `pixeldrainHref` is absent on a significant fraction
  of Releases, so coverage would be incomplete and silently so, and it contributes nothing back to
  the swarm.

## Consequences

A working deployment is always at least two containers. The download directory must be mounted at
the *same path* in both containers, otherwise the paths the client reports back are meaningless to
Pacerr's importer. This is the most common way a Sonarr-style setup breaks, so it is a documented
constraint of the compose file rather than something to detect at runtime.
