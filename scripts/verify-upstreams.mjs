import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const manifest = JSON.parse(readFileSync(new URL('../hallumina/compatibility.json', import.meta.url)));
export function git(cwd, ...args) {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
}

export function verify({ quiet = false } = {}) {
    assert.equal(manifest.revision, 289);
    for (const [name, pin] of Object.entries(manifest.upstreams)) {
        const dir = `${root}${name}`;
        assert.equal(git(root, 'config', '-f', '.gitmodules', `submodule.${name}.path`), name);
        assert.equal(git(root, 'config', '-f', '.gitmodules', `submodule.${name}.url`), pin.url);
        assert.equal(git(root, 'config', '-f', '.gitmodules', `submodule.${name}.branch`), pin.branch);
        assert.equal(git(dir, 'remote', 'get-url', 'origin'), pin.url);
        assert.equal(git(dir, 'rev-parse', 'HEAD'), pin.commit, `${name}: unexpected checkout`);
        assert.equal(git(root, 'ls-files', '--stage', '--', name), `160000 ${pin.commit} 0\t${name}`, `${name}: unexpected gitlink`);
        git(dir, 'merge-base', '--is-ancestor', pin.commit, `refs/remotes/origin/${pin.branch}`);
        assert.equal(git(dir, 'status', '--porcelain', '--untracked-files=normal'), '', `${name}: source changes`);
        if (!quiet) console.log(`${name}: ${pin.branch} ${pin.commit} (${pin.url})`);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) verify();
