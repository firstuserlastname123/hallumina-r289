# Original rs2b0t and MultiBox on local r289

The original `rs2b2t/rs2b0t` pin remains
`27e57fa331656df5a0d9b7b1cd1f4ec0c44519bb`. Its UI, scripting API and script
library are unchanged. See [PR #2 evidence](pr2-validation.md) for the tested
sample, incompatibilities and limits; revision 289 alone does not establish
compatibility with every hosted rs2b2t feature.

## Deploy to a stopped runtime

Read the pinned [local guide](../rs2b0t/docs/how-to/run-locally.md),
[deploy script](../rs2b0t/tools/deploy-local.sh) and
[RSA helper](../rs2b0t/tools/deploy-local-key.sh). Hallumina supplies a guarded
wrapper around the actual upstream pipeline:

```sh
# From parent root, with locked dependencies installed and a prepared/built world:
export HALLUMINA_RUNTIME_DIR=/absolute/existing/isolated-world
node scripts/deploy-rs2b0t.mjs
node scripts/verify-deployment.mjs
node scripts/runtime.mjs start
```

The wrapper requires matching pins, built cache/worldmap, unoccupied runtime
ports and an exclusive operation lock. Existing bot assets are protected; this
first-deployment command refuses to replace them. For a new upstream/client build,
prepare a new runtime, validate it and use the stopped snapshot procedure before
moving real persistence. Do not reinstall dependencies while any world runs.

Builds use an external `rs2b0t-build-*` pinned archive inside the runtime, sharing
installed dependencies. No upstream checkout is edited and no generated assets
enter Git. Each deployment regenerates and verifies collision data against its
local cache/content, and bakes schema-2 world-map assets from that runtime's own
`worldmap.jag` with revision **289**. No hosted map fallback is needed. Both
`LOCAL_RSAE`/`LOCAL_RSAN` and `LOGIN_RSAE`/`LOGIN_RSAN` come from the runtime's
PUBLIC key; `TARGET=local` and the pinned build identity are explicit.

The actual `tools/deploy-local.sh` builds and publishes into a staging sandbox.
Hallumina copies its original bot/MultiBox outputs to the runtime while preserving
`public/client/` byte-for-byte. Thus `/rs2.cgi` retains the Engine native client,
not a bot-enabled replacement. A deployment manifest outside Git records asset
SHA-256 hashes and public RSA values. Verification checks required bundles,
workers/WASM, soundfont, map/navigation assets and the preserved native key/call.
No private key is read by the bot build or copied to a browser directory.

The upstream `deploy-local-key.sh` only sets `LOCAL_*` and upstream deployment
normally replaces the native bundle; do not use it directly for Hallumina.
Standalone `bun run build`/`TARGET=local bun run build:bot` are build checks using
upstream defaults, not login-compatible Hallumina deployments. Never use the
production proxy (`bun run b0t`), hosted credentials or production worlds.

## Open the clients

- Native: <http://127.0.0.1:8888/rs2.cgi>
- Personal bot: <http://127.0.0.1:8888/bot.html>
- Original MultiBox: <http://127.0.0.1:8888/multibox.html>

Authenticate with disposable accounts provisioned as in [gameplay](gameplay.md).
Accept character design and complete the native tutorial, or explicitly use the
upstream test fixture described there. The tested fixture grants starter tools;
XP earned afterward is measured separately. Log out one client before signing
that same account into another client. Separate accounts may be online together.

## Representative script trials

Use Browse to select the original script. Edit parameters through its panel; the
published upstream `rs2b0t.settings.save(name,key,value)` interface can also save
local settings. Valid dropdown labels matter (for example **Use Start Position**,
not `Start Position`, for GatheringBot freeform gathering).

A small first sample, with legitimately obtained tools and inventory space:

| Activity | Library entry and local settings | Evidence to capture |
| --- | --- | --- |
| Woodcutting | Woodcutting → Woodcutter; Tree; location Auto or Use Start Position; Bank=false; purgePackOnStart=false; Buy/repair Off | Start/Stop, native chop animation, Logs and woodcutting XP increase |
| Banking | Woodcutter; Use Custom Position 3233,3245,0; bankLocation=Varrock East; Bank=true; purgePackOnStart=true | Before: held logs; after: fewer held logs, same count added to bank; retain axe and conserve starter supplies |
| Bank organization | Utility → BankSorter; sortBank=true; reportQuestJunk=false; dropQuestJunk=false | Native bank opens, insert moves acknowledged, sorted status |
| Fishing (blocked sample) | Fishing → Fisher; Small net — shrimp/anchovy; Draynor Village or Use Start Position; Bank=false; cookMode=Off | Preserve restock/idle failure; distinguish manual Net results from script results |
| Combat | Combat → AutoFighter; Chicken; Custom coordinates 3230,3298,0; melee/attack; Banking=None; foodWithdraw=0 for the brief low-risk test | Actual target health/damage and attack/HP XP; supervise HP, stop after evidence |
| Navigation | Navigation → WalkTo; map pick a reachable local tile, arriveRadius=0 | Collision pack loaded, route computed, native movement, arrival/stop |

Banking/supply defaults can cause long walks. AutoFighter defaults to stocking
Trout even when loot banking is None; configure food deliberately. Fisher's
first power-mode gear-restock attempt reported missing gear despite a net in the
bank. Manual withdrawal removed that supply problem, but the script still
stalled (named camp reported `combat: waiting clear (no attacker)`, and a
freeform retry produced no XP). A direct native Net action then caught shrimp
and earned XP. This proves server fishing, not a passing Fisher script or
automatic-restock test. Preserve these errors when comparing future pins.
Inspect the [matrix](pr2-validation.md) for actual results.

The correction harness now verifies automatic net withdrawal with a genuine
inventory-0/bank-1 precondition and an authoritative inventory-1/bank-0 save.
Its separate Al Kharid freeform gathering trial still failed: real combat led
to death and zero Fishing XP. This is not a validated novice training route.
See the [correction findings](pr2-validation.md#fisher-findings-and-precise-remaining-scope)
for source-level combat-policy details, retained failure evidence and the
unresolved earlier Draynor symptom. No adapter or upstream patch is claimed.

Do not use upstream live harness helpers that teleport, grant items or max stats.
No Hallumina API shim or rewritten script is supplied. The original server has
quests/skill requirements and some hosted features are absent. Report these
rather than faking their response. A short gathering trial does not validate all
resource tiers, tick manipulation, death recovery or a full unattended session.

## MultiBox acceptance

Open the actual MultiBox page, add bot, set a profiles passphrase, then create +
load two **distinct** local account profiles. The original vault encrypts stored
profiles; keep browser storage/traces/screenshots containing inputs private.
Loading a profile alone leaves title-screen auto-login off. Enable Auto login in
each bot's Global settings (or its existing `setAutoLogin(true)` control) or log
in manually. Do not interpret two loaded title screens as concurrent game sessions.

Select each rail tile to focus its live iframe. Verify both character names and
server player slots differ, with both online concurrently. Run an original script
on one; manually use the other, or run a second script. Record different inventory
and XP states, stop/restart only the first script, and verify the second still
advances. Then disable auto-login, use each normal Logout button and reconnect.
The reproducible auth/session portion is:

```sh
export HALLUMINA_CREDENTIALS_FILE=/absolute/private/disposable-credentials.json
node scripts/browser-acceptance.mjs multibox
```

This visits the actual UI and profiles, not two ordinary tabs. Interactive script
trials and server restart comparisons remain separate. Keep the wall visible;
background tab throttling and CPU pressure can starve scripts. The Cloud checks
use Chromium background-timer flags and do not establish unattended reliability.
The hosted `/__rs2b0t/resources` telemetry endpoint returns 404 on this Engine;
resource display is unavailable, and no fake endpoint is added.

## Validation and diagnostics

Run the automatic original Woodcutter/banking/save acceptance on a **new**
external runtime with `node scripts/script-acceptance.mjs --offline-sql`.
It builds and publishes the pinned local bundle, uses disposable accounts and
the supported tutorial fixture, and checks actual yields, deposits and saved
state. It also runs all three browser regression modes below. See
[the reproduction procedure](gameplay.md#repeat-browser-acceptance-on-cloud-or-ubuntu)
for timeouts, private evidence and the separate `--fisher` diagnostic. This
automates the previous supervised Woodcutting/banking sample without changing
the upstream client, scripting API or scripts.

```sh
node --test scripts/guards.test.mjs
node scripts/verify-upstreams.mjs
node scripts/verify-deployment.mjs
(cd engine && node node_modules/typescript/bin/tsc --noEmit && npm run lint)
(cd rs2b0t && bun run typecheck && bun run lint && bun test)
# Against a running isolated authenticated world, one mode at a time:
node scripts/browser-acceptance.mjs native
node scripts/browser-acceptance.mjs bot
node scripts/browser-acceptance.mjs multibox
```

If navigation fails, check `/bot/collision.lcnav.gz`, `/bot/navworker.js` and map
manifest/PNG responses, then the original Navigator logs. Regenerate from local
content by deploying to a new built runtime, not by reusing shared `rs2b0t/out/`.
Check browser JS errors and library script messages separately. For RSA, login,
cache and save problems see [gameplay troubleshooting](gameplay.md#troubleshooting).
