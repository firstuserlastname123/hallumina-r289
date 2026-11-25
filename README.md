# Hallumina r289

A self-hosted revision **289** server built from pinned LostCityRS Engine-TS
and Content, with authenticated local gameplay and the original rs2b0t/MultiBox.

| Directory | Purpose |
| --- | --- |
| `engine/` | LostCityRS/Engine-TS, branch `289` (submodule) |
| `content/` | LostCityRS/Content, branch `289` (submodule) |
| `rs2b0t/` | rs2b2t/rs2b0t, branch `main` (submodule) |
| `hallumina/` | Hallumina configuration and future extensions |
| `scripts/` | Pin verification, frozen installs, isolated runtime and smoke checks |
| `docs/` | Installation, validation evidence and compatibility policy |

Exact commits and tool versions are in [the compatibility manifest](hallumina/compatibility.json).
Upstream source and license files remain in their submodules. See
[license notes](docs/licenses.md).

## Start developing

Requires Linux, Node **24.22.3**, npm **11.19.1**, Bun **1.4.5**, Git, tar and
the native prerequisites in [installation](docs/installation.md). On the prepared
cloud computer, first `source /workspace/.hallumina-env/env.sh`.

```sh
git clone --recurse-submodules https://github.com/firstuserlastname123/hallumina-r289.git
cd hallumina-r289
# Also required after switching to a commit that changes gitlinks:
git submodule sync --recursive
git submodule update --init --recursive
node scripts/verify-upstreams.mjs
bash scripts/install.sh

# Choose a NEW directory outside this checkout; never point this at production.
export HALLUMINA_RUNTIME_DIR="$(mktemp -d /tmp/hallumina-r289.XXXXXX)/world"
node scripts/runtime.mjs prepare
node scripts/runtime.mjs build
node scripts/runtime.mjs smoke
# Optional authenticated gameplay and original bot deployment, while stopped:
node scripts/accounts.mjs init --offline-sql
node scripts/deploy-rs2b0t.mjs
node scripts/runtime.mjs start
```

Open <http://localhost:8888/rs2.cgi>. Stop with Ctrl+C and wait for
`Server shutdown complete`. `smoke` starts and stops its own server; run it while
the runtime is stopped. Configuration and persistence live in the external runtime,
never the source checkout. Preparation refuses to overwrite an existing directory.
The Hallumina launcher confines upstream TCP/HTTP/WebSocket services and workers
to IPv4 loopback. Always use this launcher; direct upstream entrypoints bind all
interfaces. This remains a local development setup, with no public deployment.

Read [development guidance](docs/development.md), [rs2b0t setup](docs/rs2b0t.md),
[validation results](docs/validation.md) and [upgrade policy](docs/upstream-updates.md).
See [authenticated gameplay, fixtures and persistence](docs/gameplay.md) and
[PR #2 acceptance evidence](docs/pr2-validation.md) for tested behavior and limits.
