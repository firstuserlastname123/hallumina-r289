import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root } from './verify-upstreams.mjs';
import { runtimeInfo, lock, assertStopped, externalPath, run } from './runtime-lib.mjs';
const { runtime, engine, config } = runtimeInfo();
const release = lock(runtime);
try {
    await assertStopped(config);
    if (process.argv[2] === 'inspect') {
        run(process.execPath, ['--import', 'tsx', path.join(root, 'hallumina/inspect-save.mjs'), process.argv[3] ?? ''], engine);
    } else {
        assert.equal(process.argv[2], 'backup', 'Usage: persistence.mjs inspect USERNAME | backup /absolute/new/backup');
        const destination = externalPath(process.argv[3]);
        assert(!destination.startsWith(runtime + path.sep) && !runtime.startsWith(destination + path.sep) && destination !== runtime, 'Backup must be separate from the runtime.');
        assert(!fs.existsSync(destination), 'Refusing to overwrite an existing backup.');
        // A complete stopped snapshot keeps cache/client keys/config and saves in
        // sync. Dependency symlinks and disposable build staging are omitted.
        fs.cpSync(runtime, destination, { recursive: true, force: false, errorOnExist: true, filter: file => {
            const relative = path.relative(runtime, file);
            if (relative === '.hallumina-operation.lock' || /^(engine\/node_modules|rs2b0t-build-[^/]+)(\/|$)/.test(relative)) return false;
            assert(!fs.lstatSync(file).isSymbolicLink(), `Refusing backup symlink: ${relative}`);
            return true;
        } });
        fs.chmodSync(destination, 0o700);
        console.log(`Stopped runtime snapshot: ${destination}. Contains secrets and saves; keep private. Restore only to a new external directory, then reattach engine/node_modules.`);
    }
} finally { release(); }
