import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, manifest } from './verify-upstreams.mjs';
import { runtimeInfo, lock, assertStopped, requireBuild, run, publicRsa, sha256 } from './runtime-lib.mjs';
import { verifyNativeRsa } from './native-rsa.mjs';

const { runtime, engine, config } = runtimeInfo();
const release = lock(runtime);
try {
    await assertStopped(config);
    requireBuild(engine);
    assert(fs.existsSync(path.join(root, 'rs2b0t/node_modules/playwright-core/package.json')), 'Run bash scripts/install.sh before deploying.');
    for (const file of ['bot.html', 'multibox.html']) assert(!fs.existsSync(path.join(engine, 'public', file)), 'Bot deployment already exists. Use a new prepared runtime; existing assets are protected.');
    assert(!fs.existsSync(path.join(engine, 'public/bot')), 'Existing bot assets are protected.');
    const rsa = publicRsa(engine);
    verifyNativeRsa(fs.readFileSync(path.join(engine, 'public/client/client.js'), 'utf8'), rsa);
    const env = { ...process.env, TARGET: 'local', RS2B0T_TARGET: 'local', RS2B0T_GIT_COMMIT: manifest.upstreams.rs2b0t.commit, RS2B0T_GIT_DIRTY: '0', LOCAL_RSAE: rsa.e, LOCAL_RSAN: rsa.n, LOGIN_RSAE: rsa.e, LOGIN_RSAN: rsa.n };
    delete env.B0T_OUT_DIR;
    const staging = fs.mkdtempSync(path.join(runtime, 'rs2b0t-build-'));
    const archive = path.join(staging, 'source.tar');
    run('git', ['archive', '--format=tar', `--output=${archive}`, manifest.upstreams.rs2b0t.commit], path.join(root, 'rs2b0t'));
    run('tar', ['-xf', archive, '-C', staging], staging);
    fs.unlinkSync(archive);
    fs.symlinkSync(path.join(root, 'rs2b0t/node_modules'), path.join(staging, 'node_modules'), 'dir');
    // Always regenerate against THIS runtime's local cache. No stale shared out/.
    run('bun', ['tools/nav/build-collision.ts', '--engine', engine, '--members', String(config.node.members), '--verify', 'true'], staging, env);
    run('bun', ['tools/map/build-basemap.ts', '--engine', engine, '--jag', path.join(engine, 'data/pack/mapview/worldmap.jag'), '--revision', '289'], staging, env);
    // Run the actual pinned deploy script into a publication sandbox. Retain the
    // verified native client byte-for-byte at /rs2.cgi, as required by Hallumina.
    const target = path.join(staging, 'deployment');
    fs.mkdirSync(path.join(target, 'public/client'), { recursive: true });
    fs.copyFileSync(path.join(engine, 'public/client/SCC1_Florestan.sf2'), path.join(target, 'public/client/SCC1_Florestan.sf2'));
    run('sh', ['tools/deploy-local.sh'], staging, { ...env, ENGINE_DIR: target });
    const out = path.join(staging, 'out');
    for (const file of ['client.js', 'botclient.js', 'multibox.js']) {
        const source = fs.readFileSync(path.join(out, file), 'utf8');
        if (file !== 'multibox.js') assert(source.includes(rsa.n) && source.includes(rsa.e), `${file}: public RSA mismatch`);
        assert(!source.includes('PRIVATE KEY'), `${file}: unexpected private key material`);
    }
    const publicDir = path.join(engine, 'public');
    const nativeHash = sha256(path.join(publicDir, 'client/client.js'));
    assert(fs.readFileSync(path.join(publicDir, 'client/client.js'), 'utf8').includes(rsa.n), 'Preserved native client key does not match runtime.');
    fs.cpSync(path.join(target, 'public/bot'), path.join(publicDir, 'bot'), { recursive: true, errorOnExist: true, force: false });
    for (const file of ['bot.html', 'multibox.html']) fs.copyFileSync(path.join(target, 'public', file), path.join(publicDir, file), fs.constants.COPYFILE_EXCL);
    assert.equal(sha256(path.join(publicDir, 'client/client.js')), nativeHash);
    const files = ['bot.html', 'multibox.html', ...fs.readdirSync(path.join(publicDir, 'bot')).map(file => `bot/${file}`)];
    const deployment = { upstream: manifest.upstreams.rs2b0t.commit, target: 'local', revision: 289, rsa, nativeSha256: nativeHash, assets: Object.fromEntries(files.map(file => [file, sha256(path.join(publicDir, file))])) };
    fs.writeFileSync(path.join(runtime, 'rs2b0t-deployment.json'), JSON.stringify(deployment, null, 2) + '\n', { mode: 0o600 });
    console.log('Original rs2b0t deployed: /bot.html and /multibox.html; native /rs2.cgi preserved. Run scripts/verify-deployment.mjs.');
} finally { release(); }
