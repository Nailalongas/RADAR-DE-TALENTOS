import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/src/database/index.mjs';
import { createRadarServer } from '../server/src/app.mjs';

function account(db) {
  db.prepare('INSERT INTO talents(id, name) VALUES (?, ?)').run('talent-test', 'Talento de teste');
  db.prepare('INSERT INTO social_accounts(id, talent_id, network, url) VALUES (?, ?, ?, ?)')
    .run('account-test', 'talent-test', 'Instagram', 'https://www.instagram.com/test/');
}

function snapshot(db, { network = 'Instagram', metric = 'followers', date = '2026-11-17', value = 100 } = {}) {
  return db.prepare('INSERT INTO metric_snapshots(account_id, network, metric, observed_on, value, source) VALUES (?, ?, ?, ?, ?, ?)')
    .run('account-test', network, metric, date, value, 'teste local');
}

test('migrações são repetíveis e preservam dados no arquivo', () => {
  const directory = mkdtempSync(join(tmpdir(), 'radar-db-test-'));
  const filename = join(directory, 'radar.sqlite');
  let db;
  try {
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT count(*) AS n FROM categories').get().n, 8);
    assert.equal(db.prepare('SELECT count(*) AS n FROM talents').get().n, 0);
    account(db);
    snapshot(db);
    db.close();
    db = openDatabase(filename);
    assert.equal(db.prepare('SELECT count(*) AS n FROM schema_migrations').get().n, 2);
    assert.equal(db.prepare('SELECT count(*) AS n FROM categories').get().n, 8);
    assert.equal(db.prepare('SELECT value FROM metric_snapshots').get().value, 100);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    db?.close();
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
});

test('histórico rejeita duplicatas, valores inválidos e métricas de outra rede', () => {
  const db = openDatabase(':memory:');
  try {
    account(db);
    snapshot(db);
    assert.throws(() => snapshot(db), /UNIQUE/);
    assert.throws(() => snapshot(db, { date: '2026-11-18', value: -1 }), /CHECK/);
    assert.throws(() => snapshot(db, { date: '2026-11-18', value: null }), /NOT NULL/);
    assert.throws(() => snapshot(db, { date: '2026-11-18', metric: 'monthly_listeners' }), /FOREIGN KEY/);
    assert.throws(() => snapshot(db, { date: '2026-11-18', network: 'YouTube', metric: 'subscribers' }), /FOREIGN KEY/);
    assert.throws(() => snapshot(db, { date: '2026-02-30' }), /CHECK/);
    assert.throws(() => snapshot(db, { date: '2026-13-01' }), /CHECK/);
    snapshot(db, { date: '2026-11-19', value: 0 });
    assert.equal(db.prepare('SELECT count(*) AS n FROM metric_snapshots').get().n, 2);
  } finally { db.close(); }
});

test('temas exigem a categoria do talento e contas exigem identidade com fonte', () => {
  const db = openDatabase(':memory:');
  try {
    account(db);
    const topic = db.prepare('SELECT id, category_id FROM topics LIMIT 1').get();
    assert.throws(() => db.prepare('INSERT INTO talent_topics VALUES (?, ?, ?)').run('talent-test', topic.id, topic.category_id), /FOREIGN KEY/);
    db.prepare('INSERT INTO talent_categories VALUES (?, ?)').run('talent-test', topic.category_id);
    db.prepare('INSERT INTO talent_topics VALUES (?, ?, ?)').run('talent-test', topic.id, topic.category_id);
    assert.throws(() => db.exec("UPDATE social_accounts SET identity_confirmed = 1"), /CHECK/);
    db.exec("UPDATE social_accounts SET identity_confirmed = 1, identity_source = 'https://example.org/official'");
  } finally { db.close(); }
});

test('status verifica a conexão com o banco e sinaliza indisponibilidade', async () => {
  const db = openDatabase(':memory:');
  const server = createRadarServer({ database: db });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/api/health';
    assert.equal((await fetch(url)).status, 200);
    db.close();
    assert.equal((await fetch(url)).status, 503);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
