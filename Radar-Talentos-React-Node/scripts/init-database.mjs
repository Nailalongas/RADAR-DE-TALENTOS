import { openDatabase, databasePath } from '../server/src/database/index.mjs';
import { seedBundledMunicipalities } from '../server/src/radar.mjs';

const db = openDatabase();
try {
  const result = db.prepare('PRAGMA integrity_check').get();
  if (result.integrity_check !== 'ok') throw new Error('Falha na integridade do banco');
  const existingCities = db.prepare('SELECT count(*) AS total FROM municipalities').get().total;
  if (existingCities === 0) {
    seedBundledMunicipalities(db, '2026-11-17');
  }
  console.log('Banco inicializado: ' + databasePath());
  console.log('Migrações:', db.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY name').all());
  console.log('Categorias:', db.prepare('SELECT count(*) AS total FROM categories').get().total);
  console.log('Modalidades:', db.prepare('SELECT count(*) AS total FROM modalities').get().total);
  console.log('Municípios IBGE com coordenadas:', db.prepare('SELECT count(*) AS total FROM municipalities WHERE lat IS NOT NULL').get().total);
} finally {
  db.close();
}
