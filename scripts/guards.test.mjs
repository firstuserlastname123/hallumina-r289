import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { generateKeyPairSync, privateDecrypt, constants, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { externalPath, lock, assertStopped } from './runtime-lib.mjs';
import { nativeClientWithRsa, verifyNativeRsa } from './native-rsa.mjs';
import { migrateNewSqlite } from './sqlite-migration.mjs';
import { root } from './verify-upstreams.mjs';

test('native bundle encrypts to the generated private key with correct argument order', () => {
    const forge = createRequire(path.join(root, 'engine/package.json'))('node-forge');
    const old = forge.pki.publicKeyFromPem(fs.readFileSync(path.join(root, 'engine/data/config/public.pem'), 'utf8'));
    const pair = generateKeyPairSync('rsa', { modulusLength: 1024, publicExponent: 65537 });
    const key = pair.publicKey.export({ format: 'jwk' });
    const decimal = value => BigInt('0x' + Buffer.from(value, 'base64url').toString('hex')).toString();
    const rsa = { e: decimal(key.e), n: decimal(key.n) };
    const original = fs.readFileSync(path.join(root, 'engine/public/client/client.js'), 'utf8');
    const adapted = nativeClientWithRsa(original, { e: old.e.toString(10), n: old.n.toString(10) }, rsa);
    verifyNativeRsa(adapted, rsa);
    const [, modulus, exponent] = adapted.match(/\.Ka\(BigInt\("(\d+)"\),BigInt\("(\d+)"\)\)/);
    const input = Buffer.from('native RSA round trip');
    let value = BigInt('0x' + input.toString('hex'));
    let power = BigInt(exponent), encrypted = 1n;
    while (power > 0n) {
        if (power & 1n) encrypted = encrypted * value % BigInt(modulus);
        value = value * value % BigInt(modulus);
        power >>= 1n;
    }
    const cipher = Buffer.from(encrypted.toString(16).padStart(256, '0'), 'hex');
    assert.deepEqual(privateDecrypt({ key: pair.privateKey, padding: constants.RSA_NO_PADDING }, cipher).subarray(-input.length), input);
    assert.throws(() => nativeClientWithRsa('changed bundle', { e: old.e.toString(), n: old.n.toString() }, rsa));
    assert.throws(() => verifyNativeRsa(adapted.replace(`BigInt("${rsa.n}"),BigInt("${rsa.e}")`, `BigInt("${rsa.e}"),BigInt("${rsa.n}")`), rsa));
});

test('external paths, symlink aliases, concurrent operations and occupied ports fail closed', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hallumina-guards-'));
    try {
        assert.throws(() => externalPath(root));
        fs.symlinkSync(root, path.join(temp, 'source'));
        assert.throws(() => externalPath(path.join(temp, 'source/new-runtime')));
        const release = lock(temp);
        assert.throws(() => lock(temp));
        release();
        const server = net.createServer();
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            const port = server.address().port;
            await assert.rejects(assertStopped({ web: { port, managementPort: 8898 }, node: { port: 43594 } }), /occupied/);
        } finally { await new Promise(resolve => server.close(resolve)); }
    } finally { fs.rmSync(temp, { recursive: true }); }
});

test('loopback preload confines numeric, options and worker listeners', () => {
    const code = `import net from 'node:net'; import assert from 'node:assert/strict'; import { Worker } from 'node:worker_threads';
    for (const args of [[0, '0.0.0.0'], [{port:0,host:'::'}], [0]]) {
      const s=net.createServer(); await new Promise(r=>s.listen(...args,r)); assert.equal(s.address().address,'127.0.0.1'); await new Promise(r=>s.close(r));
    }
    const worker = new Worker(new URL('data:text/javascript,'+encodeURIComponent(\`import net from 'node:net';import {parentPort} from 'node:worker_threads';const s=net.createServer();s.listen(0,'0.0.0.0',()=>{parentPort.postMessage(s.address().address);s.close();});\`)));
    assert.equal(await new Promise((resolve,reject)=>{worker.on('message',resolve);worker.on('error',reject)}),'127.0.0.1');`;
    execFileSync(process.execPath, ['--import', path.join(root, 'hallumina/loopback.mjs'), '--input-type=module', '-e', code]);
});

test('offline migration uses pinned SQL/checksum and refuses existing account data', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hallumina-sqlite-'));
    try {
        fs.cpSync(path.join(root, 'engine/prisma'), path.join(temp, 'prisma'), { recursive: true });
        migrateNewSqlite(temp);
        const db = new DatabaseSync(path.join(temp, 'db.sqlite'));
        const migration = db.prepare('SELECT migration_name,checksum FROM _prisma_migrations').get();
        const sql = fs.readFileSync(path.join(temp, 'prisma/singleworld/migrations', migration.migration_name, 'migration.sql'));
        assert.equal(migration.checksum, createHash('sha256').update(sql).digest('hex'));
        db.prepare('INSERT INTO account (username,password) VALUES (?,?)').run('disposable', 'test-hash');
        assert.throws(() => migrateNewSqlite(temp), /EEXIST/);
        assert.equal(db.prepare('SELECT COUNT(*) AS n FROM account').get().n, 1);
        assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
        db.close();
    } finally { fs.rmSync(temp, { recursive: true }); }
});
