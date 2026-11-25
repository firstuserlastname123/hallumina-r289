# Revision compatibility and future upstream updates

`hallumina/compatibility.json` records the exact repository URLs, historical
branches, commits and toolchain. `.gitmodules` records intended branches; gitlinks
select the actual commits. Branch labels do not permit automatic tip updates.
`verify-upstreams.mjs` checks origins, branch ancestry, checkout/index pins and
source cleanliness without fetching or changing the selection.

Evaluate updates on a separate feature branch from `main`. Fetch only the
component under evaluation, inspect its history, lockfile and protocol/schema
changes, and record a proposed **exact** commit. Start with one component; update
a coupled Engine/Content pair only when evidence requires it. Never run
`git submodule update --remote` or advance all components blindly. A move away
from revision 289 is an explicit future project decision, not routine upkeep.

For a candidate Engine update, for example:

```sh
git switch -c compatibility/engine-candidate main
git -C engine fetch origin 289
git -C engine log --oneline HEAD..origin/289
# Review first; substitute the reviewed commit, never an unexamined branch tip:
git -C engine checkout --detach REVIEWED_COMMIT
git add engine
# Update compatibility.json intentionally, then install, build and test.
```

Before accepting an update, record this matrix for the exact candidate set:

| Gate | Required evidence |
| --- | --- |
| Reproducibility | Origins/ancestry, exact gitlinks, frozen installs, tool versions, preserved licenses |
| Build | Engine cache/RuneScript compilation, both typechecks, relevant upstream tests/lint, client bundles |
| Startup | Map/cache initialization, ready world, HTTP, WebSocket/native TCP and clean shutdown |
| Login | Fresh disposable account, correct public RSA parameters, native client login/logout/reconnect |
| Saves | Backed-up disposable fixture, save/restart/load round trip, inventory/stats/location compatibility |
| Native actions | Walk/pathfinding, NPC/object interaction, inventory/equip, combat, banking, dialogue |
| Bot client | Local rs2b0t login, action packets, script API behavior, navigation/collision regeneration, MultiBox |

Use disposable copies for schema/save migrations. Never test by resetting an
existing world. Keep the previous pins and runtime backup available for rollback;
reverting a gitlink does not roll back a migrated database or save format.

If any required gate is blocked, the compatibility PR remains unaccepted with
the exact limitation recorded. PR #1 establishes the baseline but deliberately
does not assert the login/gameplay/save/bot acceptance gates. Before accepting a
future upstream update, complete those gates rather than inheriting that deferral.
