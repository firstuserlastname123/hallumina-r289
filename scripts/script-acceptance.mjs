// Real, disposable r289 acceptance. This harness only sends supported native
// actions and starts pinned library scripts; it never writes character state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { root, manifest, verify } from './verify-upstreams.mjs';
import { externalPath, runtimeInfo } from './runtime-lib.mjs';

assert(process.argv.slice(2).every(arg => ['--offline-sql', '--fisher'].includes(arg)), 'Usage: script-acceptance.mjs [--offline-sql] [--fisher]');
verify({ quiet: true });
const runtime = externalPath(process.env.HALLUMINA_RUNTIME_DIR);
assert(!fs.existsSync(runtime), 'Acceptance requires a NEW runtime; existing worlds and player saves are protected.');
const evidenceDir = runtime + '-acceptance';
fs.mkdirSync(evidenceDir, { mode: 0o700 }); // exclusive: retain previous failures
const started = Date.now();
const evidence = { started: new Date().toISOString(), pins: manifest.upstreams, phases: [], snapshots: {}, result: 'RUNNING' };
const write = (name, data) => fs.writeFileSync(path.join(evidenceDir, name), JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
const suffix = randomBytes(3).toString('hex');
const credentials = {
    first: { username: `wc${suffix}`, password: randomBytes(9).toString('hex') },
    second: { username: `mb${suffix}`, password: randomBytes(9).toString('hex') }
};
write('credentials.json', credentials);
let server, browser, page, db, config, engine, currentPhase;
const persist = () => { evidence.durationMs = Date.now() - started; write('result.json', evidence); };

function command(script, args = [], timeout = 300_000) {
    const label = path.basename(script, '.mjs') + '-' + (args[0] ? path.basename(args[0]) : 'run');
    const file = path.join(evidenceDir, `${label}-${Date.now()}.log`);
    const fd = fs.openSync(file, 'wx', 0o600);
    try {
        const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
            cwd: root, env: process.env, stdio: ['ignore', fd, fd], timeout, killSignal: 'SIGTERM'
        });
        assert(!result.error && result.status === 0, `${label} failed (${result.error?.message ?? result.status}); see ${file}`);
        return fs.readFileSync(file, 'utf8');
    } finally { fs.closeSync(fd); }
}
async function bounded(label, timeout, fn) {
    let timer;
    try { return await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: exceeded ${timeout}ms`)), timeout); })]); }
    finally { clearTimeout(timer); }
}
async function phase(name, fn) {
    currentPhase = name;
    console.log(`Acceptance: ${name}`);
    const at = Date.now();
    try { const value = await bounded(name, 900_000, fn); evidence.phases.push({ name, result: 'PASS', durationMs: Date.now() - at }); persist(); return value; }
    catch (error) { evidence.phases.push({ name, result: 'FAIL', durationMs: Date.now() - at, error: error.message }); throw error; }
}
async function poll(label, timeout, fn) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (server) assert(server.child.exitCode === null && server.child.signalCode === null, `${label}: server exited; see ${server.file}`);
        if (await fn()) return;
        await delay(300);
    }
    throw new Error(`${label}: timed out after ${timeout}ms (phase ${currentPhase}); inspect result.json, script logs and server logs in ${evidenceDir}`);
}
function production(value) {
    assert(!server, 'Stop the world before changing fixture configuration.');
    config.node.production = value;
    fs.writeFileSync(path.join(engine, 'data/config/world.json'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}
async function startServer(fixture = false) {
    const file = path.join(evidenceDir, `server-${Date.now()}.log`);
    const fd = fs.openSync(file, 'wx', 0o600);
    const env = { ...process.env };
    delete env.HALLUMINA_UPSTREAM_TUTORIAL_FIXTURE;
    if (fixture) env.HALLUMINA_UPSTREAM_TUTORIAL_FIXTURE = '1';
    const child = spawn(process.execPath, [path.join(root, 'scripts/runtime.mjs'), 'start'], { cwd: root, env, detached: true, stdio: ['ignore', fd, fd] });
    fs.closeSync(fd);
    server = { child, file, error: null, closed: null };
    const owned = server;
    owned.closed = new Promise(resolve => { child.once('error', error => { owned.error = error; resolve(); }); child.once('close', resolve); });
    await poll('World ready', 90_000, async () => {
        assert(!owned.error, `Server launch failed: ${owned.error}`);
        if (!fs.readFileSync(file, 'utf8').includes('World ready')) return false;
        // The world announces readiness before the separate web listener binds.
        try { return (await fetch(`http://127.0.0.1:${config.web.port}/bot.html`, { signal: AbortSignal.timeout(2000) })).ok; }
        catch { return false; }
    });
    db = new DatabaseSync(path.join(engine, 'db.sqlite'), { readOnly: true });
    db.exec('PRAGMA busy_timeout=5000'); // tolerate native login/save transactions
}
async function stopServer() {
    db?.close(); db = null;
    if (!server) return;
    const owned = server;
    owned.child.kill('SIGTERM');
    try {
        await bounded('Graceful world shutdown', 45_000, () => owned.closed);
        assert.equal(owned.child.exitCode, 0, `World shutdown failed; see ${owned.file}`);
        assert(fs.readFileSync(owned.file, 'utf8').includes('Server shutdown complete'), `World did not acknowledge saved-state shutdown; see ${owned.file}`);
    } catch (error) {
        // Only the process group created by this harness is eligible for cleanup.
        try { process.kill(-owned.child.pid, 'SIGKILL'); } catch { /* already exited */ }
        throw error;
    } finally { server = null; }
}
const online = account => db.prepare('SELECT logged_in FROM account_login JOIN account ON account.id=account_login.account_id WHERE username=? AND profile=?').get(account.username, 'main')?.logged_in === config.node.id;
async function login(target = page, account = credentials.first) {
    assert(!online(account), 'Acceptance account is already online.');
    await target.goto(`http://127.0.0.1:${config.web.port}/bot.html`);
    await target.waitForFunction(() => globalThis.rs2b0t?.client.constructor.loopCycle > 10, undefined, { timeout: 60_000 });
    assert(await target.evaluate(c => rs2b0t.actions.login(c.username, c.password), account), 'Native login was not dispatched.');
    await target.waitForFunction(() => rs2b0t.client.ingame && rs2b0t.client.sceneState === 2 && rs2b0t.reader.statsReady(), undefined, { timeout: 30_000 });
    await poll('Account service online acknowledgement', 15_000, () => online(account));
    await delay(1500); // inventory/varps follow the scene packet
}
async function stopScript() {
    await page.evaluate(() => rs2b0t.runner.stop('Hallumina acceptance checkpoint'));
    await page.waitForFunction(() => !['running', 'paused', 'stopping'].includes(rs2b0t.runner.state), undefined, { timeout: 10_000 });
    evidence.lastScript = await scriptState();
}
async function logout(target = page, account = credentials.first) {
    await target.evaluate(async () => {
        rs2b0t.setAutoLogin(false);
        rs2b0t.runner.stop('Hallumina acceptance logout');
        if (__rs2b0t.Bank.isOpen()) await __rs2b0t.Bank.close();
        rs2b0t.actions.closeModal();
        await __rs2b0t.Game.openSideTab(10);
    });
    await delay(400);
    assert(await target.evaluate(() => rs2b0t.actions.ifButton(2458)), 'Native Logout button was unavailable.');
    await target.waitForFunction(() => !rs2b0t.client.ingame, undefined, { timeout: 20_000 });
    await poll('Account service logout/save acknowledgement', 20_000, () => !online(account));
}
async function snapshot() {
    return page.evaluate(() => {
        const r = rs2b0t.reader;
        const items = list => list.map(({ id, slot, name, count }) => ({ id, slot, name, count }));
        return {
            tile: r.worldTile(), stats: Array.from({ length: r.skillCount() }, (_, i) => r.stat(i)),
            inventory: items(r.inventory()), equipment: items(r.equipment()),
            bank: items(r.bankItems()), bankSide: items(r.bankSideItems()),
            bankOpen: __rs2b0t.Bank.isOpen(), bankReady: __rs2b0t.Bank.ready(),
            bankSnapshotReady: r.bankSnapshotReady(), bankSideSnapshotReady: r.bankSideSnapshotReady(),
            combat: r.inCombat(), combatCycle: rs2b0t.client.localPlayer?.combatCycle,
            loopCycle: rs2b0t.client.constructor.loopCycle, deltime: rs2b0t.client.deltime,
            ingame: r.ingame(), scene: r.sceneState(), modals: r.modals()
        };
    });
}
async function scriptState() {
    return page.evaluate(() => ({ name: rs2b0t.runner.meta?.name, state: rs2b0t.runner.state,
        status: rs2b0t.runner.bot?.status, reason: rs2b0t.runner.ctx?.stopReason,
        logs: rs2b0t.runner.ctx?.log, tile: rs2b0t.reader.worldTile(),
        tick: __rs2b0t.Game.tick(), ingame: rs2b0t.reader.ingame(), scene: rs2b0t.reader.sceneState() }));
}
async function startScript(name, settings) {
    await page.evaluate(({ name, settings }) => {
        const meta = rs2b0t.registry.get(name);
        if (!meta) throw new Error(`Original script library lacks ${name}`);
        for (const [key, value] of Object.entries(settings)) {
            const def = meta.settingsSchema?.[key];
            if (!def) throw new Error(`${name}: unsupported setting ${key}`);
            if (def.options && !def.options.includes(String(value))) throw new Error(`${name}: unsupported ${key}=${value}`);
            rs2b0t.settings.save(name, key, String(value));
        }
        rs2b0t.runner.start(meta);
    }, { name, settings });
}
async function watch(label, timeout, done, allowFinished = false) {
    const samples = [];
    const file = `${label.replaceAll(' ', '-')}.json`;
    let tick, tickChanged = Date.now();
    try {
        await poll(label, timeout, async () => {
            const state = await bounded('Read script state', 5000, scriptState);
            samples.push({ elapsedMs: Date.now() - started, ...state });
            if (state.tick !== tick) { tick = state.tick; tickChanged = Date.now(); }
            assert(Date.now() - tickChanged < 20_000, `${label}: server/client tick stalled for 20s`);
            assert(state.ingame, `${label}: script was interrupted by logout`);
            if (await bounded(`${label} observations`, 5000, done)) return true;
            assert(allowFinished || state.state === 'running', `${label}: original runner ${state.state}: ${state.reason ?? state.status}`);
            return false;
        });
    } finally { write(file, samples); }
}
function inspect(account, label) {
    const output = command('scripts/persistence.mjs', ['inspect', account.username], 30_000);
    const data = JSON.parse(output.slice(output.indexOf('{')));
    write(`${label}.json`, data);
    return data;
}
const count = (list, name) => list.filter(item => item?.name?.toLowerCase() === name.toLowerCase()).reduce((n, item) => n + item.count, 0);
const totalItems = snap => {
    const counts = {};
    for (const item of [...snap.inventory, ...snap.equipment, ...snap.bank]) if (item) counts[item.id] = (counts[item.id] ?? 0) + item.count;
    return counts;
};
async function fixture(account = credentials.first) {
    await login(page, account);
    // Resolve the native Accept button from the pinned packed interface map.
    const mapping = fs.readFileSync(path.join(runtime, 'content/pack/interface.pack'), 'utf8');
    const id = Number(mapping.match(/^(\d+)=player_kit:accept$/m)?.[1]);
    assert(Number.isInteger(id), 'Pinned character-design Accept component missing.');
    assert(await page.evaluate(id => rs2b0t.actions.ifButton(id), id));
    await page.waitForFunction(() => rs2b0t.reader.modals().main === -1, undefined, { timeout: 10_000 });
    assert(await page.evaluate(() => __rs2b0t.Npcs.query().name('RuneScape Guide').nearest()?.interact('Talk-to')), 'Tutorial guide Talk-to unavailable.');
    await page.waitForFunction(() => __rs2b0t.ChatDialog.canContinue(), undefined, { timeout: 10_000 });
    assert((await page.evaluate(() => __rs2b0t.ChatDialog.texts().join(' '))).includes('skip the tutorial'), 'Upstream skip dialogue was not offered.');
    await page.evaluate(() => __rs2b0t.ChatDialog.continue());
    await page.waitForFunction(() => __rs2b0t.ChatDialog.options().includes('Yes please.'), undefined, { timeout: 10_000 });
    await page.evaluate(() => __rs2b0t.ChatDialog.chooseOption('Yes please.'));
    await page.waitForFunction(() => { const t = rs2b0t.reader.worldTile(); return t?.x === 3222 && t.z === 3222 && rs2b0t.client.sceneState === 2; }, undefined, { timeout: 20_000 });
    await delay(1500);
    if (account === credentials.first) evidence.snapshots.fixture = await snapshot();
    else evidence.snapshots.fixtureSecond = await snapshot();
    await logout(page, account);
}
let failure;
try {
    await phase('fresh runtime, real cache and published bundles', async () => {
        command('scripts/runtime.mjs', ['prepare']);
        command('scripts/runtime.mjs', ['build']);
        command('scripts/accounts.mjs', ['init', ...process.argv.slice(2).filter(arg => arg === '--offline-sql')]);
        command('scripts/deploy-rs2b0t.mjs');
        command('scripts/verify-deployment.mjs');
        ({ engine, config } = runtimeInfo());
        assert(config.login.enabled && config.node.production && !config.node.debug && config.node.xpRate === 1);
        const { chromium } = createRequire(path.join(root, 'rs2b0t/package.json'))('playwright-core');
        browser = await chromium.launch({ executablePath: process.env.HALLUMINA_CHROMIUM_BIN ?? '/usr/bin/chromium', headless: true,
            args: ['--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
        const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
        context.setDefaultTimeout(15_000);
        const origin = `http://127.0.0.1:${config.web.port}/`;
        await context.route('**/*', route => route.request().url().startsWith(origin) || /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
        page = await context.newPage();
        evidence.browserErrors = [];
        page.on('pageerror', error => evidence.browserErrors.push(error.message));
    });
    await phase('upstream tutorial fixture only', async () => {
        production(false);
        await startServer(true);
        await fixture();
        if (process.argv.includes('--fisher')) await fixture(credentials.second);
        await stopServer();
        production(true);
        evidence.snapshots.fixtureSave = inspect(credentials.first, 'fixture-save');
        const save = evidence.snapshots.fixtureSave;
        assert.equal(save.tutorial, 1000);
        assert.equal(save.xpTenths[8], 0, 'Fixture must not grant Woodcutting XP.');
        assert.equal(count(save.inventories.inv, 'logs'), 0, 'Fixture logs must not count as earned.');
        assert.equal(count(save.inventories.bank, 'coins'), 25);
        evidence.fixtureGrants = save.inventories;
    });
    await phase('original Woodcutter earns logs and XP', async () => {
        await startServer();
        await login();
        await page.evaluate(() => rs2b0t.actions.closeModal());
        const before = evidence.snapshots.beforeChop = await snapshot();
        await startScript('Woodcutter', { treeName: 'Tree', location: 'Use Custom Position', customLocation: '3233,3245,0',
            bank: false, purgePackOnStart: false, packJunk: 'Off', burnMode: 'Off', tickManip: 'Off', toolAcquire: 'Off', forgetfulBank: false });
        await watch('Woodcutter gathering', 180_000, async () => {
            const now = await snapshot();
            return count(now.inventory, 'Logs') >= count(before.inventory, 'Logs') + 2 && now.stats[8].xp >= before.stats[8].xp + 50;
        });
        await stopScript();
        // Stopping the runner does not cancel an already sent native chop. Walk
        // one ordinary tile to stop that action before taking the final baseline.
        assert(await page.evaluate(() => { const t = rs2b0t.reader.worldTile(); const c = rs2b0t.client; return rs2b0t.actions.walkTo(t.x + 1 - c.mapBuildBaseX, t.z - c.mapBuildBaseZ); }), 'Native step to interrupt the final chop failed.');
        await delay(1800);
        const after = evidence.snapshots.afterChop = await snapshot();
        const logs = count(after.inventory, 'Logs') - count(before.inventory, 'Logs');
        assert(logs >= 2);
        assert.equal(after.stats[8].xp - before.stats[8].xp, logs * 25, 'Native Tree yield must match 25 XP per earned log.');
        assert.notDeepEqual(after.tile, before.tile, 'Woodcutter never navigated to the tree location.');
        evidence.woodcutting = { logs, xpBefore: before.stats[8].xp, xpAfter: after.stats[8].xp };
        await page.screenshot({ path: path.join(evidenceDir, 'earned-logs.png') });
    });
    await phase('original Woodcutter travels and banks earned logs', async () => {
        const before = evidence.snapshots.afterChop;
        const bankBefore = evidence.snapshots.fixtureSave.inventories.bank;
        evidence.bankingBefore = { inventory: before.inventory, equipment: before.equipment, bank: bankBefore };
        const earned = count(before.inventory, 'Logs');
        await startScript('Woodcutter', { bank: true, bankLocation: 'Varrock East', purgePackOnStart: true });
        await watch('Woodcutter banking', 240_000, async () => {
            const now = await snapshot();
            if (now.bankOpen && now.bankReady && count(now.bank, 'Logs') === earned && count(now.bankSide, 'Logs') === 0) {
                evidence.snapshots.bankAcknowledged = now;
                return true;
            }
            return false;
        });
        await stopScript();
        const ack = evidence.snapshots.bankAcknowledged;
        assert.equal(count(bankBefore, 'logs'), 0);
        assert.equal(count(ack.bank, 'Logs'), earned);
        assert(Math.max(Math.abs(ack.tile.x - 3253), Math.abs(ack.tile.z - 3420)) <= 8, 'Banking did not reach Varrock East.');
        // Bank-side inventory is authoritative while the bank replaces the tab.
        const combined = { inventory: ack.bankSide, equipment: ack.equipment, bank: ack.bank };
        const expected = totalItems({ inventory: before.inventory, equipment: before.equipment, bank: bankBefore });
        assert.deepEqual(totalItems(combined), expected, 'Banking lost or created items, including protected starter supplies.');
        assert(count([...ack.bankSide, ...ack.equipment], 'Bronze axe') >= 1, 'Essential axe was banked/lost.');
        evidence.banking = { bankBeforeLogs: 0, inventoryBeforeLogs: earned, bankAfterLogs: count(ack.bank, 'Logs'), inventoryAfterLogs: count(ack.bankSide, 'Logs'), itemsConserved: true, axeRetained: true };
        await page.screenshot({ path: path.join(evidenceDir, 'bank-acknowledged.png') });
        await logout();
        await stopServer();
        const save = evidence.snapshots.earnedSave = inspect(credentials.first, 'earned-save');
        assert.equal(count(save.inventories.bank, 'logs'), earned);
        assert.equal(count(save.inventories.inv, 'logs'), 0);
        assert.equal(save.xpTenths[8], evidence.snapshots.afterChop.stats[8].xp * 10);
    });
    await phase('normal restart, reauthentication and authoritative save equality', async () => {
        await startServer();
        await login();
        evidence.snapshots.reconnected = await snapshot();
        assert.equal(evidence.snapshots.reconnected.stats[8].xp * 10, evidence.snapshots.earnedSave.xpTenths[8]);
        await logout();
        await stopServer();
        inspect(credentials.first, 'restarted-save');
        command('scripts/compare-persistence.mjs', [path.join(evidenceDir, 'earned-save.json'), path.join(evidenceDir, 'restarted-save.json')]);
    });
    if (process.argv.includes('--fisher')) await phase('bounded original Fisher diagnosis (separate from Woodcutter acceptance)', async () => {
        await startServer();
        await login();
        await page.evaluate(() => rs2b0t.actions.closeModal());
        const result = evidence.fisher = { result: 'INCOMPLETE', restockAccount: 'first', gatheringAccount: 'second', samples: [] };
        let gatheringAccount = credentials.first;
        const sample = async () => {
            const state = { elapsedMs: Date.now() - started, accountRole: gatheringAccount === credentials.first ? 'first (restock)' : 'second (gather)', snapshot: await snapshot(), script: await scriptState(),
                gear: await page.evaluate(() => ({
                    inventoryNet: __rs2b0t.Inventory.count('Small fishing net'), bankNet: __rs2b0t.Bank.count('Small fishing net'),
                    plan: __rs2b0t.fishingRestockPlan(__rs2b0t.FISHING_METHODS[0], n => __rs2b0t.Inventory.count(n), n => __rs2b0t.Bank.count(n)),
                    npcs: rs2b0t.reader.npcs().filter(n => n.name === 'Fishing spot')
                })) };
            result.samples.push(state);
            write('fisher-diagnostic.json', result);
            return state;
        };
        try {
            // Woodcutter is stopped as soon as its earned logs are banked, so
            // its startup purge may leave the fixture net carried. Establish
            // missing gear using an acknowledged REAL deposit before restocking.
            result.beforeRestockPreparation = await sample();
            assert(await bounded('Native net preparation bank open', 15_000, () => page.evaluate(() => __rs2b0t.Bank.openNearest('Bank booth', 'Use-quickly'))));
            if (await page.evaluate(() => __rs2b0t.Inventory.count('Small fishing net') > 0)) {
                assert(await page.evaluate(() => __rs2b0t.Bank.deposit('Small fishing net')), 'Native fixture-net deposit failed.');
            }
            await poll('Native fixture-net deposit acknowledgement', 10_000, async () => {
                const s = await sample();
                return s.snapshot.bankReady && s.gear.inventoryNet === 0 && s.gear.bankNet === 1;
            });
            result.preparedRestock = await sample();
            assert(await page.evaluate(() => __rs2b0t.Bank.close()));
            assert.equal(await page.evaluate(() => __rs2b0t.Inventory.count('Small fishing net')), 0, 'Restock must begin with the net absent from inventory.');
            await startScript('Fisher', { fishMethod: 'Small net — shrimp/anchovy', bank: false, purgePackOnStart: false,
                location: 'Use Start Position', cookMode: 'Off', tickManip: 'Off', toolAcquire: 'Off', packJunk: 'Off' });
            await poll('Fisher automatic net restock', 90_000, async () => {
                const state = await bounded('Fisher restock observations', 5000, sample);
                return state.gear.inventoryNet > 0 || !['running', 'stopping'].includes(state.script.state);
            });
            result.automaticRestock = (await sample()).gear.inventoryNet > 0;
            if (result.automaticRestock) assert((await scriptState()).logs.some(line => line.msg.includes('restock: withdraw 1× Small fishing net')), 'Fisher did not issue its own net withdrawal.');
            await stopScript();
            if (!result.automaticRestock) {
                // Native withdrawal control is diagnostic only, never a Fisher pass.
                assert(await bounded('Native diagnostic bank open', 15_000, () => page.evaluate(() => __rs2b0t.Bank.openNearest('Bank booth', 'Use-quickly'))));
                await sample();
                assert(await page.evaluate(() => __rs2b0t.Bank.withdraw('Small fishing net')), 'Native diagnostic net withdrawal failed.');
                await poll('Native diagnostic net acknowledgement', 10_000, async () => (await sample()).gear.inventoryNet > 0);
                result.nativeWithdrawalControl = true;
            }
            if (await page.evaluate(() => __rs2b0t.Bank.isOpen())) assert(await page.evaluate(() => __rs2b0t.Bank.close()));
            // Keep the restock and gather diagnoses independent. A second fresh
            // mainland fixture separates bank-to-shore transit from restocking.
            // Both accounts use the original Fisher. Freeform mode can die.
            await logout();
            gatheringAccount = credentials.second;
            await login(page, gatheringAccount);
            await page.evaluate(() => rs2b0t.actions.closeModal());
            // Pinned r289 small-net spots are at Al Kharid (0_51_49_saltfish),
            // with Net+Bait. Do not assume a later-revision Lumbridge swamp spot.
            await startScript('WalkTo', { customTile: '3270,3145,0', arriveRadius: 1 });
            await watch('Fisher shore travel', 180_000, async () => {
                const s = await sample(), t = s.snapshot.tile;
                return t && Math.max(Math.abs(t.x - 3270), Math.abs(t.z - 3145)) <= 1;
            }, true);
            await stopScript();
            const before = result.beforeGather = await sample();
            await startScript('Fisher', { location: 'Use Start Position', leashRadius: 18 });
            await poll('Original Fisher native catch and XP', 90_000, async () => {
                const now = await bounded('Fisher gather observations', 5000, sample);
                if (!now.snapshot.ingame || !['running', 'stopping'].includes(now.script.state)) throw new Error(`Fisher interrupted: ${now.script.reason ?? now.script.state}`);
                return now.snapshot.stats[10].xp > before.snapshot.stats[10].xp && count(now.snapshot.inventory, 'Raw shrimps') > count(before.snapshot.inventory, 'Raw shrimps');
            });
            result.afterGather = await sample();
            result.result = result.automaticRestock ? 'PASS: original Fisher restocked and caught fish with XP' : 'PARTIAL: original Fisher gathers; automatic restock incomplete (native withdrawal control passed)';
        } catch (error) { result.error = error.message; await sample(); }
        finally {
            await stopScript();
            await logout(page, gatheringAccount);
            await stopServer();
            result.restockSave = inspect(credentials.first, 'fisher-restock-save');
            if (result.automaticRestock) {
                assert.equal(count(result.restockSave.inventories.inv, 'net'), 1);
                assert.equal(count(result.restockSave.inventories.bank, 'net'), 0);
            }
            result.saved = inspect(gatheringAccount, 'fisher-save');
            if (result.afterGather) {
                assert(result.saved.xpTenths[10] >= result.afterGather.snapshot.stats[10].xp * 10, 'Fisher XP did not persist.');
                const fish = result.afterGather.snapshot.inventory.find(item => item.name === 'Raw shrimps');
                assert(fish && result.saved.inventories.inv.some(item => item?.id === fish.id && item.count >= fish.count), 'Fisher catch did not persist.');
            }
            write('fisher-diagnostic.json', result);
        }
    });
    await phase('native authentication, negative password and actual MultiBox regression', async () => {
        await startServer();
        process.env.HALLUMINA_CREDENTIALS_FILE = path.join(evidenceDir, 'credentials.json');
        for (const [index, mode] of ['native', 'bot', 'multibox'].entries()) {
            // Original clients share a device ID. Respect the native 15s login
            // attempt window between suites rather than changing rate limits.
            if (index > 0) await delay(16_000);
            command('scripts/browser-acceptance.mjs', [mode], 180_000);
        }
        await stopServer();
    });
    assert.deepEqual(evidence.browserErrors, [], 'Critical browser errors.');
    evidence.result = 'PASS';
} catch (error) {
    failure = error;
    evidence.result = 'FAIL';
    evidence.error = error.message;
    try { evidence.failureScript = await bounded('Failure diagnostics', 5000, scriptState); evidence.failureSnapshot = await bounded('Failure snapshot', 5000, snapshot); } catch { /* browser may have exited */ }
    try { await page?.screenshot({ path: path.join(evidenceDir, 'failure.png'), timeout: 5000 }); } catch { /* retained other evidence */ }
} finally {
    try { if (page && await bounded('Cleanup scene read', 3000, () => page.evaluate(() => rs2b0t.client.ingame))) await bounded('Cleanup normal logout', 30_000, logout); }
    catch (error) { evidence.cleanupLogoutError = error.message; }
    await browser?.close();
    try { await stopServer(); } catch (error) { evidence.shutdownError = error.message; failure ??= error; evidence.result = 'FAIL'; }
    if (config && !config.node.production) production(true);
    persist();
}
console.log(JSON.stringify({ result: evidence.result, durationMs: evidence.durationMs, woodcutting: evidence.woodcutting, banking: evidence.banking, fisher: evidence.fisher?.result ?? 'NOT_REQUESTED', evidenceDir }));
if (failure) { console.error(failure.message); process.exitCode = 1; }
