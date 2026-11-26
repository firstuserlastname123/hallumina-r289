import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { manifest, root, verify } from './verify-upstreams.mjs';
import { assertStopped, lock, runtimeInfo } from './runtime-lib.mjs';
import { nativeClientWithRsa } from './native-rsa.mjs';

const command = process.argv[2];
assert(['prepare', 'build', 'start', 'smoke'].includes(command), 'Usage: node scripts/runtime.mjs prepare|build|start|smoke');
verify();
const requested = process.env.HALLUMINA_RUNTIME_DIR;
assert(requested && path.isAbsolute(requested), 'Set HALLUMINA_RUNTIME_DIR to an absolute NEW directory outside the checkout.');
const runtime = path.resolve(requested);
// Resolve existing ancestors, including symlinks, before enforcing isolation.
let ancestor = runtime;
while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
const actual = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, runtime));
const repo = fs.realpathSync(root);
assert(actual !== repo && !actual.startsWith(repo + path.sep), 'Runtime must be outside the source checkout.');
assert(!repo.startsWith(actual + path.sep), 'Runtime cannot contain the source checkout.');
const engine = path.join(runtime, 'engine');
const marker = path.join(runtime, 'hallumina-runtime.json');
const provenance = { revision: manifest.revision, upstreams: manifest.upstreams };

function runSync(bin, args, cwd) {
    const result = spawnSync(bin, args, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${bin} failed (${result.status ?? result.signal})`);
}

function archive(name, exclusions = []) {
    const output = path.join(runtime, `${name}.tar`);
    runSync('git', ['archive', '--format=tar', `--output=${output}`, manifest.upstreams[name].commit], path.join(root, name));
    const destination = path.join(runtime, name);
    fs.mkdirSync(destination, { mode: 0o700 });
    runSync('tar', ['-xf', output, '-C', destination, ...exclusions.map(p => `--exclude=${p}`)], runtime);
    fs.unlinkSync(output);
}

if (command === 'prepare') {
    assert(!fs.existsSync(runtime), 'Refusing to overwrite an existing runtime (keys, databases and saves are protected).');
    assert(fs.existsSync(path.join(root, 'engine/node_modules/tsx/package.json')), 'Run bash scripts/install.sh first.');
    fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
    fs.chmodSync(runtime, 0o700);
    archive('engine', ['data/config/private.pem', 'data/config/public.pem']);
    archive('content');
    fs.symlinkSync(path.join(root, 'engine/node_modules'), path.join(engine, 'node_modules'), 'dir');
    const configDir = path.join(engine, 'data/config');
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(root, 'hallumina/config/world.example.json'), path.join(configDir, 'world.json'));
    const pair = generateKeyPairSync('rsa', {
        modulusLength: 1024,
        publicExponent: 65537,
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' }
    });
    fs.writeFileSync(path.join(configDir, 'private.pem'), pair.privateKey, { mode: 0o600 });
    fs.writeFileSync(path.join(configDir, 'public.pem'), pair.publicKey, { mode: 0o600 });

    // Adapt only the generated runtime's prebuilt client to this runtime's public
    // login parameters. Fail closed if the pinned bundle changes unexpectedly.
    const require = createRequire(path.join(root, 'engine/package.json'));
    const forge = require('node-forge');
    const oldKey = forge.pki.publicKeyFromPem(fs.readFileSync(path.join(root, 'engine/data/config/public.pem'), 'utf8'));
    const newKey = forge.pki.publicKeyFromPem(pair.publicKey);
    const clientPath = path.join(engine, 'public/client/client.js');
    const client = nativeClientWithRsa(fs.readFileSync(clientPath, 'utf8'), { e: oldKey.e.toString(10), n: oldKey.n.toString(10) }, { e: newKey.e.toString(10), n: newKey.n.toString(10) });
    fs.writeFileSync(clientPath, client);
    fs.writeFileSync(marker, JSON.stringify(provenance, null, 2) + '\n', { mode: 0o600 });
    console.log(`Prepared ${runtime}; fresh development RSA keys and staged native client. No persistence was copied.`);
} else {
    runtimeInfo();
    const release = lock(runtime);
    await assertStopped(JSON.parse(fs.readFileSync(path.join(engine, 'data/config/world.json'))));
    assert.deepEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), provenance, 'Runtime pins differ; prepare a NEW runtime.');
    const config = JSON.parse(fs.readFileSync(path.join(engine, 'data/config/world.json'), 'utf8'));
    assert.equal(config.engine?.revision, 289, 'Runtime must use revision 289.');
    assert.equal(config.build?.srcDir, '../content', 'Runtime Engine and Content must remain siblings.');
    if (command === 'build') {
        runSync('npm', ['run', 'build'], engine);
    } else if (command === 'smoke') {
        const { smoke } = await import('./smoke.mjs');
        await smoke(engine, config);
    } else {
        // Direct app entrypoint: upstream npm start performs an unfrozen install.
        const entry = config.login.enabled ? path.join(root, 'hallumina/gameplay-entry.mjs') : 'src/app.ts';
        const child = spawn(process.execPath, ['--import', path.join(root, 'hallumina/loopback.mjs'), '--import', 'tsx', entry], { cwd: engine, stdio: 'inherit' });
        for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
        child.on('error', err => { console.error(err); process.exitCode = 1; });
        await new Promise(resolve => child.on('close', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); resolve(); }));
    }
    release();
}
