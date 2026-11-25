import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runtimeInfo, publicRsa, sha256 } from './runtime-lib.mjs';
import { verifyNativeRsa } from './native-rsa.mjs';
const { runtime, engine } = runtimeInfo();
const deployment = JSON.parse(fs.readFileSync(path.join(runtime, 'rs2b0t-deployment.json')));
assert.equal(deployment.target, 'local');
assert.equal(deployment.revision, 289);
assert.deepEqual(deployment.rsa, publicRsa(engine), 'RSA changed; bundles require rebuilding in a new runtime.');
verifyNativeRsa(fs.readFileSync(path.join(engine, 'public/client/client.js'), 'utf8'), deployment.rsa);
assert.equal(deployment.nativeSha256, sha256(path.join(engine, 'public/client/client.js')), 'Native client changed.');
for (const file of ['bot.html', 'multibox.html', 'bot/botclient.js', 'bot/multibox.js', 'bot/navworker.js', 'bot/ondemandworker.js', 'bot/collision.lcnav.gz', 'bot/worldmap-basemap.manifest.json', 'bot/tinymidipcm.wasm', 'bot/SCC1_Florestan.sf2']) assert(deployment.assets[file], `Missing asset: ${file}`);
for (const [file, hash] of Object.entries(deployment.assets)) {
    assert(!file.includes('..') && !path.isAbsolute(file));
    assert.equal(sha256(path.join(engine, 'public', file)), hash, `Asset changed: ${file}`);
}
console.log(`PASS: ${Object.keys(deployment.assets).length} published assets, original native bundle and synchronized public RSA.`);
