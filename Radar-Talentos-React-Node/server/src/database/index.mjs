import {ensurePersistentPath} from '../persistence.mjs';
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
  ensurePersistentPath(filename,'RADAR_DATABASE_PATH');
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
    db.exec(`CREATE TABLE IF NOT EXISTS metric_current (
      account_id TEXT NOT NULL,
      talent_id TEXT NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
      network TEXT NOT NULL CHECK(network IN ('Instagram','YouTube','Spotify','TikTok')),
      metric TEXT NOT NULL,
      value INTEGER CHECK(value IS NULL OR value >= 0),
      observed_on TEXT,
      collected_at TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','pending_source','pending_auth','error')),
      status_detail TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(account_id, metric)
    ) STRICT;`);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
