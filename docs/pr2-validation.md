# PR #2 application validation — 2026-11-25

Tested on the existing Debian 13 Cloud computer with Node 24.22.3, npm 11.19.1,
Bun 1.4.5 and real system Chromium through locked Playwright. The existing
checkout was fetched to merged `main`; all work is on
`feat/r289-gameplay-rs2b0t`. No additional parent checkout/worktree was created.

## Exact upstreams

| Component | Commit |
| --- | --- |
| Engine-TS `289` | `ddd01b3f32f0a04a18f05a468da962f57d0a1708` |
| Content `289` | `a60809082bc9f8fbdaa00c7b1a1d3fd6134c18fe` |
| rs2b0t `main` | `27e57fa331656df5a0d9b7b1cd1f4ec0c44519bb` |

Gitlinks, manifests, origins and submodule source stayed unchanged. Runtime
Engine/Content and bot build snapshots were exported outside the checkout.

## What was implemented

- Native SQLite schema initialization, first-login account provisioning using the
  original LoginServer/bcrypt authentication, and a login-worker launcher.
- Loopback restriction for upstream listeners in the app and worker threads;
  operation locks, listener probes and protection for existing data/assets.
- Correct native RSA argument order, with a cryptographic round-trip regression
  test and a stopped PR #1 runtime repair that preserves keys/database/saves.
- Guarded original rs2b0t deployment: both public RSA variable pairs, local target,
  regenerated collision verification, local r289 map baking, real upstream
  deploy script, preserved native client, MultiBox and asset hash verification.
- Read-only native save inspection, stopped backups, exclusive new-directory
  restore, state comparison and real-browser auth/MultiBox checks.

## Native game and fixture boundaries

A disposable account authenticated in the original bot client first. Native
login initially returned response 6. Investigation found that the pinned public
PEM's `e`/`n` labels are opposite to the native browser bundle's `(modulus,
exponent)` call-site values. PR #1 replaced PEM fields independently and therefore
swapped the newly generated public parameters. Matching/adapting the call site
fixed native authentication without modifying source submodules or weakening RSA.

The repaired **original native bundle** rendered Tutorial Island, accepted
character design and moved with native clicks. The local upstream RuneScape
Guide skip dialogue was then used for both acceptance accounts, exactly as
[documented](gameplay.md#tutorial-and-disposable-upstream-fixture). This required
an explicit stopped `production=false` fixture session, with authentication still
on. No give/teleport/max-stat commands, injected saves or invented achievements
were used. The fixture grants starter items, tutorial=1000 and 25 banked coins;
these are not earned gameplay results. The world was stopped and restored to
`production=true`, `debug=false` before the following trials. Database account
staff levels remained 0. An additional disposable account from an early input
attempt was retained rather than deleting/resetting the database.

In the normal native client, account A reconnected in Lumbridge, closed the
welcome modal, walked through normal minimap controls, examined the Signpost
(the chat displayed “North to Draynor Village :: East to Varrock.”), and dropped
its starter Pot with the normal inventory context menu. Its Pot was absent after
reconnecting in the bot client and in the saved inventory/bank. Native logout
returned to the welcome/title screen. Automated native authentication/logout
subsequently passed too. The native client at `/rs2.cgi` was never replaced by
the rs2b0t stock build.

## Script compatibility sample

All scripts below are the pinned original library entries. No script/API source
was changed. Entries were present in the real library; Woodcutter, WalkTo, Fisher
and AutoFighter were selected with Browse/category/card controls. Supported
settings and runner APIs were also used for repeat trials/BankSorter.

| Activity | Status | Observed result / limit |
| --- | --- | --- |
| Woodcutter | Works with local configuration | Tree, Bank=false, purgePackOnStart=false: 0 → 200 woodcutting XP and eight Logs. Equipped the native bronze axe, computed routes and issued native chops. A later chop brought XP to 225. |
| Banking through Woodcutter | Works with local configuration | Draynor (trees), Bank=true, purgePackOnStart=true: eight earned Logs left inventory and appeared as eight banked Logs. Other starter supplies were banked through native deposit actions. |
| BankSorter | Works with local configuration | sortBank=true, reportQuestJunk=false, dropQuestJunk=false: native bank insertion rounds sent 4+4+4+2 moves; reported `BankSorter: sorted, 14 moves (insert), 1 unfiled, 0 quest leftovers, 0 dropped`. |
| WalkTo | Works with local configuration | Map pick 3222,3222,0; moved from 3229,3218 to the destination, logged arrival and stopped normally. Other script travel crossed the chicken pen gate using native Open and movement. |
| AutoFighter, simple combat | Works with local configuration | Chicken at custom 3230,3298,0; melee/attack, banking None, foodWithdraw=0. Native attacks earned 156 attack XP (level 2); saved hitpoints XP was 1204.7. A normal default-food trial first walked to bank for Trout; no fake food was supplied. |
| Fisher, small-net sample | Requires an adapter or client fix (provisional; root cause unresolved) | First power-mode trial stopped with `restock: bank has no required fishing gear — need Small fishing net` despite the bank snapshot containing one. Manual native withdrawal worked. Named-camp retry stalled at `combat: waiting clear (no attacker)`; Use Start Position retry also produced no XP before stopping. Direct native Net after stopping the script caught shrimp and earned 50 XP. Those catches are **not** a Fisher-script pass. |
| Miner, other gathering tiers, other combat/quest scripts | Not tested | No claim for the rest of the library, tick manipulation, long sessions, death recovery or advanced content. |
| Hosted MultiBox resource telemetry | Requires missing server-side functionality | `/__rs2b0t/resources` returned 404 on the pinned local Engine. The actual UI and game sessions worked; resource telemetry remains unavailable. No substitute endpoint was added. |

Allowed status vocabulary also includes **Works unchanged**; no broad default-
configuration claim is made for this sample. The Fisher classification identifies
an investigation area, not a completed adapter. Draynor's hostile NPCs caused
legitimate death/respawn during the trial. The second account retained earned XP
and banked Logs, while its final carried items reflected normal death rules.
This is an additional reason not to claim unattended fishing/death recovery.

## Actual MultiBox acceptance

The upstream `/multibox.html` UI was used, not two ordinary tabs. Its encrypted
vault was initialized through the passphrase form, then two distinct profiles
were created/loaded through the actual chooser. Loading profiles leaves
initial auto-login off; enabling the existing per-bot auto-login control connected
both accounts to this local world simultaneously. Distinct native player slots
were observed, and both account-login records were online together.

The two actual iframes then held different locations, inventories and XP:
account A used WalkTo and AutoFighter while B used Woodcutter/BankSorter/Fisher
and a manual native Net interaction. Stopping/restarting B's script did not stop
A's combat; A's attack XP continued advancing (108 → 156 in recorded samples).
A had no Pot and zero woodcutting XP; B banked its Pot and eight earned Logs,
and had 225 woodcutting XP. Both normal logout and reconnection worked.

The committed MultiBox browser check independently passed before **and after**
server restart: two actual profiles, two scene-2 sessions, distinct player slots,
first-account logout while the second stayed online, first-account reconnection,
and normal logout of both. Only the optional telemetry 404 was observed; no
critical page JavaScript errors or missing required assets were recorded.

These were supervised Cloud Chromium runs with background-timer/throttling flags.
They do not establish long-running/background reliability. No resource limit
prevented the tested auth, concurrent sessions or persistence cycle.

## Genuine save/restart/reload

After earned-state trials and normal logouts, the runtime shut down via SIGTERM
with `Server shutdown complete` and exit 0. The same runtime, keys, database and
save files were started again. Both accounts authenticated in actual MultiBox,
rendered their characters, logged out, and the server stopped normally again.
The original PlayerLoading decoder verified CRCs and inspected saves on each
side of this cycle. No state was edited, replaced or reset.

| State | Account A, before and after | Account B, before and after |
| --- | --- | --- |
| Location (x,z,level) | 3227,3296,0 | 3222,3216,0 (normal death respawn) |
| Earned XP | Attack 156; HP 1204.7 | Woodcutting 225; Fishing 50 from direct native Net |
| Relevant levels | Attack 2, HP 10 | Woodcutting 3, Fishing 1, HP 10 |
| Inventory/equipment/bank | Exact slot/id/count equality; worn bronze sword; no Pot | Exact equality; carried bronze axe, net and one raw shrimp after death; eight Logs and Pot in bank |
| Tutorial / permanent state | tutorial 1000; 214 permanent variables equal | tutorial 1000; 214 permanent variables equal |

All 21 XP values, all base levels and all inventory containers/slots were compared,
not only the highlighted entries. Playtime increased normally. The only differing
permanent variable was `last_logout`: A 2312 → 110 and B 2313 → 111. Pinned
`login_logout/logout.rs2:8` assigns it to `map_clock`, which restarts at world boot.
The comparison explicitly reports this expected clock change and compares every
other permanent variable, including quest state. An initial blanket-variable
comparison correctly exposed this difference before its upstream cause was read.

Stopped full backups were created before the tutorial fixture, at mainland
baseline, and after gameplay. Restoring the baseline into a separate NEW directory
passed SQLite integrity and deployment/hash checks, preserving the original.
No existing character database was deleted or replaced. Backup/restore commands
and future-migration precautions are in [gameplay](gameplay.md).

## Commands actually executed

| Command/check | Outcome |
| --- | --- |
| `git submodule sync --recursive; git submodule update --init --recursive; node scripts/verify-upstreams.mjs` | PASS, exact pins and clean sources throughout |
| `bash scripts/install.sh` | PASS, frozen Engine/Bun installs; no Content dependency install |
| Engine `tsc --noEmit`, `npm run lint` | PASS; lint has 13 existing warnings, zero errors |
| rs2b0t `bun run typecheck`, `bun run lint`, `bun test` | PASS; 12,450 pass, 355 upstream skips, zero failures, 853 files, 77.95 seconds |
| `runtime.mjs prepare`, `build`, `smoke` on a separate fresh runtime | PASS, full content/cache/RuneScript build, ready world, HTTP/cache/TCP greeting and graceful exit 0; original no-account smoke constraints retained |
| `accounts.mjs init` | BLOCKED: Prisma binary/checksum host returned HTTP 403; no checksum bypass |
| `accounts.mjs init --offline-sql` | PASS, exact pinned SQL and recorded migration checksum; native SQLite auth exercised afterward |
| `deploy-rs2b0t.mjs`, including upstream stock/bot/MultiBox builds | PASS on two runtime exports; collision verification and local schema-2 map bake; both public RSA pairs supplied |
| `verify-deployment.mjs` | PASS, 72 asset hashes, required bundles/workers/WASM/font/nav/map, public RSA and native preservation |
| `node --test scripts/guards.test.mjs` | PASS, four meaningful guards: real RSA round trip/order, external/symlink/lock/port refusal, loopback including worker, exact migration and existing-account preservation |
| `browser-acceptance.mjs native` | PASS, server-confirmed native login, inspected gameplay screenshot, native logout and cache assets |
| `browser-acceptance.mjs bot` | PASS, original scene 2, inventory/stats/library, logout and wrong-password rejection |
| `browser-acceptance.mjs multibox` | PASS before and after restart, actual vault/profile UI and independent concurrent logout/reconnect |
| `persistence.mjs inspect/backup`, `restore.mjs`, `compare-persistence.mjs` | PASS, both earned-state round trips as above; exclusive stopped snapshot/restore verified |
| Active deploy / repeated prepare / existing-account init guard checks | PASS: refused; existing private key and database bytes unchanged |
| `ss -ltn`; management connection probes | PASS: all four game/support listeners 127.0.0.1; nonloopback management connections refused on both interfaces, loopback HTTP 200 |
| `git diff --check`, final pin/source/secret checks | PASS; no generated keys, accounts, DBs, saves, logs or screenshots in Git |

Engine has no packaged unit suite. Content was packed and real gameplay ran;
its complete in-game `_test` suite was not executed. No upstream test was edited
or disabled. The first automated negative-auth attempt timed out; the harness now
uses a fresh original client for that attempt, asserts it starts, and reports
native login/rate-limit diagnostics. The rerun rejected the wrong password.
Native rate limits remain enabled (15-second device / 60-second address windows).

## Evidence locations and remaining work

Private, ephemeral evidence is outside Git under `/tmp/hallumina-pr2-world/`
(client screenshots, acceptance JSON, keys/DB/saves), `/tmp/hallumina-pr2-*.log`,
`/tmp/hallumina-pr2-*.json` and private stopped backup directories. Examples:
`hallumina-native-sign-examined.png`, `hallumina-native-clean-logout.png`,
`hallumina-multibox-live-scripts.png`, `hallumina-pr2-woodcutter.json`,
`hallumina-pr2-bank-contents.json`, before/after restart snapshots, and the
runtime's `acceptance-native.json`, `acceptance-bot.json`,
`acceptance-multibox.json`. Paths are not release dependencies; this document
contains sanitized results for review. Password files are 0600 and are not printed.

Fisher automatic restock/gather remains incomplete and needs a scoped client
investigation before claiming that script works. Hosted telemetry requires a
server feature or an explicitly reviewed adapter. Broader script compatibility,
full tutorial progression without the fixture, long unattended/background runs
and full death recovery remain untested. No public deployment, revision upgrade,
server-managed playerbots, replacement API, custom mechanics or automatic merge
is included. Reproduce the same supervised procedure on Ubuntu using
[gameplay](gameplay.md) and [rs2b0t](rs2b0t.md); preserve failures and expand the
matrix one activity at a time.
