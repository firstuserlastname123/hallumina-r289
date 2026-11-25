import assert from 'node:assert/strict';
import fs from 'node:fs';
assert.equal(process.argv.length, 4, 'Usage: compare-persistence.mjs before.json after.json');
const [before, after] = process.argv.slice(2).map(file => JSON.parse(fs.readFileSync(file)));
for (const field of ['location', 'xpTenths', 'levels', 'tutorial', 'inventories']) {
    assert.deepEqual(after[field], before[field], `Persisted ${field} differs after restart/relogin.`);
}
// Pinned Content login_logout/logout.rs2 assigns %last_logout = map_clock.
// It must change on the second logout, and the world clock restarts at boot.
const { last_logout: oldClock, ...oldVars } = before.permanentVars;
const { last_logout: newClock, ...newVars } = after.permanentVars;
assert.deepEqual(newVars, oldVars, 'Permanent quest/state variables differ after restart/relogin.');
assert(Number.isInteger(newClock) && newClock >= 0, 'Invalid native logout clock.');
assert(after.playtime >= before.playtime, 'Playtime went backwards.');
console.log(`PASS: location, XP, levels, tutorial, all inventories and ${Object.keys(newVars).length} permanent variables survived restart/relogin; playtime did not regress. Native last_logout clock: ${oldClock} -> ${newClock} (expected).`);
