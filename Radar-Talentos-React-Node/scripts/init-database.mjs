import { openDatabase, databasePath } from '../server/src/database/index.mjs';
import { seedPilotDatabaseIfEmpty } from '../server/src/seed-pilot.mjs';

const db = openDatabase();
try {
  const result = db.prepare('PRAGMA integrity_check').get();
  if (result.integrity_check !== 'ok') throw new Error('Falha na integridade do banco');
  seedPilotDatabaseIfEmpty(db);
  console.log('Banco inicializado: ' + databasePath());
  console.log('Migrações:', db.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY name').all());
  console.log('Categorias:', db.prepare('SELECT count(*) AS total FROM categories').get().total);
  console.log('Modalidades:', db.prepare('SELECT count(*) AS total FROM modalities').get().total);
  console.log('Municípios com coordenadas:', db.prepare('SELECT count(*) AS total FROM municipalities WHERE lat IS NOT NULL').get().total);
  console.log('Eventos únicos (Fase 3):', db.prepare('SELECT count(*) AS total FROM events').get().total);
  console.log('Declarações de cobertura (Fase 5):', db.prepare('SELECT count(*) AS total FROM event_coverage').get().total);
  console.log('Jobs operacionais cadastrados (Fase 6):', db.prepare('SELECT count(*) AS total FROM operation_jobs').get().total);
} finally {
  db.close();
}
