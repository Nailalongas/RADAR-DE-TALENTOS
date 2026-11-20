import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/src/database/index.mjs';
import { REAL_BRAZILIAN_TALENTS_100 } from '../server/src/catalog-100.mjs';
import { discoverTalentsFromSources, discoveryStatus, enforceYouTubeRetentionPolicy } from '../server/src/discovery.mjs';
import { importEvents, reviewArtists } from '../server/src/events.mjs';
import { importRegistry } from '../server/src/registry.mjs';
import { createRadarServer } from '../server/src/app.mjs';

test('Catálogo Fase 1: 100 artistas reais brasileiros distribuídos nas 8 categorias rumo à meta de 10.000', () => {
  assert.equal(REAL_BRAZILIAN_TALENTS_100.length, 100);
  const ids = new Set(REAL_BRAZILIAN_TALENTS_100.map(t => t.id));
  assert.equal(ids.size, 100);

  const byCat = new Map();
  for (const t of REAL_BRAZILIAN_TALENTS_100) {
    byCat.set(t.catName, (byCat.get(t.catName) || 0) + 1);
  }
  assert.equal(byCat.get('Cantores'), 30);
  assert.equal(byCat.get('Influenciadores'), 20);
  assert.equal(byCat.get('Humoristas'), 10);
  assert.equal(byCat.get('Palestrantes'), 10);
  assert.equal(byCat.get('Artistas'), 10);
  assert.equal(byCat.get('Peças de teatro e musicais'), 8);
  assert.equal(byCat.get('Infantil e família'), 7);
  assert.equal(byCat.get('Gastronomia'), 5);
});

test('Motor de Descoberta Automática, tabela metric_current e política de retenção de 30 dias do YouTube', async () => {
  const db = openDatabase(':memory:');
  try {
    db.exec("INSERT INTO municipalities(code,name,uf,region,source,version) VALUES('4204608','Criciúma','SC','Sul','Base Nacional','2026')");

    // Importa um evento com atração explícita para testar descoberta automática
    importEvents(db, {
      platform: 'sympla',
      observed_on: '2026-11-18',
      source: 'Sympla API',
      items: [
        {
          external_id: 'ev-1',
          title: 'Show Especial Novo Talento',
          venue: 'Teatro Municipal',
          municipality_code: '4204608',
          event_date: '2026-12-10',
          url: 'https://www.sympla.com.br/ev-1',
          modality_id: 'shows',
          artists: [{ name: 'Banda Nova Era Sul' }]
        }
      ]
    });

    const disc = discoverTalentsFromSources(db, {
      candidates: [
        {
          id: 't-candidato-sp',
          name: 'Talento Descoberto Beta',
          categories: ['Cantores'],
          modalities: ['shows'],
          accounts: [
            { network: 'Instagram', url: 'https://www.instagram.com/talentobeta', value: 42580, observed_on: '2026-11-18', status: 'available' },
            { network: 'Spotify', url: 'https://open.spotify.com/artist/talentobeta', value: null, status: 'pending_source', status_detail: 'Fonte pendente · Dados indisponíveis' },
            { network: 'TikTok', url: 'https://www.tiktok.com/@talentobeta', value: null, status: 'pending_auth', status_detail: 'Autorização pendente · Dados indisponíveis' }
          ]
        }
      ]
    });

    assert.equal(disc.discoveredFromEvents, 1);
    assert.equal(disc.discoveredFromCandidates, 1);
    assert.equal(disc.totalTalents, 2);

    // Verifica metric_current (1 disponível, 2 pendentes)
    const status = discoveryStatus(db);
    assert.equal(status.totalTalents, 2);
    assert.equal(status.targetTotal, 10000);
    assert.equal(status.databaseStructures.metric_current.available, 1);
    assert.equal(status.databaseStructures.metric_current.pending, 2);

    // Verifica retenção de 30 dias da YouTube Data API pública
    importRegistry(db, {
      talents: [{ id: 't-yt-test', name: 'Canal Teste Retenção', categories: ['Influenciadores'] }],
      accounts: [{ id: 'yt-ret', talent_id: 't-yt-test', network: 'YouTube', external_id: 'UC12345', url: 'https://www.youtube.com/@canalret', identity_confirmed: 1, identity_source: 'oficial' }],
      snapshots: [
        { account_id: 'yt-ret', network: 'YouTube', metric: 'subscribers', observed_on: '2026-09-01', value: 18000, source: 'YouTube Data API v3 / public' },
        { account_id: 'yt-ret', network: 'YouTube', metric: 'subscribers', observed_on: '2026-11-10', value: 18200, source: 'YouTube Data API v3 / public' }
      ]
    });
    const retention = enforceYouTubeRetentionPolicy(db, { referenceDay: '2026-11-18', retentionDays: 30, extendedAccessApproved: false });
    assert.equal(retention.purged, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM metric_snapshots WHERE account_id = 'yt-ret'").get().n, 1);
    // Entretanto, metric_current preserva o último valor válido disponível (18.200)
    assert.equal(db.prepare("SELECT value FROM metric_current WHERE account_id = 'yt-ret'").get().value, 18200);

    const server = createRadarServer({ database: db, eventsOnly: true, combinedDashboard: true });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    try {
      const base = 'http://127.0.0.1:' + server.address().port;
      const res = await fetch(base + '/api/discovery/status');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.targetTotal, 10000);
      assert.equal(body.categories.length, 8);
    } finally {
      await new Promise(r => server.close(r));
    }
  } finally {
    db.close();
  }
});
