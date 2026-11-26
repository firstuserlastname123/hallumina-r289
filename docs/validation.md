# PR #1 validation evidence

This is historical PR #1 evidence. See [PR #2 validation](pr2-validation.md) for
authenticated gameplay, persistence, deployment and MultiBox results. PR #2 also
corrects the native RSA argument-order defect that PR #1's welcome-screen check
could not detect.

Validated 2026-11-25 on the existing Debian 13 x86_64 cloud computer, using
Node 24.22.3, npm 11.19.1 and Bun 1.4.5. The computer exposes about 9.7 GiB RAM;
its cgroup limit is 8 GiB, with no swap. No resource limit prevented this PR's
startup or browser-loading checks. No global toolchain was recreated.

## Revisions tested

| Submodule | Upstream branch | Exact commit |
| --- | --- | --- |
| Engine-TS | LostCityRS/Engine-TS `289` | `ddd01b3f32f0a04a18f05a468da962f57d0a1708` |
| Content | LostCityRS/Content `289` | `a60809082bc9f8fbdaa00c7b1a1d3fd6134c18fe` |
| rs2b0t | rs2b2t/rs2b0t `main` | `27e57fa331656df5a0d9b7b1cd1f4ec0c44519bb` |

Each was cloned directly from the URL in `.gitmodules`, its exact commit object
resolved, and its membership in `origin/289` or `origin/main` checked before
pinning. Remote origins and matching gitlinks were checked again after installs.
No upstream commit, lockfile or source file was changed.

## Results by test category

| Category | Command/check | Result |
| --- | --- | --- |
| Toolchain only | `bash /workspace/.hallumina-env/validate.sh` | PASS: typed compression/crypto, C++ N-API addon with OpenSSL/zlib on Node and Bun; Bun fixture 3 pass |
| Reproducible install | `bash scripts/install.sh` | PASS: Engine npm ci (346 packages), rs2b0t frozen Bun install (169 packages checked), Content requires no install |
| Pin/source verification | `node scripts/verify-upstreams.mjs` | PASS: origins, branches/ancestry, all exact commits, index gitlinks and clean source |
| Fresh clone path | Recursive clone, `install.sh`, new runtime prepare/build/smoke | PASS: all exact gitlinks initialized, frozen installs, full build (15.957 seconds), startup/shutdown, clean source |
| Engine TypeScript | `cd engine && node node_modules/typescript/bin/tsc --noEmit` | PASS with locked TypeScript 5.8.3 |
| Engine lint | `cd engine && npm run lint` | PASS, 0 errors, 13 existing warnings |
| Engine application build | `node scripts/runtime.mjs build` | PASS: full content/cache/RuneScript pack, initial build 21.268 seconds |
| Engine unit suite | Manifest inspection | No packaged unit-test script; no fabricated substitute claim |
| Content test scripts | Cache compilation | Packed with content; in-game fixture behavior NOT executed |
| rs2b0t TypeScript | `cd rs2b0t && bun run typecheck` | PASS with locked TypeScript 5.9.3 |
| rs2b0t lint | `cd rs2b0t && bun run lint` | PASS |
| rs2b0t unit suite | `cd rs2b0t && bun test` | PASS: 12,456 pass, 355 upstream skips, 0 fail, 853 files, 97.55 seconds |
| rs2b0t bundles | `cd rs2b0t && bun run build && TARGET=local bun run build:bot` | PASS; default public RSA values, build validation only |
| Native startup/protocol | `node scripts/runtime.mjs smoke` | PASS: cache/scripts, world ready, web/assets, r289 config, TCP handshake, graceful SIGTERM/exit 0 |
| Browser client loading | `node scripts/browser-smoke.mjs` with system Chromium | PASS: welcome screen visually inspected, canvas/cache downloads, no page errors; background extra-file prefetch still running |
| Native gameplay/login/saves | Not run | DEFERRED: no account-backed or in-game acceptance established |
| Bot gameplay/MultiBox | Not run | DEFERRED to PR #2; no production accounts or live bots used |

The native startup loaded **12,385 scripts** and **8,141 static NPCs**. Web
`/rs2.cgi`, native JS/worker/WASM assets and cache CRC returned HTTP 200.
Management `/setup/config` returned `engine.revision: 289` and
`build.srcDir: ../content`. The TCP smoke sent only login opcode 14 and a server
selector, then checked the 17-byte greeting with success byte 0. It sent no
credentials and created no account. It checked `Server shutdown complete` and
exit 0. This does not test the credential/login phase of the protocol.

The browser check loaded native title, config, interface, media, textures,
wordenc, sounds and versionlist archives from the local server. Its screenshot
shows “Welcome to RuneScape” with New User / Existing User controls. It did not
enter an account or the game world. No Java/JAR client run was attempted.

## Failed attempts and resolution

- The first plain `bun install --frozen-lockfile` failed in `@vvago/vale`'s Node
  postinstall with `getaddrinfo EAI_AGAIN github.com`. Retrying without a change
  failed identically. Its downloader uses Node HTTPS and needed the environment's
  proxy. `NODE_USE_ENV_PROXY=1 bun install --frozen-lockfile` passed, and that
  setting is now in `install.sh`. TLS/integrity checks remain enabled.
- Before Vale was available, the full unit run had 12,415 pass, 355 skip and 35
  failures involving the missing prose-linter binary. After the install fix the
  full unmodified suite passed as recorded above. No test was disabled or edited.
- A dependency reinstall overlapped one temporary browser server and removed
  loader files while its workers started, producing `ERR_MODULE_NOT_FOUND` for
  tsx. That temporary server was stopped. The browser check was rerun after the
  completed frozen install on a clean server, with no runtime errors, then a
  normal shutdown/exit 0. Do not reinstall dependencies under an active runtime.
- npm 11 reports that Prisma/esbuild lifecycle scripts are not yet covered by
  allowScripts. The native build and startup passed without changing manifests
  or approving extra lifecycle hooks. Database migrations remain untested.

## Reproduction commands

From the repository root:

```sh
source /workspace/.hallumina-env/env.sh  # prepared Cloud only
git submodule sync --recursive
git submodule update --init --recursive
node scripts/verify-upstreams.mjs
bash scripts/install.sh
(cd engine && node node_modules/typescript/bin/tsc --noEmit && npm run lint)
(cd rs2b0t && bun run typecheck && bun run lint && bun test)
(cd rs2b0t && bun run build && TARGET=local bun run build:bot)
export HALLUMINA_RUNTIME_DIR="$(mktemp -d /tmp/hallumina-r289.XXXXXX)/world"
node scripts/runtime.mjs prepare
node scripts/runtime.mjs build
node scripts/runtime.mjs smoke
# In terminal 1:
node scripts/runtime.mjs start
# In terminal 2, with the same environment and runtime path:
node scripts/browser-smoke.mjs
# Stop terminal 1 with Ctrl+C and wait for clean shutdown.
git diff --check
git submodule foreach --recursive 'git status --short'
```

Ubuntu prerequisites and the same application commands are in
[installation](installation.md). Runtime preparation also passed direct guard
checks: an existing runtime was rejected without changing its key; a checkout
destination and a symlink alias into the checkout were rejected; generated
private-key/directory permissions were 0600/0700; the staged native bundle's
public RSA constants matched the generated server pair.

Disposable run artifacts were outside the repository at
`/tmp/hallumina-pr1-native/` (`startup-smoke.log`, `native-client.png`, generated
cache/config/keys). Application logs were under `/tmp/hallumina-*.log`. These are
ephemeral local evidence, not required dependencies or committed artifacts.

The independent fresh-clone check used:

```sh
git clone --no-hardlinks --recurse-submodules --branch feat/r289-bootstrap \
  /workspace/hallumina-r289 /tmp/hallumina-pr1-fresh-clone
cd /tmp/hallumina-pr1-fresh-clone
node scripts/verify-upstreams.mjs
bash scripts/install.sh
export HALLUMINA_RUNTIME_DIR=/tmp/hallumina-pr1-fresh-runtime
node scripts/runtime.mjs prepare
node scripts/runtime.mjs build
node scripts/runtime.mjs smoke
git status --short
git submodule foreach --recursive 'git status --short'
```

The parent was cloned locally from the committed feature branch; all three
submodules were independently cloned over HTTPS from their upstream URLs. Both
the parent and submodules were clean after the check. The second runtime was
external, used a separate fresh RSA pair and shut down with exit 0.

## Remaining acceptance work

PR #2 must evaluate account storage/migrations and a disposable local account,
native login/logout/reconnect, walk/actions/combat/bank/dialogue, save/restart/load
round trips, rs2b0t collision/basemap deployment, matching RSA in both bundles,
bot login/functionality and MultiBox. None is claimed by PR #1's passing builds,
unit tests or welcome screen. The standalone local rs2b0t deployment procedure
is documented from pinned upstream scripts but has not been executed in full.
