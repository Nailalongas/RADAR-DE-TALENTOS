import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { importPair } from './persistent-import.mjs';
import { seedPilotDatabaseIfEmpty } from '../server/src/seed-pilot.mjs';
import { importEvents } from '../server/src/events.mjs';
import { REAL_BRAZILIAN_TALENTS_100 } from '../server/src/catalog-100.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const dataDir = resolve(process.env.RADAR_DATA_DIR || join(projectRoot, 'data'));
mkdirSync(join(dataDir, 'inbox'), { recursive: true });
mkdirSync(join(dataDir, 'secrets'), { recursive: true });
if (process.env.RADAR_BACKUP_DIR) {
  mkdirSync(resolve(process.env.RADAR_BACKUP_DIR), { recursive: true });
}

const marker = join(dataDir, '.radar-persistent-v1');
const radarDbFile = join(dataDir, 'radar.sqlite');
const discDbFile = join(dataDir, 'discovery.sqlite');

if (process.env.RADAR_PERSISTENT_REQUIRED === '1' && !existsSync(marker) && !existsSync(radarDbFile) && !existsSync(discDbFile)) {
  const prevReq = process.env.RADAR_PERSISTENT_REQUIRED;
  process.env.RADAR_PERSISTENT_REQUIRED = '0';
  const stageDir = mkdtempSync(join(tmpdir(), 'radar-bootstrap-'));
  try {
    const { openDatabase } = await import('../server/src/database/index.mjs');
    const { openDiscovery } = await import('../server/src/discovery/engine.mjs');

    const radar = openDatabase(join(stageDir, 'radar.sqlite'));
    try {
      seedPilotDatabaseIfEmpty(radar);

      // Cadastra apenas os 100 talentos reais e suas categorias/modalidades, sem nenhuma métrica sintética
      const catRows = radar.prepare('SELECT id, name FROM categories').all();
      const catByName = new Map(catRows.map(c => [c.name, c.id]));
      const insTalent = radar.prepare('INSERT OR IGNORE INTO talents(id, name, entity_type) VALUES (?, ?, ?)');
      const insCat = radar.prepare('INSERT OR IGNORE INTO talent_categories(talent_id, category_id) VALUES (?, ?)');
      const insMod = radar.prepare('INSERT OR IGNORE INTO talent_modalities(talent_id, modality_id) VALUES (?, ?)');

      radar.exec('BEGIN IMMEDIATE');
      try {
        for (const t of REAL_BRAZILIAN_TALENTS_100) {
          insTalent.run(t.id, t.name, t.type || 'person');
          const cid = catByName.get(t.catName);
          if (cid != null) insCat.run(t.id, cid);
          if (t.mod) insMod.run(t.id, t.mod);
        }
        radar.exec('COMMIT');
      } catch (err) {
        radar.exec('ROLLBACK');
        throw err;
      }

      for (const sampleName of ['sympla.json', 'eventim.json', 'ticket360.json', 'ticketsports.json']) {
        const samplePath = join(projectRoot, 'samples', 'observed', sampleName);
        if (existsSync(samplePath)) {
          const batch = JSON.parse(readFileSync(samplePath, 'utf8'));
          importEvents(radar, batch);
        }
      }
    } finally {
      radar.close();
    }

    const disc = openDiscovery(join(stageDir, 'discovery.sqlite'));
    disc.close();

    importPair(stageDir, dataDir);
    console.log('Volume persistente inicializado com base saneada (100 talentos, 5.571 municípios, 19 eventos, 0 métricas sintéticas).');
  } finally {
    process.env.RADAR_PERSISTENT_REQUIRED = prevReq;
    rmSync(stageDir, { recursive: true, force: true });
  }
}

await import('../server/src/index.mjs');
