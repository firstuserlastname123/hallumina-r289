# Preparing the original rs2b0t client

The pinned source is the original `rs2b2t/rs2b0t` main commit
`27e57fa331656df5a0d9b7b1cd1f4ec0c44519bb`. Its scripting API, script library and
browser/MultiBox UI remain upstream-owned; no replacements are introduced here.
Its README identifies rs2b2t as the supported gameplay target. Shared revision
289 does not establish compatibility with unmodified LostCity content.

## Install and build

```sh
cd rs2b0t
NODE_USE_ENV_PROXY=1 bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build
TARGET=local bun run build:bot
```

`NODE_USE_ENV_PROXY=1` matters on managed Cloud for Vale's GitHub-release
postinstall. No server is supplied by rs2b0t; the bundles must be hosted by the
game engine. `out/` is generated and ignored. These standalone build commands
use upstream RSA defaults and are build checks, not login-compatible deployments.

## Supported local deployment procedure

Read the pinned [local run guide](../rs2b0t/docs/how-to/run-locally.md),
[deployment script](../rs2b0t/tools/deploy-local.sh) and
[RSA helper](../rs2b0t/tools/deploy-local-key.sh). Deploy only into a stopped,
disposable runtime; the script replaces files in its `public/client/` and adds
`public/bot/`, `bot.html` and `multibox.html`. It builds bundles, collision data
and world-map assets from that runtime's cache. Build the engine cache first.

The bot build reads `LOCAL_RSAE` / `LOCAL_RSAN`; the native bundle build reads
`LOGIN_RSAE` / `LOGIN_RSAN`. At this pin, `deploy-local-key.sh` supplies only the
`LOCAL_*` pair, so calling it alone can leave the replacement native client with
the wrong key. Supply **both** pairs to the lower-level deployment script:

```bash
# From the Hallumina repository root, after prepare/build, with the world stopped.
# Extract only PUBLIC parameters from the generated runtime's public key.
read -r local_rsae local_rsan < <(node --input-type=module <<'JS'
import fs from 'node:fs';
import { createPublicKey } from 'node:crypto';
const dir = process.env.HALLUMINA_RUNTIME_DIR;
if (!dir) throw new Error('Set HALLUMINA_RUNTIME_DIR');
const key = createPublicKey(fs.readFileSync(`${dir}/engine/data/config/public.pem`)).export({ format: 'jwk' });
const decimal = value => BigInt('0x' + Buffer.from(value, 'base64url').toString('hex')).toString();
console.log(decimal(key.e), decimal(key.n));
JS
)
test -n "$local_rsae" && test -n "$local_rsan"
(cd rs2b0t && TARGET=local \
  LOCAL_RSAE="$local_rsae" LOCAL_RSAN="$local_rsan" \
  LOGIN_RSAE="$local_rsae" LOGIN_RSAN="$local_rsan" \
  ENGINE_DIR="$HALLUMINA_RUNTIME_DIR/engine" sh tools/deploy-local.sh)
```

Use `TARGET=local`: it connects to the serving local engine's origin. Never use
the hosted production client or `bun run b0t` for Hallumina checks. If runtime
keys change, rebuild both clients with the new public parameters. A wrong RSA
pair can produce login response 6 even when TypeScript and HTTP checks pass.
Never copy a private key into a client bundle or tracked configuration.

After a deliberate local deployment, start the same runtime and visit
`http://localhost:8888/bot.html` or `/multibox.html`. Account-backed registration,
login/gameplay and MultiBox acceptance are deferred to PR #2; the PR #1 template
intentionally has registration and support servers disabled. Do not use external
or production game accounts. The full deployment command above is documented from
the pinned scripts; this PR validates dependency installation and both bundle
builds, not collision/basemap deployment or logged-in bot gameplay.
