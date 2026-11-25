import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createPublicKey, createHash } from 'node:crypto';
import { root, manifest, verify } from './verify-upstreams.mjs';

export function externalPath(requested) {
    assert(requested && path.isAbsolute(requested), 'Set HALLUMINA_RUNTIME_DIR to an absolute external runtime directory.');
    const destination = path.resolve(requested);
    let ancestor = destination;
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    const actual = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, destination));
    const repo = fs.realpathSync(root);
    assert(actual !== repo && !actual.startsWith(repo + path.sep) && !repo.startsWith(actual + path.sep), 'Runtime must be outside and cannot contain the checkout.');
    return actual;
}

export function runtimeInfo() {
    verify({ quiet: true });
    const runtime = externalPath(process.env.HALLUMINA_RUNTIME_DIR);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime, 'hallumina-runtime.json'))), { revision: manifest.revision, upstreams: manifest.upstreams }, 'Runtime pins differ; prepare a NEW runtime.');
    const engine = path.join(runtime, 'engine');
    // Writes must never follow runtime asset/state aliases into another world.
    for (const relative of ['engine', 'content', 'engine/data', 'engine/data/config', 'engine/data/players', 'engine/public', 'engine/public/client', 'engine/public/bot', 'engine/db.sqlite']) {
        const file = path.join(runtime, relative);
        if (fs.existsSync(file)) assert(!fs.lstatSync(file).isSymbolicLink(), `Refusing runtime symlink: ${relative}`);
    }
    const noLinks = file => {
        const stat = fs.lstatSync(file);
        assert(!stat.isSymbolicLink(), `Refusing runtime symlink: ${file}`);
        if (stat.isDirectory()) for (const name of fs.readdirSync(file)) noLinks(path.join(file, name));
    };
    noLinks(path.join(engine, 'data'));
    noLinks(path.join(engine, 'public'));
    const config = JSON.parse(fs.readFileSync(path.join(engine, 'data/config/world.json')));
    assert.equal(config.engine?.revision, 289);
    assert.equal(config.build?.srcDir, '../content');
    return { runtime, engine, config };
}

export function lock(runtime) {
    const file = path.join(runtime, '.hallumina-operation.lock');
    let fd;
    try { fd = fs.openSync(file, 'wx', 0o600); }
    catch { throw new Error(`Runtime is locked: ${file}. Stop its launcher first. After a crash, verify no processes/listeners remain before removing this lock.`); }
    fs.writeFileSync(fd, `${process.pid}\n`);
    fs.closeSync(fd);
    const release = () => { if (fs.existsSync(file)) fs.unlinkSync(file); };
    process.once('exit', release);
    return () => { process.removeListener('exit', release); release(); };
}

export async function assertStopped(config) {
    const ports = [config.web.port, config.web.managementPort, config.node.port, ...['login', 'friend', 'logger'].filter(s => config[s]?.enabled).map(s => config[s].port)];
    assert.equal(new Set(ports).size, ports.length, 'Runtime ports must be distinct.');
    for (const port of ports) {
        assert(Number.isInteger(port) && port > 1024 && port < 65536, 'Invalid runtime port.');
        assert(![8000, 8001, 8080, 8081, 8082, 8083, 8085, 9222, 31460, 50002].includes(port), `Reserved Cloud port: ${port}`);
        await new Promise((resolve, reject) => {
            const server = net.createServer();
            server.once('error', () => reject(new Error(`Port ${port} is occupied; stop the runtime before building/deploying/configuring.`)));
            server.listen(port, '0.0.0.0', () => server.close(resolve));
        });
    }
}

export function requireBuild(engine) {
    for (const file of ['data/pack/server/script.dat', 'data/pack/server/script.idx', 'data/pack/mapview/worldmap.jag']) {
        assert(fs.existsSync(path.join(engine, file)) && fs.statSync(path.join(engine, file)).size > 0, `Missing ${file}; run runtime.mjs build.`);
    }
}

export function run(bin, args, cwd, env = process.env) {
    const result = spawnSync(bin, args, { cwd, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${bin} ${args.join(' ')} failed (${result.status ?? result.signal}); fix this stage before retrying.`);
}

export function publicRsa(engine) {
    const key = createPublicKey(fs.readFileSync(path.join(engine, 'data/config/public.pem'))).export({ format: 'jwk' });
    const decimal = v => BigInt('0x' + Buffer.from(v, 'base64url').toString('hex')).toString();
    return { e: decimal(key.e), n: decimal(key.n) };
}
export const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
