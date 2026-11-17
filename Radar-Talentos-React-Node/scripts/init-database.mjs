import { openDatabase, databasePath } from '../server/src/database/index.mjs';

const db = openDatabase();
try {
  const result = db.prepare('PRAGMA integrity_check').get();
  if (result.integrity_check !== 'ok') throw new Error('Falha na integridade do banco');
  console.log('Banco inicializado: ' + databasePath());
  console.log('Migrações:', db.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY name').all());
  console.log('Categorias:', db.prepare('SELECT count(*) AS total FROM categories').get().total);
} finally {
  db.close();
}
