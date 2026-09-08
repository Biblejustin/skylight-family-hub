# Run Family Hub on a NAS

NAS runs the server. Skylight, a Pi, tablet, or touchscreen opens its display URL. The Mac can be off. Public Apple Shared Album slideshows fetch directly from Apple; no Mac, Photos app, or Apple login is required on the server.

Use a NAS with Docker Engine + Docker Compose v2 and a supported 64-bit Linux CPU: x86-64 or ARM64. Build this source on the target architecture. The image installs Linux versions of Next.js/SWC, sharp, and other dependencies; copying a Mac standalone bundle or `node_modules` will not work. Building needs several GB of free RAM and Internet access. Runtime needs Internet access for calendar feeds and cloud photos.

## QNAP command-line setup

Install and start **Container Station** through the NAS interface. On the tested QNAP, Docker and Compose were installed but absent from the SSH shell's default command path. Locate the installed package instead of hardcoding a storage path:

```sh
qnap_container_station_path="$(getcfg container-station Install_Path -f /etc/config/qpkg.conf)"
if [ -n "$qnap_container_station_path" ] && [ -d "$qnap_container_station_path/bin" ]; then
  export PATH="$qnap_container_station_path/bin:$PATH"
fi
docker version
docker compose version
```

This changes only the current shell's command path. Use an account authorized to manage Docker on the NAS. If discovery returns no path, check Container Station's installation before continuing. Other NAS vendors provide their own Docker package and shell setup.

## New installation

On the NAS, clone this customized source and build locally:

```sh
git clone https://github.com/Biblejustin/skylight-family-hub.git
cd skylight-family-hub
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

If Git is unavailable on the NAS, open the [public repository](https://github.com/Biblejustin/skylight-family-hub), choose **Code → Download ZIP**, and extract the clean source into a NAS project folder. In the SSH shell, change into the extracted directory containing `compose.yaml`, then run the same Compose commands starting with `docker compose config --quiet`. Build from this source ZIP, not a personal runtime bundle containing Mac dependencies or family data. For a migration, follow the import steps below before the first `docker compose up`.

Open `http://NAS-ADDRESS:3000/editor`. New installs receive empty Calendar, Chores, and Photos screens. **Set a parent password in Settings → Security before adding private feeds.** Authentication starts disabled on an empty data volume; no default password or account is supplied. Migrated installs keep their existing password.

Use `/editor` for configuration, `/remote` for controls, and the private display link from Security settings for the Skylight browser. Treat that link and calendar feed URLs as credentials. Keep this service on the trusted home network; do not forward its port to the Internet. The kid chore interface permits household users to complete chores without individual accounts.

Optional `.env` beside `compose.yaml`:

```dotenv
TZ=America/Chicago
HUB_PORT=3000
# Set to one NAS LAN address to narrow the listening interface, if desired.
HUB_BIND_ADDRESS=0.0.0.0
```

`TZ` seeds a new installation's app timezone. Existing configurations retain their saved timezone; change that in the editor if needed. Change `HUB_PORT`, not the container's internal port. Reserve the NAS's address in the router so display bookmarks remain stable.

## Persistent storage

With the default project name, Compose creates `family-hub_hub-data` and `family-hub_hub-backgrounds` named volumes. A custom Compose project name changes both prefixes; use that same project name for every build, import, start, update, and backup command.

| Container path | Contents |
| --- | --- |
| `/app/data` | All configuration, calendar links, credentials, display token, members, chore schedules/completions, point balances, rewards/redemptions, plugins, and caches |
| `/app/public/backgrounds` | Uploaded photos/videos and backgrounds |

The process runs as UID/GID `1000:1000`. Fresh named volumes inherit the image's correct ownership. If replacing them with NAS folder mounts, grant that UID read/write access to those two folders; never use `chmod 777`. Mounting an empty folder over backgrounds hides the bundled stock backgrounds.

Run one server instance against these volumes. Storage uses JSON files with process-local write serialization. Do not share the same volumes between replicas. `docker compose down` keeps data; **do not use `down -v`** unless intentionally deleting it.

## Migrate the existing installation

Stop the old server before taking the final copy, so chores, balances, and redemptions form one consistent snapshot. Keep the original folders untouched for rollback. Transfer both complete directories privately to a new `migration` folder beside this source:

```text
migration/
  data/          ← entire old data directory, including hidden files
  backgrounds/   ← entire old public/backgrounds directory
```

These folders contain credentials and family records. Keep them out of Git, public shares, and image registries. Do not export only config or re-create members: the whole data directory preserves identifiers, point history, rewards, authentication, and feed links. Source build context excludes this migration folder and all runtime data.

Build the image, then import as the container user **before the first `up`**. Use new volumes for both data and backgrounds. The command below refuses a destination with existing data and never logs file contents. Its backgrounds copy merges over bundled stock assets, so do not reuse a backgrounds volume containing another installation's uploads; an empty data volume alone does not establish that both destinations are unused.

```sh
docker compose build
docker compose run --rm --no-deps \
  --volume "$PWD/migration:/migration:ro" \
  --entrypoint node family-hub --input-type=module -e '
import { readdir, access, cp, chmod } from "node:fs/promises";
import { constants } from "node:fs";
await access("/migration/data/config.json", constants.R_OK);
await access("/migration/backgrounds", constants.R_OK);
if ((await readdir("/app/data")).length) throw Error("Destination data is not empty; import cancelled.");
await cp("/migration/backgrounds", "/app/public/backgrounds", { recursive: true, force: true, dereference: true });
for (const entry of await readdir("/migration/data")) {
  await cp("/migration/data/" + entry, "/app/data/" + entry, { recursive: true, force: false, errorOnExist: true, dereference: true });
}
await chmod("/app/data", 0o700);
console.log("Migration copied. Start server and verify before retiring old host.");
'
docker compose up -d
docker compose ps
```

The copy runs as UID 1000, so migrated files belong to the server. The temporary migration share must allow that UID to read the transferred files; use a private NAS ACL or adjust ownership rather than making secrets world-readable. If the copy fails, leave the server stopped, preserve both original folders, and inspect the incomplete destination before retrying.

Log in and verify members, balances, completed chores, rewards, calendar events, photos, and display controls. Set the Skylight start URL to the NAS host/port while retaining the existing private display token; do not paste the token into logs or this guide. Cookies may require a fresh login on the new hostname. Keep the old server stopped once the NAS becomes authoritative.

## Updates, backups, and limitations

Back up both named volumes with the server stopped. Restore them together. NAS snapshots or volume backups preserve credentials; a settings-only export may omit them.

Update this customized source deliberately, back up volumes, then run:

```sh
docker compose build
docker compose up -d
```

Use Docker/NAS controls for restart and recovery. The upstream in-app OS updater and script-based backup/restore are unavailable: their deployment scripts are omitted, and application code is read-only. Update notices may still appear. Do not install upstream kiosk/update timers or replace the image with an upstream release; that would discard the custom chore/calendar behavior. Pi Wi-Fi, hostname, reboot, and systemd controls do not manage the NAS from this container.

The health check confirms the HTTP app and auth-state reader respond; it does not prove that external calendar/photo services are reachable. `restart: unless-stopped` recovers exited processes; Docker does not automatically restart an otherwise running container solely because it becomes unhealthy. Inspect status with `docker compose ps` and recent logs with `docker compose logs --tail=100 family-hub` before restarting.

The repository's Docker smoke-test workflow builds on Linux and checks fresh startup, initializer preservation, and both persistent volumes using synthetic data. It publishes no images. Check that workflow's result before deploying.

The source has now been built and started on an x86-64 QNAP NAS. Private migration preserved all imported data/background file hashes. The nonroot container remained healthy after recreation, protected files persisted, and existing authentication, calendar feeds, photos, remote controls, and the physical Skylight interface worked with the Mac server stopped. The screen also returned to the NAS calendar after a hands-free Android reboot with its documented per-app compatibility setting. See [Validation record](VALIDATION.md) for completed checks and platform limits. Other NAS products and ARM64 still need their own validation.
