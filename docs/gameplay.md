# Authenticated local gameplay and persistence

Use disposable local accounts only. See [PR #2 evidence](pr2-validation.md) for
the actual scope tested. All commands below run from the parent repository root.

## Prepare and provision

```sh
source /workspace/.hallumina-env/env.sh  # prepared Cloud; omit on your Ubuntu VM
git submodule sync --recursive
git submodule update --init --recursive
node scripts/verify-upstreams.mjs
bash scripts/install.sh
export HALLUMINA_RUNTIME_DIR="$(mktemp -d /tmp/hallumina-gameplay.XXXXXX)/world"
node scripts/runtime.mjs prepare
node scripts/runtime.mjs build
node scripts/accounts.mjs init
node scripts/deploy-rs2b0t.mjs
node scripts/verify-deployment.mjs
node scripts/runtime.mjs start
```

Initialize accounts before the first server start. Even an unauthenticated
`runtime.mjs smoke` imports the upstream SQLite connection and creates an empty
database; `accounts.mjs init` correctly refuses to overwrite it. Use a separate
fresh runtime for that bootstrap-only smoke. Do not delete an existing database
to make initialization pass.

Expect `World ready`, followed by loopback listeners for web 8888, management
8898, TCP 43594 and login 43500. Check with `ss -ltn`. Open
<http://127.0.0.1:8888/rs2.cgi>, choose Existing User, and enter a NEW disposable
username (1–12 normalized letters/digits) and password (1–20 characters).
First login provisions the account through upstream LoginServer's existing bcrypt
flow; later logins verify its password. Upstream passwords are case-insensitive.
Choose distinct names/passwords for each account and keep them in a password
manager or private file outside Git. Do not put passwords in command arguments.

The pinned engine uses Kysely with Node's SQLite driver; it needs the tables in
`prisma/singleworld/migrations`, but does not need a generated Prisma client.
`accounts.mjs init` runs upstream `npm run sqlite:migrate`, then enables the native
login worker, normal privilege settings (`production=true`, `debug=false`), and
the local members world with upstream automatic membership. Friend/logger
services remain disabled. The website has no registration service at this pin.
`website.registration=false` means **first-login provisioning**, not password
bypass; `login.enabled=false` is the unauthenticated bootstrap mode and must not
be used for account acceptance.

If Prisma cannot download its binary (Cloud returned HTTP 403 for
`binaries.prisma.sh`), use this alternative on a NEW, stopped runtime:

```sh
node scripts/accounts.mjs init --offline-sql
```

It applies the exact pinned migration SQL in a SQLite transaction and records
Prisma-compatible names/checksums in `_prisma_migrations`. It never ignores
download checksums or changes the schema. Both init modes refuse existing databases
or saves. A failed initialization is left for inspection; choose a new runtime
rather than deleting data. Existing worlds require a stopped backup and a
separately reviewed migration, not `init`, `db:reset` or `sqlite:reset`.

## Tutorial and disposable upstream fixture

Normally complete Tutorial Island using native controls. PR #2 also exercises
the **existing** guide's local skip dialogue, at
`content/scripts/tutorial/scripts/guides/runescape_guide.rs2`. This is a test
fixture, not evidence of tutorial completion through all its mechanics.

For this fixture only, stop and back up the disposable runtime, edit its
`engine/data/config/world.json` to set `node.production=false`, then explicitly run:

```sh
HALLUMINA_UPSTREAM_TUTORIAL_FIXTURE=1 node scripts/runtime.mjs start
```

Accept character design, talk to the RuneScape Guide, Continue, and choose
“Yes please.” to skip. The unchanged content gives starter items, sets tutorial
state, moves the character to Lumbridge and puts 25 coins in its bank. These
items/state are fixture grants, never earned-XP evidence. No save editing,
teleport commands, `give`, `maxme` or injected character state is involved.
Upstream grants developer privileges while `production=false`, so use only these
disposable accounts. Log out, stop normally, restore `node.production=true`,
unset the fixture variable, and restart **before measuring gameplay**. The
launcher refuses this mode without the explicit environment flag. There is no
default template change and authentication remains enabled throughout.

## Saves, shutdown and restart

Use the native Logout tab/button, then Ctrl+C in the server terminal. Wait for
`Server shutdown complete` and exit 0; the login worker remains alive until the
world has acknowledged its save writes. Start the **same** runtime again with
`node scripts/runtime.mjs start`, and use the same account/password. Upstream
autosaves every 1,500 ticks (15 minutes); logout is the faster explicit save gate.

Persistence consists of `engine/db.sqlite` (bcrypt account hashes, memberships,
sessions, login locks and hiscores) and `engine/data/players/main/*.sav` (location,
inventory, XP, levels, permanent quest/tutorial variables). Keep
`engine/data/config/` with the keys/configuration and published client/cache in
the same backup. Source `node_modules` is shared; never reinstall dependencies
under an active runtime.

```sh
# Stopped world only. The read-only inspector uses the original save loader.
node scripts/persistence.mjs inspect DISPOSABLE_USERNAME > /tmp/character-before.json
# Play normally, log out and stop; record the earned state.
node scripts/persistence.mjs inspect DISPOSABLE_USERNAME > /tmp/character-after-action.json
node scripts/runtime.mjs start
# Reconnect the same account, log out and stop normally, without new actions.
node scripts/persistence.mjs inspect DISPOSABLE_USERNAME > /tmp/character-after-restart.json
node scripts/compare-persistence.mjs /tmp/character-after-action.json /tmp/character-after-restart.json
node scripts/persistence.mjs backup /absolute/NEW/private-backup

# Restore a complete snapshot into a different NEW external directory.
export HALLUMINA_RUNTIME_DIR=/absolute/NEW/restored-world
node scripts/restore.mjs /absolute/private-backup
node scripts/verify-deployment.mjs  # if the snapshot includes bot deployment
node scripts/runtime.mjs start
```

Backups contain secrets and saves. Keep their directories private (0700), encrypt
them for transfer, and never commit them. Restore reconnects the installed Engine
dependencies and checks SQLite integrity. It refuses an existing destination.
Never copy a different world's database or saves over a live runtime. Do not run
the original and restored world on the same ports. Operation locks and listener
probes protect builds, deployment, init, backup and start; after a crash, inspect
processes and `ss -ltn` before manually removing a stale operation lock.

## Repeat browser acceptance on Cloud or Ubuntu

For automated original-script Woodcutting, banking and save/restart acceptance,
stop other local worlds and run the following after the locked install:

```sh
source /workspace/.hallumina-env/env.sh  # prepared Cloud only
export HALLUMINA_RUNTIME_DIR="$(mktemp -d /tmp/hallumina-script.XXXXXX)/world"
node scripts/script-acceptance.mjs --offline-sql
```

Omit `--offline-sql` to use the upstream Prisma migration CLI. The harness owns
only a **new** external runtime, builds its real cache and local rs2b0t bundles,
creates private random credentials, completes the supported guide-skip dialogue,
logs out and restarts in normal production mode before measuring gameplay.
It records the fixture grants separately, including its net/tools, food, runes
and 25 banked coins; no logs or Woodcutting XP are granted.

The original Woodcutter navigates to ordinary Lumbridge trees near 3233,3245,
earns at least two logs with 25 XP each, then restarts with banking enabled and
Varrock East selected. The harness checks the real bank and deposit-side
inventory, conserves **all** item quantities and retains the axe. It logs out,
stops the world, reads the authoritative save with the upstream loader, restarts
the same runtime, reconnects and compares saves. Native authentication,
wrong-password rejection and actual two-profile MultiBox checks run afterward.

Scene/login, runner state, native tick progress, gathering (180 seconds), bank
travel/deposit (240 seconds), shutdown and subprocess stages have explicit
deadlines. A stopped/crashed runner or stalled client fails with diagnostics.
JSON, script samples, server/build logs, credentials (0600) and screenshots stay
under the private external `${HALLUMINA_RUNTIME_DIR}-acceptance/` directory.
Failures retain their runtime and evidence; choose a new path for another run.
The test refuses an existing runtime and never accepts real-player credentials.

Add `--fisher` for a bounded diagnostic after the completed save comparison.
It records original automatic net restocking and a bounded Al Kharid shore trial,
including bank/inventory snapshots, gear planning, combat clocks, fishing spots,
runner logs and the final save. Restocking uses the banked Woodcutter account;
gathering uses a second fresh mainland account to avoid long bank-to-shore
transit obscuring the fishing diagnosis. If needed, native net withdrawal is a separately
labelled diagnostic control. The measured freeform shore trial took combat
damage and died without fishing XP; it is not a validated novice training route.
Fisher failure remains explicit in its evidence and does not replace or
indefinitely delay the Woodcutting/banking results.

Install/use your system Chromium, with the locked `playwright-core` from rs2b0t.
Start the authenticated runtime in terminal 1. In terminal 2, export the same
runtime and a private external credentials-file path:

```sh
export HALLUMINA_CHROMIUM_BIN=/usr/bin/chromium
export HALLUMINA_CREDENTIALS_FILE=/tmp/hallumina-disposable-credentials.json
node scripts/browser-acceptance.mjs native
node scripts/browser-acceptance.mjs bot
node scripts/browser-acceptance.mjs multibox
```

The first run creates two random disposable credentials (0600) without printing
them. Reuse this file; do not rerun with real accounts. The harness never prints
credentials or browser storage. MultiBox profiles go through the actual encrypted
vault/profile UI. Checks cover server-confirmed authentication, wrong-password
rejection, rendered bot scene, required cache assets, distinct concurrent player
slots, logout/reconnect and JS errors. Screenshots and JSON stay in the external
runtime. Inspect screenshots and perform native interactions/script trials as
described in [rs2b0t](rs2b0t.md); these auth checks alone do not establish XP,
banking, save/restart equality or unattended reliability.

For persistence acceptance, record location, inventory, XP, levels and permanent
variables, perform a normal action, log out, inspect the save, stop/restart the
same runtime, reconnect and compare again. The inspector reports XP in **tenths**;
the browser reader reports ordinary XP. Playtime and login timestamps can change.
Retain both snapshots instead of resetting a world when a comparison fails.
The comparison permits only the native `last_logout` world-clock update while
comparing the other permanent variables exactly; normal quest progress must not
be performed between the two restart-only comparison snapshots.

## Troubleshooting

- “RuneScape has been updated” (login response 6) can mean wrong revision, cache
  CRC or RSA. Verify pins, runtime revision, current cache and deployed hashes.
  PR #1's native RSA field replacement reversed the bundle's `(modulus, exponent)`
  call. New preparation fixes this; for an old **stopped** runtime, run
  `node scripts/sync-native-rsa.mjs` once. It backs up the old native asset and
  preserves keys/database/saves. It does not permit repeated backup overwrite.
- Never copy private keys into bundles. If keys genuinely change, build a new
  runtime/deployment; both bot `LOCAL_*` and stock `LOGIN_*` must use the public pair.
- A title screen, TCP greeting or HTTP 200 does not establish authentication.
  Check upstream account-login state, actual world rendering and saves.
- Blank/old inventory immediately after scene load is transient: inventory/varp
  packets follow `sceneState=2`. Wait for stats and subsequent updates before
  comparing state. Keep a native page foregrounded and hover before clicking a
  scene/menu target so its frame has time to build the contextual action.
- Do not proxy management, login, registration or debug endpoints. The launcher
  restricts all upstream listeners to loopback; no firewall rules are changed.
  On Ubuntu, use the browser on that VM (or a deliberate local SSH tunnel for
  the game web port only). No public reverse proxy is part of this procedure.
