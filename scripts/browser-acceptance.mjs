import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { root } from './verify-upstreams.mjs';
import { runtimeInfo, externalPath } from './runtime-lib.mjs';

const mode = process.argv[2];
assert(['native', 'bot', 'multibox'].includes(mode), 'Usage: browser-acceptance.mjs native|bot|multibox');
const { runtime, engine, config } = runtimeInfo();
assert(config.login.enabled && config.node.production && !config.node.debug && !config.db.verbose, 'Start the normal authenticated gameplay configuration first.');
const credentialsFile = externalPath(process.env.HALLUMINA_CREDENTIALS_FILE);
if (!fs.existsSync(credentialsFile)) {
    const suffix = randomBytes(3).toString('hex');
    fs.writeFileSync(credentialsFile, JSON.stringify({
        first: { username: `ha${suffix}`, password: randomBytes(9).toString('hex') },
        second: { username: `hb${suffix}`, password: randomBytes(9).toString('hex') }
    }), { flag: 'wx', mode: 0o600 });
}
assert.equal(fs.statSync(credentialsFile).mode & 0o077, 0, 'Credentials file must be private (chmod 600).');
const credentials = JSON.parse(fs.readFileSync(credentialsFile));
assert.notEqual(credentials.first.username, credentials.second.username, 'MultiBox needs distinct accounts.');
const db = new DatabaseSync(path.join(engine, 'db.sqlite'), { readOnly: true });
db.exec('PRAGMA busy_timeout=5000'); // connection-local wait, never change native DB state
const loggedIn = username => db.prepare('SELECT logged_in FROM account_login JOIN account ON account.id=account_login.account_id WHERE username=? AND profile=?').get(username, 'main')?.logged_in === config.node.id;
async function waitAccount(username, expected) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (loggedIn(username) === expected) return;
        await delay(200);
    }
    throw new Error(`Native account-login state did not become ${expected ? 'online' : 'offline'}.`);
}
const { chromium } = createRequire(path.join(root, 'rs2b0t/package.json'))('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.HALLUMINA_CHROMIUM_BIN ?? '/usr/bin/chromium', headless: true, args: ['--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
const origin = `http://127.0.0.1:${config.web.port}`;
const errors = [], httpErrors = [], responses = [];
await context.route('**/*', route => {
    const url = route.request().url();
    return url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
});
context.on('page', page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
        const url = new URL(response.url());
        const item = { path: url.pathname, status: response.status() }; // never record query/credentials
        responses.push(item);
        if (response.status() >= 400) httpErrors.push(item);
    });
});
async function boot(page) {
    await page.waitForFunction(() => globalThis.rs2b0t?.client.constructor.loopCycle > 10, undefined, { timeout: 60_000 });
}
async function scene(frame) {
    await frame.waitForFunction(() => globalThis.rs2b0t?.client.ingame && globalThis.rs2b0t.client.sceneState === 2, undefined, { timeout: 30_000 });
    // Inventory/varp packets follow the scene transition; don't compare the
    // previous session's client snapshot immediately after ingame flips true.
    await frame.waitForFunction(() => rs2b0t.reader.statsReady());
    await delay(1500);
}
async function logout(frame) {
    await frame.evaluate(async () => { rs2b0t.setAutoLogin(false); rs2b0t.runner.stop('Acceptance logout'); await __rs2b0t.Game.openSideTab(10); });
    await delay(400);
    await frame.evaluate(() => rs2b0t.actions.ifButton(2458));
    await frame.waitForFunction(() => !rs2b0t.client.ingame, undefined, { timeout: 20_000 });
}
async function snapshot(frame) {
    return frame.evaluate(() => ({
        tile: rs2b0t.reader.worldTile(), selfSlot: rs2b0t.reader.selfSlot(),
        inventory: rs2b0t.reader.inventory().map(({ id, name, count }) => ({ id, name, count })),
        stats: Array.from({ length: rs2b0t.reader.skillCount() }, (_, i) => rs2b0t.reader.stat(i))
    }));
}
const page = await context.newPage();
const evidence = { mode, checks: [], snapshots: [] };
try {
    if (mode === 'native') {
        assert(!loggedIn(credentials.first.username), 'Log out the first account before this test.');
        await page.goto(origin + '/rs2.cgi');
        await page.waitForFunction(() => document.querySelector('canvas')?.width === 765);
        await delay(10_000);
        await page.locator('canvas#canvas').click({ position: { x: 462, y: 292 }, delay: 100 });
        await page.keyboard.type(credentials.first.username, { delay: 40 });
        await page.keyboard.press('Tab');
        await page.keyboard.type(credentials.first.password, { delay: 40 });
        await page.locator('canvas#canvas').click({ position: { x: 302, y: 322 }, delay: 100 });
        await waitAccount(credentials.first.username, true);
        await delay(3000);
        await page.screenshot({ path: path.join(runtime, 'acceptance-native.png') });
        evidence.checks.push('Native browser login acknowledged by upstream account service; screenshot requires visual inspection.');
        await page.locator('canvas#canvas').hover({ position: { x: 648, y: 480 } });
        await delay(300);
        await page.locator('canvas#canvas').click({ position: { x: 648, y: 480 }, delay: 100 });
        await delay(300);
        await page.locator('canvas#canvas').hover({ position: { x: 647, y: 375 } });
        await delay(300);
        await page.locator('canvas#canvas').click({ position: { x: 647, y: 375 }, delay: 100 });
        await waitAccount(credentials.first.username, false);
        evidence.checks.push('Normal native logout acknowledged. Gameplay/XP and restart comparisons are separate acceptance steps.');
    } else if (mode === 'bot') {
        assert(!loggedIn(credentials.first.username), 'Log out the first account before this test.');
        await page.goto(origin + '/bot.html');
        await boot(page);
        await page.evaluate(({ username, password }) => rs2b0t.actions.login(username, password), credentials.first);
        await scene(page);
        await waitAccount(credentials.first.username, true);
        evidence.snapshots.push(await snapshot(page));
        assert((await page.evaluate(() => rs2b0t.registry.list().map(meta => meta.name))).includes('Woodcutter'));
        await page.screenshot({ path: path.join(runtime, 'acceptance-bot.png') });
        await logout(page);
        await waitAccount(credentials.first.username, false);
        const negative = await context.newPage();
        await negative.goto(origin + '/bot.html');
        await boot(negative);
        assert(await negative.evaluate(({ username }) => rs2b0t.actions.login(username, 'wrong-' + Date.now().toString(36)), credentials.first), 'Negative login attempt was not accepted by the client.');
        try {
            await negative.waitForFunction(() => !rs2b0t.client.ingame && /invalid.*(username|password)/i.test(rs2b0t.client.loginMes1 + ' ' + rs2b0t.client.loginMes2), undefined, { timeout: 20_000 });
        } catch {
            const message = await negative.evaluate(() => rs2b0t.client.loginMes1 + ' ' + rs2b0t.client.loginMes2);
            throw new Error(`Negative login did not reach password rejection: ${message}. The native rate limits remain enabled; let their window expire before another run.`);
        }
        assert(!loggedIn(credentials.first.username), 'Wrong password authenticated.');
        evidence.checks.push('Incorrect password rejected by native authentication.');
        evidence.checks.push('Original bot client login, scene 2, script library, state read and native logout. Script execution is a separate acceptance step.');
    } else {
        for (const account of Object.values(credentials)) assert(!loggedIn(account.username), 'Log out both accounts before this test.');
        await page.goto(origin + '/multibox.html');
        await page.waitForFunction(() => !!globalThis.multibox);
        for (const [index, account] of Object.values(credentials).entries()) {
            await page.locator('#mbx-add').click();
            if (index === 0) {
                await page.locator('#mbx-vault-pass').fill(credentials.second.password);
                await page.locator('#mbx-vault-confirm').fill(credentials.second.password);
                await page.locator('#mbx-vault-go').click();
            }
            await page.locator('#mbx-new-user').fill(account.username);
            await page.locator('#mbx-new-pass').fill(account.password);
            await page.locator('#mbx-new-go').click();
        }
        await page.waitForFunction(() => globalThis.multibox.slots().length === 2 && multibox.slots().every(slot => slot.ready), undefined, { timeout: 60_000 });
        const frames = page.frames().filter(frame => frame !== page.mainFrame());
        assert.equal(frames.length, 2);
        for (const frame of frames) await frame.evaluate(() => rs2b0t.setAutoLogin(true));
        for (const frame of frames) { await scene(frame); evidence.snapshots.push(await snapshot(frame)); }
        for (const account of Object.values(credentials)) await waitAccount(account.username, true);
        assert.notEqual(evidence.snapshots[0].selfSlot, evidence.snapshots[1].selfSlot);
        await page.screenshot({ path: path.join(runtime, 'acceptance-multibox.png') });
        await logout(frames[0]);
        assert(await frames[1].evaluate(() => rs2b0t.client.ingame), 'Second session dropped when first logged out.');
        await frames[0].evaluate(() => rs2b0t.setAutoLogin(true));
        await scene(frames[0]);
        assert(await frames[1].evaluate(() => rs2b0t.client.ingame));
        for (const frame of frames) await logout(frame);
        for (const account of Object.values(credentials)) await waitAccount(account.username, false);
        evidence.checks.push('Actual MultiBox profiles, two authenticated sessions with distinct player slots, independent logout/reconnect and normal logout. Script/action isolation is a separate acceptance step.');
    }
    assert.deepEqual(errors, [], 'Critical browser JavaScript errors.');
    // This optional hosted telemetry route is absent in the pinned local Engine.
    assert.deepEqual(httpErrors.filter(item => item.path !== '/__rs2b0t/resources'), [], 'Required assets failed.');
    for (const archive of ['title', 'config', 'interface', 'media', 'versionlist', 'textures', 'wordenc', 'sounds']) assert(responses.some(r => r.path.startsWith('/' + archive) && r.status === 200), `Missing cache archive: ${archive}`);
    evidence.httpErrors = httpErrors;
    evidence.result = 'PASS for the listed checks only';
    fs.writeFileSync(path.join(runtime, `acceptance-${mode}.json`), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
    evidence.result = 'FAIL';
    evidence.error = error.message;
    evidence.frames = [];
    for (const candidate of context.pages()) for (const frame of candidate.frames()) {
        try {
            const state = await Promise.race([
                frame.evaluate(() => globalThis.rs2b0t ? ({ ingame: rs2b0t.client.ingame, scene: rs2b0t.client.sceneState,
                    loginMessage: rs2b0t.client.loginMes1 + ' ' + rs2b0t.client.loginMes2,
                    loopCycle: rs2b0t.client.constructor.loopCycle, tile: rs2b0t.reader.worldTile(), runner: rs2b0t.runner.state }) : null),
                delay(3000).then(() => ({ diagnosticTimeout: true }))
            ]);
            evidence.frames.push(state);
        } catch { evidence.frames.push({ detached: true }); }
    }
    evidence.httpErrors = httpErrors;
    evidence.browserErrors = errors;
    fs.writeFileSync(path.join(runtime, `acceptance-${mode}-failure.json`), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
    await page.screenshot({ path: path.join(runtime, `acceptance-${mode}-failure.png`), timeout: 5000 }).catch(() => {});
    throw error;
} finally { await browser.close(); db.close(); }
