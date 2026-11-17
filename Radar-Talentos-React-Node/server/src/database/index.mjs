import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const migrationsDirectory = new URL('../../../database/migrations/', import.meta.url);

export function databasePath() {
  const configured = process.env.RADAR_DATABASE_PATH || 'data/radar.sqlite';
  return configured === ':memory:' ? configured : resolve(projectRoot, configured);
}

export function openDatabase(filename = databasePath()) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ) STRICT;`);
    for (const name of readdirSync(migrationsDirectory).filter(name => /^\d+_.*\.sql$/.test(name)).sort()) {
      const sql = readFileSync(new URL(name, migrationsDirectory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        const applied = db.prepare('SELECT checksum FROM schema_migrations WHERE name = ?').get(name);
        if (applied && applied.checksum !== checksum) throw new Error('Migração já aplicada foi alterada: ' + name);
        if (!applied) {
          db.exec(sql);
          db.prepare('INSERT INTO schema_migrations(name, checksum) VALUES (?, ?)').run(name, checksum);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
