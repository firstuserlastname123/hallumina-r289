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

## PR #2 corrections — 2026-11-26

This section records new executions on the published Hallumina Cloud environment;
the supervised results above remain historical. Work continued from PR #2's
`a8df1a0` on `feat/r289-gameplay-rs2b0t`, without another worktree or PR.
Engine `ddd01b3f32f0a04a18f05a468da962f57d0a1708`, Content
`a60809082bc9f8fbdaa00c7b1a1d3fd6134c18fe`, and rs2b0t
`27e57fa331656df5a0d9b7b1cd1f4ec0c44519bb` remain unchanged and source-clean.

### What changed and how to reproduce it

`scripts/script-acceptance.mjs` now prepares a new external runtime, builds the
real r289 cache, migrates a fresh account DB, publishes and verifies the original
rs2b0t bundle, and drives the actual original library/runner. It performs the
native guide-skip fixture, normal logout/shutdown, and a production-mode restart
before measuring any earned state. Woodcutter uses supported settings, navigates
to ordinary Lumbridge trees, earns at least two logs, and then uses its original
startup banking behavior with Varrock East selected. A normal one-tile movement
interrupts any last native chop after stopping the runner; it never changes XP,
inventory, location or action results directly.

Bank acceptance requires the real interface, acknowledged bank/deposit-side item
counts, exact item conservation across inventory/equipment/bank, a retained axe,
and the authoritative stopped save. The same world/keys/DB/save are restarted,
the character reconnects and logs out, and `compare-persistence.mjs` compares all
inventory slots, XP, levels, location, tutorial and permanent variables. Native,
wrong-password and actual MultiBox browser regression checks follow.

The optional `--fisher` diagnostic separately measures bank/inventory readiness,
item names/IDs, the original restock plan/runner log, native combat clocks, spot
actions, fishing inventory/XP and authoritative saves. Its net is first deposited
with an actual native bank action; the test requires inventory 0 / bank 1 before
starting Fisher. A second fresh mainland fixture provides a short route to the
r289 Al Kharid small-net shore at 3270,3145. Native withdrawal, if required, is
labelled as a control and cannot establish an automatic-restock pass.

```sh
source /workspace/.hallumina-env/env.sh
bash scripts/install.sh
node scripts/verify-upstreams.mjs
node --test scripts/guards.test.mjs
(cd engine && node node_modules/typescript/bin/tsc --noEmit && npm run lint)
(cd rs2b0t && bun run typecheck && bun run lint && bun test)
export HALLUMINA_RUNTIME_DIR="$(mktemp -d /tmp/hallumina-script.XXXXXX)/world"
node scripts/script-acceptance.mjs --offline-sql --fisher
```

Omit `--fisher` for the primary acceptance only. Omit `--offline-sql` for the
upstream Prisma CLI; these corrections used the documented exact pinned-SQL
alternative, not another binary-download attempt. Individual gathering/banking
deadlines are 180/240 seconds; Fisher restock/gather limits are 90 seconds each
and shore travel is 180 seconds. Native tick stalls fail after 20 seconds;
runner interruption, scene/login, subprocess and graceful-shutdown stages also
have explicit deadlines. Failure JSON, runner samples and screenshots survive.

The only fixture grants are one each of bronze axe, tinderbox, small fishing
net, cooked shrimp, bucket, pot, bread, bronze pickaxe, bronze dagger, bronze
sword, wooden shield and shortbow; 25 bronze arrows, 25 air runes, 15 mind
runes, 6 water runes, 4 earth runes, 2 body runes; and 25 banked coins. The
unchanged upstream fixture resets skills, sets tutorial=1000 and moves to
Lumbridge. It grants zero Woodcutting XP and no logs. These supplies are recorded
separately from earned logs/fish. Authentication stays enabled; production=true,
debug=false and XP rate 1 apply during all measured gameplay.

### Executed toolchain and safety checks

| Check | Actual correction-run result |
| --- | --- |
| Locked install, `verify-upstreams.mjs` | PASS; frozen npm/Bun installs, exact origins/gitlinks/ancestry and clean submodules |
| Engine cache build and original local bot deployment | PASS on each deployed acceptance runtime; original native client preserved, public RSA and all 72 deployed assets verified |
| Engine typecheck / lint | PASS; lint has the same 13 warnings, zero errors |
| rs2b0t typecheck / lint | PASS |
| Full unmodified `bun test`, twice | **FAIL**, both runs: 12,448 pass, 355 upstream skips, 2 failures; 853 files, 72.78s and 82.71s |
| `bun test test/scripts/JiveDragons/paint.test.ts` (diagnosis only) | PASS: all 8 tests, 0 fail, 612ms; does not replace either full-suite failure |
| `node --test scripts/guards.test.mjs` | PASS: all 4, 251.68ms; real native RSA round trip, external-path/lock/port guards, loopback workers and exact offline migration protections |
| Existing-runtime refusal probe | PASS; the new harness refused an existing runtime before writes; private-key and DB bytes remained identical |
| Live `ss -ltn` probe | PASS: 8888, 8898, 43594, 43500 all bound to 127.0.0.1 |

The two full-suite failures are unchanged upstream JiveDragons paint tests:
`every rail label fits the eight-character rail` (missing `Clue`) and
`the Clue section with a trail running and a park reason stays inside the panel`
(missing `hard clue`). Both fail in the combined suite and pass in the isolated
file. This establishes a combined-suite limitation, not an all-green result;
no upstream test was changed, disabled, narrowed or used as a substitute.

### Retained failed attempts and runtime findings

All paths below are external private ephemeral evidence, not release
dependencies. Logs/credentials/screenshots/saves/keys were never added to Git.

| Attempt | Duration | Actual result and correction |
| --- | --- | --- |
| `/tmp/hallumina-corrections-run1` | 23.898s | Startup/protocol smoke passed, then account init safely refused an existing DB. Merely importing/starting the unauthenticated Engine creates a DB; the account preparation procedure now omits smoke before init. No DB was deleted/reset. |
| `...-run2` | 207.159s | Woodcutter 0→50 XP, 2 earned logs, inventory 2→0 / bank 0→2, axe retained, all items conserved. Both authoritative save snapshots were produced, but the harness's comparison-log filename incorrectly included an absolute path. Filename handling was fixed. Running the exact comparator separately passed all fields and 214 permanent variables (native logout clock 216→16). Overall attempt remains FAIL. |
| `...-run3` | 62.780s | Failed with `ERR_CONNECTION_REFUSED`: World ready precedes the separate web listener. Startup now also polls the real local client URL before login. Normal shutdown passed. |
| `...-run4` | 478.954s | Woodcutting/banking and authoritative restart comparison passed again (2 logs, 50 XP, 83.893s banking, 17.507s restart stage). Fisher travel hit its 180s deadline, and rapid consecutive browser suites later timed out in MultiBox scene loading. An independent fresh-server MultiBox retry passed two sessions and logout/reconnect; the final harness respects the native 15s device-login window between suites and retains per-frame failure diagnostics. No rate limit was disabled. |
| `...-run5` | 197.531s | Again earned 2 logs/50 XP and observed inventory 2→0 / bank 0→2 with all items conserved; a read-only account-state query then hit `database is locked` during logout/save. Both browser harnesses now use a connection-local 5s SQLite busy timeout. This does not alter DB contents or upstream transactions. Normal shutdown passed; overall attempt remains FAIL. |

The early Fisher observations did **not** establish restocking: stopping
Woodcutter as soon as earned logs reached the bank left the fixture net carried.
The final diagnostic explicitly deposits it and checks missing gear before
starting Fisher. A carried net is never counted as an original-script withdrawal.
The earlier Varrock-to-shore navigation failure also cannot establish a fishing
failure or success. Pinned Content places the selected Net+Bait saltfish at Al
Kharid (`0_51_49_saltfish`, `fishing_movement_al_kharid_enum`); the later-revision
Lumbridge swamp location initially assumed by that diagnostic is not used.

### Final executed acceptance

The final fresh-world command was:

```sh
HALLUMINA_RUNTIME_DIR=/tmp/hallumina-corrections-run6 \
  node scripts/script-acceptance.mjs --offline-sql --fisher
```

**PASS for Woodcutting, banking, persistence and browser regressions**, exit 0,
597.512 seconds total. The separate Fisher result is **INCOMPLETE**; a completed
diagnostic phase is not a passing fishing test.

| Stage | Duration | Observed result |
| --- | --- | --- |
| Fresh prepare/build/migration/original deployment | 30.549s | Real cache, new RSA, exact pinned SQL, original bundles, 72 asset hashes verified |
| Upstream fixture, two isolated accounts | 38.644s | Native character-design Accept and guide dialogue; normal logout/stop; production restored before gameplay |
| Original Woodcutter navigation/chopping | 50.366s | 0→50 Woodcutting XP, 0→2 Logs, native movement from Lumbridge to ordinary trees |
| Original Woodcutter bank travel/deposit/save | 83.735s | Varrock East, inventory Logs 2→0, bank Logs 0→2, all item quantities conserved, axe retained |
| Normal restart/reconnect/logout/authoritative comparison | 16.898s | Exact location, all XP/levels, tutorial, inventory/equipment/bank slots and 214 permanent variables; only the expected native `last_logout` clock differs |
| Bounded Fisher diagnosis | 263.843s | Automatic net withdrawal verified; gather trial 90s timeout, zero fish and zero Fishing XP, real combat/death documented below |
| Native / bot negative-auth / actual MultiBox | 113.104s | All three existing browser modes passed; both accounts online with distinct player slots, first logout/reconnect while second stayed online, then normal logout |

The native Varrock scene, actual bank with two Logs, and two live original
MultiBox profiles were also visually inspected in the private screenshots.
No critical browser JavaScript errors or missing required assets were recorded.
MultiBox's optional `/__rs2b0t/resources` still returned 404. Core Woodcutting and
banking had already produced the same two-log/50-XP result on the independent
`run2` and `run4` worlds; their whole-run failures are retained above rather than
being relabelled as successful end-to-end runs.

Final evidence is in `/tmp/hallumina-corrections-run6-acceptance/result.json`,
the script sample JSON files, `fixture-save.json`, `earned-save.json`,
`restarted-save.json`, `fisher-diagnostic.json`, `fisher-restock-save.json`,
`fisher-save.json`, private build/server/browser logs, and the runtime's
`acceptance-native.json`, `acceptance-bot.json`, `acceptance-multibox.json`.
The Fisher travel sample in this execution is named `Fisher-safe-shore-travel.json`;
that historical filename does not establish safety and the harness now calls it
`Fisher-shore-travel.json`. The screenshots and credential file remain external.

### Fisher findings and precise remaining scope

The original restock failure was **not reproduced** after establishing an actual
missing-net precondition. Native preparation deposited fixture item **303**;
both bank and deposit-side snapshots were fresh/ready with inventory 0, bank 1,
and the original `fishingRestockPlan` returned one Small fishing net. Fisher's
own log recorded `restock: withdraw 1× Small fishing net`. Inventory became 1,
bank became 0, and the authoritative save independently confirmed those counts.
No manual withdrawal fallback was used. This rules out a blanket name/ID,
withdrawal-packet or r289 bank-interface incompatibility for this tested case;
it does not retroactively explain the earlier Draynor observation.

Gathering was tested separately with the second freshly prepared account.
Pinned r289 NPC **330** at the Al Kharid shore exposed **Net + Bait**, matching
the original small-net method, and the carried net was present. Native WalkTo
reached 3270,3145. The account took real damage during arrival (HP 10→8), then
Fisher's **Use Start Position** trial took further hits to HP 0 and respawned
near Lumbridge. Its net was lost under normal death rules; the saved inventory
retained only shortbow, bronze sword and wooden shield. Fishing XP remained
**0** and there were **no raw shrimps**. This is an explicit failed gathering
trial, not a manual native Net success, a successful selection, or an animation.

Source inspection explains the tested combat behavior: `GatherCamp.ts`'s
`isAutoLocation()` includes Use Start/Custom Position; `GatheringBot.ts` logs
`mob flee off (may die)` and omits WaitStickyCombat/FleeCombat for that policy;
`GatheringBotLogic.ts:gatheringCombatPolicy()` sets `flee=false`, and Gather
yields during combat. The captures show genuine repeated damage, not merely a
stale combat flag; after death the flag cleared and the script attempted to
return to its anchor without a net. The exact attacking NPC was not captured.
The former named-Draynor `combat: waiting clear (no attacker)` symptom and
post-death recovery are not established as fixed by this fresh-account test.

No Hallumina protocol adapter or item-name shim is justified by these results,
and no upstream patch was applied. A next configuration trial can evaluate the
existing legacy **None** location (which enables the original flee policy), or
a genuinely safe/qualified camp, with threat observations and bounded recovery.
Neither is claimed as passing here. If freeform mode needs a new selectable
flee policy, the source change belongs in upstream rs2b0t: add the setting to
Fisher's schema in `src/bot/scripts/index.ts`, carry it through GatheringBot,
and use the same resolved policy for both combat task installation and
`combatPolicy()` instead of the two `isAutoLocation()` decisions. That is a
future reviewed upstream change or narrowly scoped Hallumina patch PR, not a
verified fix or permission to move/edit this pin. The combat/death limitation
remains incomplete without delaying the completed primary acceptance.

### Files, security and review status

Actual modified files: `scripts/script-acceptance.mjs` (new),
`scripts/browser-acceptance.mjs`, `docs/gameplay.md`, `docs/rs2b0t.md`,
`docs/upstream-updates.md`, and this `docs/pr2-validation.md`. The browser harness
adds private failure diagnostics and a read-only connection busy timeout; native
authentication, account/save formats, client assets and gameplay mechanics are
unchanged. No submodule, gitlink, upstream revision or lockfile changed.

Runtime guards passed again after implementation (4/4, 265.27ms). Live `ss -ltn`
showed only 127.0.0.1 for 8888, 8898, 43594 and 43500; all four were gone after
the final graceful shutdown. Both account DB staff levels were 0, with measured
production=true/debug=false/XP rate 1 and login enabled. The existing-runtime
refusal probe preserved both private-key and DB bytes. Syntax, whitespace,
pin/source and staged-artifact checks passed. No real player save was accessed,
reset, overwritten or used as a fixture.

The corrections are ready for final review in the existing draft PR #2.
They are **not an all-green merge recommendation**: the full upstream unit
suite has two reproducible combined-suite failures, Fisher gathering/death
recovery remains incomplete, and hosted telemetry remains unavailable. No new
full tutorial, combat, broad script-library, long background soak, public/home-lab
deployment or full Content `_test` claim is made. The original supervised combat
and broader gameplay evidence above was preserved and was not rerun here.
No merge or automatic merge was performed.

## Final pre-merge JiveDragons baseline comparison — 2026-11-26

**Classification: upstream baseline failures at the pinned rs2b0t commit,
not regressions introduced by Hallumina PR #2.** The same two failures and
identical expectation/received error blocks reproduced on both parent branches.

### Controlled comparison

The existing checkout was initially clean on feature commit
`13213858f0ee34f8a3d7e3c1087a9e3fdbac0963`. After testing it, the parent checkout
was switched to clean `main` at `5472be1215d9ab95b982be500c273791b8f872aa` and the
same commands were repeated. The original feature branch was restored before
this documentation edit. No second worktree, duplicate source checkout,
dependency reinstall, runtime start, gameplay change or upstream edit was used.

Both parent gitlinks and the unchanged submodule checkout selected rs2b0t
`27e57fa331656df5a0d9b7b1cd1f4ec0c44519bb` (tree
`6de99d631a5eca32bf850d94e397ce8e7b731d1d`). All test processes ran sequentially
from `/workspace/hallumina-r289/rs2b0t`, using the same Bun **1.4.5**
(`a7733435c`) binary, Node **24.22.3** toolchain and inherited environment
snapshot. The pinned `bunfig.toml` contains only the existing
`test/setup-dom.ts` preload. Package manifest, lockfile, configuration, preload
and paint-test hashes matched on both branches. A hash of installed dependency
files and symlink targets was unchanged before/after both runs: 7,502 regular
files, SHA-256
`a6bccc07589006ea32e90bf05f7acc419b056e974e4cf1baedf657437842eded`.
The submodule source remained clean throughout.

From the repository root, source `/workspace/.hallumina-env/env.sh`; on **each**
parent branch, run these exact commands from `rs2b0t/`:

```sh
bun test
bun test test/scripts/JiveDragons/paint.test.ts
```

| Parent branch / command | Pass | Fail | Skip | Exit | Wall time |
| --- | ---: | ---: | ---: | ---: | ---: |
| Feature, complete `bun test` | 12,448 | 2 | 355 | 1 | 64.113s |
| Clean `main`, complete `bun test` | 12,448 | 2 | 355 | 1 | 63.900s |
| Feature, isolated paint file | 8 | 0 | 0 | 0 | 0.269s |
| Clean `main`, isolated paint file | 8 | 0 | 0 | 0 | 0.269s |

Each full run executed 12,805 tests across 853 files. Wall times include process
startup. The 355 skips are unchanged upstream skips; no test was edited,
disabled, rewritten or newly skipped.

### Exact failures on both full-suite runs

`JiveDragons paint > every rail label fits the eight-character rail`,
`test/scripts/JiveDragons/paint.test.ts:111:27`:

```text
error: expect(received).toContain(expected)

Expected to contain: "Clue"
Received: [
  "Statistics", "Options", "starting", "JiveDragons", "-", "Overview", "Combat", "Levels", "Loot",
  "Jive scripts", "Runtime: 0:00:00", "Kills: 0", "Kills/hr: n/a", "Trips: 0", "Spot: (2744, 9457, 0)",
  "HP", "100%", "no 'Lobster' left in the bank after a full trip. The run", "  stopped at the booth rather than walk back to the dragon…",
  "Pause", "Stop"
]
```

`JiveDragons paint, mid-clue > the Clue section with a trail running and a park reason stays inside the panel`,
`test/scripts/JiveDragons/paint.test.ts:156:50`:

```text
error: expect(received).toContain(expected)

Expected to contain: "hard clue"
Received: "Statistics|Options|starting|JiveDragons|-|Overview|Combat|Levels|Loot|Jive scripts|Runtime: 0:00:00|Kills: 0|Kills/hr: n/a|Trips: 0|Spot: (2744, 9457, 0)|HP|100%|no 'Lobster' left in the bank after a full trip. The run|  stopped at the booth rather than walk back to the dragon…|Pause|Stop"
```

### Ordering and shared-state evidence

Both complete logs show `JiveDragons/safety.test.ts` immediately before
`JiveDragons/paint.test.ts`. Read-only inspection of the pinned source identifies
the state path:

- `src/bot/scripts/JiveDragons/JiveDragons.ts:187` declares module-level
  `SOLVE_CLUES=true`; `onStart()` at line 1254 overwrites it from settings, and
  `onPaint()` at line 1597 uses it to include or omit the Clue rail entry.
- `test/scripts/JiveDragons/safety.fixture.ts:98` starts scenarios with
  `solveClues:false`. `restoreSafety()` restores mocks and Sustain, but leaves
  the JiveDragons module variables set by those scenarios.
- The paint tests create a fresh bot without calling `onStart()` and reset
  paint UI state, not the module's clue setting. With Clue omitted from the
  available sections, `PaintFrame.rail()` falls back to Overview when the
  mid-clue test selects Clue. This explains both missing strings.

Two additional executions used only the original, unmodified safety and paint
files, on the restored feature branch, to distinguish shared-state interference
from a parallel execution race:

```sh
bun test --max-concurrency=1 test/scripts/JiveDragons/safety.test.ts test/scripts/JiveDragons/paint.test.ts
bun test --isolate --max-concurrency=1 test/scripts/JiveDragons/safety.test.ts test/scripts/JiveDragons/paint.test.ts
```

| Diagnostic mode, safety then paint in both logs | Pass | Fail | Skip | Wall time |
| --- | ---: | ---: | ---: | ---: |
| Shared process/module state, concurrency limited to one | 48 | 2 | 0 | 0.417s |
| Fresh per-file isolation, concurrency limited to one | 50 | 0 | 0 | 0.465s |

The shared-state pair reproduces the same two paint failures even with concurrency
limited to one. Per-file isolation removes them while executing all the same
50 selected tests. This supports an upstream test-order/module-state leak;
parallel execution is not required to reproduce it. These diagnostic subset
runs do **not** replace either complete failing `bun test` run and are not an
all-green full-suite claim.

### Recommendation and retained evidence

**These two failures should not block PR #2 as Hallumina regressions.** They
reproduce on clean `main` with the identical pinned source, dependency bytes,
configuration and environment, and the source/serial/isolation evidence explains
the failure mechanism. Track upstream test-state isolation separately rather
than changing pinned source or weakening tests in this PR. Other PR acceptance
criteria and the previously documented Fisher limitation remain separate.

Private full logs, isolated logs, comparison metadata and ordering diagnostics
are retained under `/tmp/hallumina-pr2-premerge-kv79eqah/`:
`feature-full.log`, `main-full.log`, `feature-isolated.log`, `main-isolated.log`,
`serial-pair.log`, `isolated-pair.log`, `comparison.json` and `ordering.json`.
That directory contains evidence/controller files only; all tests used the
original submodule path. Only this validation document changed. No PR was
created and PR #2 was not merged.
