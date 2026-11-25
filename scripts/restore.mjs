import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { manifest, root, verify } from './verify-upstreams.mjs';
import { externalPath } from './runtime-lib.mjs';

verify({ quiet: true });
const destination = externalPath(process.env.HALLUMINA_RUNTIME_DIR);
const source = externalPath(process.argv[2]);
assert(!fs.existsSync(destination), 'Restore destination already exists; never overwrite a world or its saves.');
assert(destination !== source && !destination.startsWith(source + path.sep) && !source.startsWith(destination + path.sep), 'Restore must use a separate new directory.');
assert(!fs.existsSync(path.join(source, '.hallumina-operation.lock')), 'Source is active or incomplete; use a stopped snapshot from persistence.mjs backup.');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(source, 'hallumina-runtime.json'))), { revision: manifest.revision, upstreams: manifest.upstreams });
fs.cpSync(source, destination, { recursive: true, force: false, errorOnExist: true, filter: file => {
    assert(!fs.lstatSync(file).isSymbolicLink(), `Backup contains a symlink: ${file}`);
    return true;
} });
fs.chmodSync(destination, 0o700);
fs.symlinkSync(path.join(root, 'engine/node_modules'), path.join(destination, 'engine/node_modules'), 'dir');
if (fs.existsSync(path.join(destination, 'engine/db.sqlite'))) {
    const db = new DatabaseSync(path.join(destination, 'engine/db.sqlite'), { readOnly: true });
    try { assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); }
    finally { db.close(); }
}
console.log(`Restored a separate stopped runtime: ${destination}. Original world and backup preserved. Keep the original stopped when reusing its ports.`);
