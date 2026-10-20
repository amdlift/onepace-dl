# Run as a fixed uid rather than honouring PUID/PGID

Pacerr's image runs as `node`, uid 1000, declared with `USER node` in the Dockerfile. It does not
read `PUID` or `PGID`. Anyone needing a different uid sets it from outside — `user: "1000:1000"` in
Compose, or `--user` on `docker run`.

## Why this is surprising

Every linuxserver.io image — Sonarr, Radarr, qBittorrent, the whole family Pacerr's users already
run — takes `PUID`/`PGID`, and the README of each tells you to set them. Arriving here from that
world, their absence looks like an oversight, and the obvious "fix" is to add them.

## Why we did not

Honouring `PUID`/`PGID` means the container must **start as root**, read the variables, `chown` the
mounts, and only then step down to the requested user. That is how the linuxserver images do it,
and it is the opposite of `USER node`: the process begins with full privileges inside the container
and relies on an entrypoint to drop them correctly.

Pacerr does not need that. It opens a SQLite database, reads and writes two directories, and talks
HTTP. Starting as root to arrive at an unprivileged process is a meaningful amount of attack
surface in exchange for ergonomics that Docker and Compose already provide natively.

The alternative costs the user one line, and that line is more honest about what is happening:

```yaml
user: "1000:1000"
```

## Consequences

- **The failure mode has to be excellent**, because this choice pushes work onto the user. It is:
  Pacerr validates all three directories at boot and, for `/config`, exits with the path, the uid
  it is running as, the owner and mode of the directory, and both fixes. Before that check existed
  the same misconfiguration produced only `SqliteError: unable to open database file`.
- **Rootless Podman needs `--userns=keep-id`**, because a bind mount there appears owned by `0:0`
  inside the container. Named volumes sidestep it entirely.
- **If this is ever revisited**, the thing to weigh is not convenience but whether a root-capable
  entrypoint is acceptable. Adding `PUID`/`PGID` without starting as root is not possible; a
  proposal that claims otherwise has misunderstood the mechanism.
