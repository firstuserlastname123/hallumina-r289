# Installation and isolated native server

## Toolchain

The existing cloud setup is `/workspace/.hallumina-env/README.md`. Verify and
source its configuration instead of reinstalling global tools:

```sh
test -f /workspace/.hallumina-env/env.sh
source /workspace/.hallumina-env/env.sh
node --version  # v24.22.3
npm --version   # 11.19.1
bun --version   # 1.4.5
```

If that file is missing, read the saved README and locate its generated toolchain
before continuing. Application commands use package-local tools. The Engine npm
lockfile resolves TypeScript 5.8.3 and tsx 4.23.12; the saved global TypeScript is
5.9.3 and global tsx is 4.23.15. rs2b0t's lock resolves TypeScript 5.9.3.

For a separate Ubuntu 24.04 development machine, install prerequisites, then
provide the exact Node/npm/Bun versions in the compatibility manifest using your
normal toolchain manager. Check versions before installing application packages.
No Docker, Java, global Prisma or global TypeScript install is required for this
browser-native-client path.

```sh
sudo apt-get update
sudo apt-get install -y git build-essential pkg-config python3 libssl-dev \
  zlib1g-dev curl ca-certificates xz-utils unzip openssl
# After provisioning the pinned Node/npm/Bun tools:
node --version
npm --version
bun --version
git clone --recurse-submodules https://github.com/firstuserlastname123/hallumina-r289.git
cd hallumina-r289
git submodule sync --recursive
git submodule update --init --recursive
node scripts/verify-upstreams.mjs
bash scripts/install.sh
```

`install.sh` runs `HUSKY=0 npm ci` in Engine and `bun install --frozen-lockfile`
in rs2b0t. Content has no root or nested package manifests at this pin. Lockfiles
are upstream-owned and remain unchanged. Do not use upstream `npm start` or
`npm run setup` as an install shortcut: they run unfrozen `npm install`.

The rs2b0t trusted `@vvago/vale` postinstall downloads its pinned prose-linter
binary from GitHub releases. Managed Cloud requires `NODE_USE_ENV_PROXY=1` for
that Node HTTPS download, which `install.sh` supplies. It preserves configured
proxy/CA settings and TLS verification. No lifecycle scripts are disabled to hide
test failures. npm 11 reports unapproved Prisma/esbuild lifecycle scripts; the
Linux binaries used by the validated build work without changing allowScripts.
Account-backed SQLite setup and migration options are in [gameplay](gameplay.md).

Never run dependency installation while a runtime is active: the runtime shares
the source Engine's `node_modules`, and reinstalling it can break worker imports.

## Prepare, build and start

```sh
export HALLUMINA_RUNTIME_DIR="$(mktemp -d /tmp/hallumina-r289.XXXXXX)/world"
node scripts/runtime.mjs prepare
node scripts/runtime.mjs build
node scripts/runtime.mjs smoke
node scripts/runtime.mjs start
```

Preparation exports **tracked pinned snapshots** into a new directory outside
the checkout, keeping Engine and Content siblings. These runtime exports are
untracked; the parent repository stores only gitlinks. Builds run against the
export, so pack generation cannot dirty an upstream submodule. The runtime uses a
symlink to the Engine's installed dependencies; it is not a relocatable release.

Preparation excludes the published upstream private/public development keys and
creates a fresh 1024-bit RSA pair with exponent 65537 for local protocol
compatibility. It substitutes only the two public decimal RSA constants in the
**staged** prebuilt native client. The pinned modulus/exponent call site must
occur exactly once or preparation fails. This keeps the source submodule untouched and the staged
client/server parameters aligned. This is a legacy local-development protocol,
not a production cryptography configuration. No private key enters Git or logs.

The runtime directory is mode 0700, key files are 0600. Existing directories are
never overwritten. If preparation fails, inspect that directory and select a new
one; the wrapper does not delete or reset existing persistence. Keep a deliberate
external state directory instead of `/tmp` for longer-lived local experiments.

Visit <http://localhost:8888/rs2.cgi>. Ctrl+C or SIGTERM initiates upstream's normal
shutdown; wait for `Server shutdown complete` and exit 0. Do not delete a runtime
while it is running. Native Java applet/JAR launch is not tested or provided by
this PR; the upstream prebuilt browser client is the validated native client.

## Configuration and persistence

Edit `$HALLUMINA_RUNTIME_DIR/engine/data/config/world.json` while stopped. The
secret-free template explicitly sets revision 289, `../content`, normal XP, no
support servers, no registration, no debug editor and no live repacking. The
upstream config loader merges omitted fields with its defaults. It does not
override `world.json` with process environment variables.

Default listeners are web 8888, management 8898 and native TCP 43594. Upstream
hard-codes `0.0.0.0`; the Hallumina launcher confines the app and workers to
`127.0.0.1`. Direct upstream entrypoints lack this restriction. Management
includes unauthenticated configuration endpoints and must stay private. The
startup smoke refuses Cloud-reserved ports and occupied listeners. Use distinct
private ports in world.json if the defaults are occupied.

Keys/config are under runtime `engine/data/config/`, potential saves under
`engine/data/players/`, and SQLite under runtime `engine/db.sqlite`. The initial
smoke uses no game accounts, creates no account database and leaves the three
support services disabled. Run the separate stopped `node scripts/accounts.mjs init`
(or `init --offline-sql`) for native authentication. See [gameplay](gameplay.md)
for first-login provisioning, fixtures, backups and acceptance checks.

## Native browser-loading check

With the server running in a second terminal and a local Chromium installed:

```sh
# On Ubuntu, supply your existing Chromium executable (snap paths may differ).
export HALLUMINA_CHROMIUM_BIN=/usr/bin/chromium
node scripts/browser-smoke.mjs
```

This uses rs2b0t's locked `playwright-core`, blocks nonlocal HTTP requests,
checks native cache downloads/canvas/errors, and writes
`$HALLUMINA_RUNTIME_DIR/native-client.png`. Inspect it for the welcome screen.
The check does not log in. It needs a system Chromium; installing Bun dependencies
does not download a browser. A JavaScript compile, screenshot or protocol
handshake does not prove login, save round trips or gameplay actions.
