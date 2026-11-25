import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runtimeInfo, lock, assertStopped, requireBuild, run } from './runtime-lib.mjs';
import { migrateNewSqlite } from './sqlite-migration.mjs';

assert.equal(process.argv[2], 'init', 'Usage: node scripts/accounts.mjs init (fresh disposable runtime only)');
assert(process.argv.length === 3 || (process.argv.length === 4 && process.argv[3] === '--offline-sql'), 'Optional argument: --offline-sql');
const { runtime, engine, config } = runtimeInfo();
const release = lock(runtime);
try {
    await assertStopped(config);
    requireBuild(engine);
    assert(!fs.existsSync(path.join(engine, 'db.sqlite')), 'Existing database is protected. Back it up and review migrations separately; init never resets/migrates an existing database.');
    assert(!fs.existsSync(path.join(engine, 'data/players')), 'Existing saves are protected; use a fresh runtime for acceptance.');
    // Use the pinned upstream SQLite schema/migration, never a parallel account DB.
    if (process.argv[3] === '--offline-sql') migrateNewSqlite(engine);
    else run('npm', ['run', 'sqlite:migrate'], engine);
    fs.chmodSync(path.join(engine, 'db.sqlite'), 0o600);
    config.easyStartup = false;
    config.website.registration = false; // native first-login provisioning
    Object.assign(config.node, { production: true, debug: false, members: true, autoSubscribeMembers: true, profile: 'main', xpRate: 1 });
    Object.assign(config.login, { enabled: true, host: '127.0.0.1' });
    config.friend.enabled = false;
    config.logger.enabled = false;
    config.db = { backend: 'sqlite', verbose: false };
    fs.writeFileSync(path.join(engine, 'data/config/world.json'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    console.log('SQLite migrated. Local authenticated gameplay enabled. First real browser login provisions a disposable account with the upstream bcrypt flow. Reuse its password thereafter.');
} finally { release(); }
