import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// Offline equivalent of migrate deploy for a NEW database only. SQL comes from
// the pinned runtime; Prisma-compatible bookkeeping permits later CLI upgrades.
export function migrateNewSqlite(engine) {
    const file = path.join(engine, 'db.sqlite');
    const fd = fs.openSync(file, 'wx', 0o600);
    fs.closeSync(fd);
    const db = new DatabaseSync(file);
    try {
        const directory = path.join(engine, 'prisma/singleworld/migrations');
        const migrations = fs.readdirSync(directory).filter(name => /^\d+_/.test(name)).sort();
        assert(migrations.length > 0, 'Pinned SQLite migration not found.');
        db.exec('BEGIN IMMEDIATE');
        db.exec(`CREATE TABLE _prisma_migrations (
            id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL,
            finished_at DATETIME, migration_name TEXT NOT NULL, logs TEXT,
            rolled_back_at DATETIME, started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            applied_steps_count INTEGER NOT NULL DEFAULT 0
        )`);
        for (const name of migrations) {
            const sql = fs.readFileSync(path.join(directory, name, 'migration.sql'), 'utf8');
            db.exec(sql);
            db.prepare('INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)').run(randomUUID(), createHash('sha256').update(sql).digest('hex'), name);
        }
        db.exec('COMMIT');
        console.log('Applied pinned upstream SQLite migration SQL (offline mode); migration checksums recorded.');
    } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error; // leave failed database for inspection; never silently reset
    } finally { db.close(); }
}
