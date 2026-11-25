import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root } from './verify-upstreams.mjs';
import { nativeClientWithRsa } from './native-rsa.mjs';
import { runtimeInfo, lock, assertStopped, publicRsa, sha256 } from './runtime-lib.mjs';
import assert from 'node:assert/strict';

const { runtime, engine, config } = runtimeInfo();
const release = lock(runtime);
try {
    await assertStopped(config);
    const forge = createRequire(path.join(root, 'engine/package.json'))('node-forge');
    const old = forge.pki.publicKeyFromPem(fs.readFileSync(path.join(root, 'engine/data/config/public.pem'), 'utf8'));
    const client = path.join(engine, 'public/client/client.js');
    const manifestPath = path.join(runtime, 'rs2b0t-deployment.json');
    const deployment = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : null;
    if (deployment) assert.equal(deployment.nativeSha256, sha256(client), 'Native client has changed since deployment; inspect it first.');
    const replacement = nativeClientWithRsa(fs.readFileSync(path.join(root, 'engine/public/client/client.js'), 'utf8'), { e: old.e.toString(10), n: old.n.toString(10) }, publicRsa(engine));
    // Exclusive backup and atomic asset replacement. Never touch keys/DB/saves.
    fs.copyFileSync(client, path.join(runtime, 'native-client-before-rsa-fix.js'), fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(client + '.new', replacement, { mode: 0o600 });
    fs.renameSync(client + '.new', client);
    if (deployment) {
        deployment.nativeSha256 = sha256(client);
        fs.writeFileSync(manifestPath, JSON.stringify(deployment, null, 2) + '\n');
    }
    console.log('Native RSA call repaired from pinned bundle; previous asset backed up, keys and character data preserved.');
} finally { release(); }
