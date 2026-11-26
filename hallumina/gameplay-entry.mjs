import assert from 'node:assert/strict';
import { isMainThread, Worker, workerData } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const engine = isMainThread ? process.cwd() : workerData;
const { default: environment } = await import(pathToFileURL(`${engine}/src/util/Environment.ts`));
const tutorialFixture = process.env.HALLUMINA_UPSTREAM_TUTORIAL_FIXTURE === '1';
assert(environment.login.enabled && (environment.node.production || tutorialFixture) && !environment.node.debug, 'Authenticated gameplay requires production=true. Only an explicit HALLUMINA_UPSTREAM_TUTORIAL_FIXTURE=1 permits the upstream tutorial-skip fixture.');
assert(!environment.easyStartup && !environment.friend.enabled && !environment.logger.enabled);
assert.equal(environment.login.host, '127.0.0.1');
if (!isMainThread) {
    // Suppress the standalone login process's duplicate management listener.
    // Only this worker's configuration object changes. The native app stays in
    // normal, authenticated mode; no authentication or save logic is replaced.
    environment.easyStartup = true;
    await import(pathToFileURL(`${engine}/src/login.ts`));
} else {
    if (!environment.node.production) console.log('LOCAL UPSTREAM TUTORIAL FIXTURE: native guide offers skip; upstream grants developer privileges. Use only disposable accounts; stop and restore production=true after the dialogue.');
    const login = new Worker(new URL(import.meta.url), { workerData: engine });
    login.on('error', error => { console.error(error); process.exit(1); });
    login.on('exit', code => { console.error(`Login worker exited (${code})`); process.exit(1); });
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
        ready = await new Promise(resolve => {
            const socket = net.createConnection(environment.login.port, '127.0.0.1');
            socket.on('connect', () => { socket.destroy(); resolve(true); });
            socket.on('error', () => resolve(false));
        });
        if (!ready) await delay(100);
    }
    assert(ready, 'Native login service did not become ready. Check SQLite migrations.');
    await import(pathToFileURL(`${engine}/src/app.ts`));
}
