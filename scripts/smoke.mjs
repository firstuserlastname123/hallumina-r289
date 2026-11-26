import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { root } from './verify-upstreams.mjs';

export async function smoke(engine, config) {
    assert.equal(config.website.registration, false, 'Smoke requires registration disabled.');
    assert.equal(config.node.debug, false, 'Smoke requires debug writes disabled.');
    assert.equal(config.easyStartup, false, 'Smoke must not launch support services.');
    for (const service of ['login', 'friend', 'logger']) assert.equal(config[service].enabled, false);
    for (const file of ['data/pack/server/script.dat', 'data/pack/server/script.idx']) {
        assert(fs.statSync(path.join(engine, file)).size > 0, 'Build the cache before smoke testing.');
    }
    // Refuse to accidentally inspect an unrelated listener.
    const ports = [config.web.port, config.web.managementPort, config.node.port];
    assert.equal(new Set(ports).size, 3, 'Smoke ports must be distinct.');
    const reserved = [22, 8000, 8001, 8080, 8081, 8082, 8083, 8085, 9222, 31460, 50002];
    for (const port of ports) {
        assert(!reserved.includes(port), `Port ${port} is reserved for Cloud services.`);
        const probe = net.createServer();
        probe.listen(port, '0.0.0.0');
        await once(probe, 'listening');
        await new Promise((resolve, reject) => probe.close(err => err ? reject(err) : resolve()));
    }
    const logPath = path.join(engine, '../startup-smoke.log');
    const log = fs.createWriteStream(logPath, { mode: 0o600 });
    const child = spawn(process.execPath, ['--import', path.join(root, 'hallumina/loopback.mjs'), '--import', 'tsx', 'src/app.ts'], { cwd: engine, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output += chunk; log.write(chunk); });
    const closed = once(child, 'close');
    let code;
    let forced = false;
    try {
        const deadline = Date.now() + 180_000;
        let ready = false;
        while (Date.now() < deadline) {
            assert(child.exitCode === null, `Server exited before readiness; see ${logPath}`);
            if (output.includes('World ready')) {
                try {
                    const res = await fetch(`http://127.0.0.1:${config.web.port}/rs2.cgi`, { signal: AbortSignal.timeout(2000) });
                    ready = res.ok && (await res.text()).includes('./client/client.js');
                } catch { /* listeners start after World ready */ }
            }
            if (ready) break;
            await delay(250);
        }
        assert(ready, `Startup timed out; see ${logPath}`);
        const base = `http://127.0.0.1:${config.web.port}`;
        for (const route of ['/client/client.js', '/client/ondemandworker.js', '/client/tinymidipcm.wasm', '/crc0']) {
            const res = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
            assert.equal(res.status, 200, route);
            assert((await res.arrayBuffer()).byteLength > 0, `${route} is empty`);
        }
        const response = await fetch(`http://127.0.0.1:${config.web.managementPort}/setup/config`, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200);
        const effective = (await response.json()).config;
        assert.equal(effective.engine.revision, 289);
        assert.equal(effective.build.srcDir, '../content');
        await new Promise((resolve, reject) => {
            const socket = net.createConnection({ host: '127.0.0.1', port: config.node.port });
            socket.setTimeout(5000, () => socket.destroy(new Error('TCP handshake timeout')));
            socket.on('error', reject);
            socket.on('end', () => { if (bytes.length < 17) reject(new Error('Incomplete native handshake')); });
            // Native r289 login handshake, no username/password or account.
            socket.on('connect', () => socket.write(Buffer.from([14, 0])));
            let bytes = Buffer.alloc(0);
            socket.on('data', chunk => {
                bytes = Buffer.concat([bytes, chunk]);
                if (bytes.length >= 17) {
                    try { assert.equal(bytes[8], 0, 'Native login handshake response'); resolve(); }
                    catch (error) { reject(error); }
                    finally { socket.destroy(); }
                }
            });
        });
        console.log('PASS: cache/scripts, World ready, web/client assets, revision 289 config, native TCP login handshake.');
    } finally {
        child.kill('SIGTERM');
        const timer = setTimeout(() => { forced = true; child.kill('SIGKILL'); }, 30_000);
        try { [code] = await closed; }
        finally { clearTimeout(timer); log.end(); }
    }
    assert(!forced && code === 0 && output.includes('Server shutdown complete'), `Unclean shutdown (${code}); see ${logPath}`);
    assert(!/Uncaught exception|Unhandled Rejection|OnDemand worker error/.test(output), `Runtime errors; see ${logPath}`);
    console.log(`PASS: graceful SIGTERM shutdown (exit 0). Log: ${logPath}`);
}
