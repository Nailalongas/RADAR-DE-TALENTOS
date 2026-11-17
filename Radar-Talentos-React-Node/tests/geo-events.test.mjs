import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/src/database/index.mjs';
import { createRadarServer } from '../server/src/app.mjs';
import {
  classifyEventModality,
  computeRadarScore,
  haversineDistanceKm,
} from '../src/domain/geo-intelligence.js';

test('cálculo geodésico Haversine valida coordenadas, raio zero, fronteiras e interseção com UF', async () => {
  // Raio zero na mesma coordenada = 0 km
  assert.equal(haversineDistanceKm(-25.4284, -49.2733, -25.4284, -49.2733), 0);
  assert.throws(() => haversineDistanceKm(95, 0, 0, 0), /Coordenadas/);

  const db = openDatabase(':memory:');
  const server = createRadarServer({ database: db, adminToken: 'secret-test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    // Homônimos desambiguados por UF e código municipal
    const homonymsRes = await fetch(
      `${base}/api/geo/municipalities?search=Bom%20Jesus`
    );
    assert.equal(homonymsRes.status, 200);
    const homonyms = await homonymsRes.json();
    assert.equal(homonyms.municipalities.length, 3);
    assert.deepEqual(
      homonyms.municipalities.map(m => `${m.name} (${m.uf})`),
      ['Bom Jesus (PI)', 'Bom Jesus (RS)', 'Bom Jesus (RN)']
    );

    // Raio 0 km de Curitiba retorna apenas Curitiba
    const r0 = await (
      await fetch(
        `${base}/api/geo/radius?municipalityId=4106902&radiusKm=0`
      )
    ).json();
    assert.equal(r0.municipalities.length, 1);
    assert.equal(r0.municipalities[0].municipality_code, '4106902');
    assert.equal(r0.municipalities[0].distanceKm, 0);

    // Raio 150 km de Curitiba inclui Joinville (SC), Ponta Grossa (PR), Paranaguá (PR), São José dos Pinhais (PR)
    // e exclui Florianópolis (SC ~251 km) e São Paulo (SP ~339 km)
    const r150 = await (
      await fetch(
        `${base}/api/geo/radius?municipalityId=4106902&radiusKm=150`
      )
    ).json();
    const names150 = r150.municipalities.map(m => m.name);
    assert.ok(names150.includes('Curitiba'));
    assert.ok(names150.includes('Joinville'));
    assert.ok(names150.includes('Ponta Grossa'));
    assert.ok(names150.includes('Paranaguá'));
    assert.ok(names150.includes('São José dos Pinhais'));
    assert.ok(!names150.includes('Florianópolis'));
    assert.ok(!names150.includes('São Paulo'));

    // Interseção de UF=PR + raio 150 km de Curitiba exclui Joinville (SC)
    const r150Pr = await (
      await fetch(
        `${base}/api/geo/radius?municipalityId=4106902&radiusKm=150&uf=PR`
      )
    ).json();
    assert.ok(r150Pr.municipalities.every(m => m.uf === 'PR'));
    assert.ok(!r150Pr.municipalities.some(m => m.name === 'Joinville'));

    // Raio inválido retorna HTTP 400
    const badRadius = await fetch(
      `${base}/api/geo/radius?municipalityId=4106902&radiusKm=-10`
    );
    assert.equal(badRadius.status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

test('importação de audiência regional, idempotência, separação de métricas e autenticação', async () => {
  const db = openDatabase(':memory:');
  const server = createRadarServer({ database: db, adminToken: 'secret-test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    // Rejeita requisição sem token administrativo
    const unauth = await fetch(`${base}/api/admin/audience/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [] }),
    });
    assert.equal(unauth.status, 401);

    const payload = {
      rows: [
        {
          talentId: 't-natiruts',
          talentName: 'Natiruts',
          platform: 'YouTube',
          metric: 'visualizacoes',
          unit: 'visualizacoes',
          granularity: 'municipality',
          municipalityCode: '4106902',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          value: 85000,
          provenance: 'verificado',
          source: 'YouTube Analytics',
        },
        {
          talentId: 't-natiruts',
          talentName: 'Natiruts',
          platform: 'YouTube',
          metric: 'visualizacoes',
          unit: 'visualizacoes',
          granularity: 'municipality',
          municipalityCode: '4209102',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          value: 32000,
          provenance: 'verificado',
          source: 'YouTube Analytics',
        },
        {
          talentId: 't-natiruts',
          talentName: 'Natiruts',
          platform: 'Instagram',
          metric: 'seguidores',
          unit: 'seguidores',
          granularity: 'municipality',
          municipalityCode: '4106902',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          value: 62000,
          provenance: 'verificado',
          source: 'Instagram Insights',
        },
        // Valor zero real deve permanecer 0
        {
          talentId: 't-natiruts',
          talentName: 'Natiruts',
          platform: 'YouTube',
          metric: 'visualizacoes',
          unit: 'visualizacoes',
          granularity: 'municipality',
          municipalityCode: '4118204',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
          value: 0,
          provenance: 'verificado',
          source: 'YouTube Analytics',
        },
      ],
    };

    const firstImport = await (
      await fetch(`${base}/api/admin/audience/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-test',
        },
        body: JSON.stringify(payload),
      })
    ).json();
    assert.equal(firstImport.imported, 4);
    assert.equal(firstImport.updated, 0);

    // Importar duas vezes o mesmo relatório não duplica registros
    const secondImport = await (
      await fetch(`${base}/api/admin/audience/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-test',
        },
        body: JSON.stringify(payload),
      })
    ).json();
    assert.equal(secondImport.imported, 0);
    assert.equal(secondImport.updated, 4);

    // Consulta de mapa para YouTube visualizacoes não soma com Instagram seguidores
    const ytMap = await (
      await fetch(
        `${base}/api/audience/map?talentId=t-natiruts&platform=YouTube&metric=visualizacoes&centerMunicipalityId=4106902&radiusKm=150`
      )
    ).json();
    assert.equal(ytMap.items.length, 3);
    assert.equal(
      ytMap.items.find(i => i.municipalityCode === '4106902').value,
      85000
    );
    assert.equal(
      ytMap.items.find(i => i.municipalityCode === '4118204').value,
      0,
      'Zero real permanece zero'
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

test('deduplicação de eventos entre plataformas, modalidades, inventário inicial e matriz de oportunidades', async () => {
  const db = openDatabase(':memory:');
  const server = createRadarServer({ database: db, adminToken: 'secret-test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    // Importa audiência para Curitiba (alta) e Joinville (baixa); Ponta Grossa fica sem audiência
    await fetch(`${base}/api/admin/audience/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-test',
      },
      body: JSON.stringify({
        rows: [
          {
            talentName: 'Natiruts',
            platform: 'YouTube',
            metric: 'visualizacoes',
            municipalityCode: '4106902',
            periodStart: '2026-10-01',
            periodEnd: '2026-10-31',
            value: 100000,
            source: 'YouTube Analytics',
          },
          {
            talentName: 'Natiruts',
            platform: 'YouTube',
            metric: 'visualizacoes',
            municipalityCode: '4209102',
            periodStart: '2026-10-01',
            periodEnd: '2026-10-31',
            value: 10000,
            source: 'YouTube Analytics',
          },
        ],
      }),
    });

    // Importa eventos:
    // 1 e 2: Mesmo show do Natiruts em Curitiba na Pedreira em 2026-11-28 anunciado no Disk Ingressos e na Eventim (deve contar como 1 evento único com 2 origens)
    // 3: Mesmo nome em outra cidade (São Paulo, 2026-12-12) -> evento distinto!
    // 4: Corrida em Joinville (inventário inicial = true -> não conta como novo evento detectado)
    // 5: Palestra online (não deve entrar no filtro por raio em km!)
    const eventsPayload = {
      rows: [
        {
          sourceId: 'diskingressos',
          externalId: 'dsk-1',
          url: 'https://www.diskingressos.com.br/e/1',
          title: 'Show Natiruts Leve com Você',
          originalCategory: 'Show',
          attractionName: 'Natiruts',
          venueName: 'Pedreira Paulo Leminski',
          municipalityCode: '4106902',
          eventDateStart: '2026-11-28',
          publishedAt: '2026-10-05',
          detectedAt: '2026-11-01',
        },
        {
          sourceId: 'eventim',
          externalId: 'evt-1',
          url: 'https://www.eventim.com.br/e/1',
          title: 'Turnê Natiruts Leve com Você',
          originalCategory: 'Shows e Música',
          attractionName: 'Natiruts',
          venueName: 'Pedreira Paulo Leminski',
          municipalityCode: '4106902',
          eventDateStart: '2026-11-28',
          publishedAt: '2026-10-06',
          detectedAt: '2026-11-02',
        },
        {
          sourceId: 'ticketmaster',
          externalId: 'tkm-1',
          url: 'https://www.ticketmaster.com.br/e/1',
          title: 'Show Natiruts Leve com Você',
          originalCategory: 'Shows',
          attractionName: 'Natiruts',
          venueName: 'Allianz Parque',
          municipalityCode: '3550308',
          eventDateStart: '2026-12-12',
          publishedAt: '2026-09-10',
          detectedAt: '2026-11-01',
        },
        {
          sourceId: 'ticketsports',
          externalId: 'tsp-1',
          url: 'https://www.ticketsports.com.br/e/1',
          title: 'Meia Maratona de Joinville 21km',
          originalCategory: 'Corrida',
          attractionName: 'Meia Maratona',
          venueName: 'Centro de Joinville',
          municipalityCode: '4209102',
          eventDateStart: '2026-11-20',
          publishedAt: '2026-08-01',
          detectedAt: '2026-10-01',
          isInitialInventory: true,
        },
        {
          sourceId: 'sympla',
          externalId: 'sym-online-1',
          url: 'https://www.sympla.com.br/e/online1',
          title: 'Masterclass Online de Liderança e IA',
          originalCategory: 'Palestra',
          deliveryMode: 'online',
          eventDateStart: '2026-11-25',
          publishedAt: '2026-11-01',
          detectedAt: '2026-11-02',
        },
      ],
    };

    const importRes = await (
      await fetch(`${base}/api/admin/events/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-test',
        },
        body: JSON.stringify(eventsPayload),
      })
    ).json();
    assert.equal(importRes.createdEvents, 4);
    assert.equal(
      importRes.mergedDuplicates,
      1,
      'Evento anunciado em duas plataformas funde em 1 evento canônico'
    );

    // Consulta nacional inclui o evento online (total 4 eventos únicos, 5 anúncios, 3 novos detectados pois 1 é inventário inicial)
    const nationalTrends = await (
      await fetch(`${base}/api/events/trends`)
    ).json();
    assert.equal(nationalTrends.summary.uniqueEvents, 4);
    assert.equal(nationalTrends.summary.totalListings, 5);
    assert.equal(nationalTrends.summary.newlyDetected, 3);

    // Consulta com raio de 150 km de Curitiba exclui São Paulo e exclui o evento online sem local físico
    const curitibaRadiusTrends = await (
      await fetch(
        `${base}/api/events/trends?centerMunicipalityId=4106902&radiusKm=150`
      )
    ).json();
    assert.equal(curitibaRadiusTrends.summary.uniqueEvents, 2);
    const cwbShow = curitibaRadiusTrends.events.find(
      e => e.municipality_code === '4106902'
    );
    assert.equal(cwbShow.listings.length, 2);

    // Filtro por data de publicação vs data de realização produz resultados distintos
    const octPublished = await (
      await fetch(
        `${base}/api/events/trends?dateBasis=publication&dateFrom=2026-10-01&dateTo=2026-10-31`
      )
    ).json();
    assert.equal(octPublished.summary.uniqueEvents, 1);

    const novRealization = await (
      await fetch(
        `${base}/api/events/trends?dateBasis=realization&dateFrom=2026-11-01&dateTo=2026-11-30`
      )
    ).json();
    assert.equal(novRealization.summary.uniqueEvents, 3);

    // Matriz de oportunidades não classifica municípios sem cobertura como baixa audiência
    const opp = await (
      await fetch(
        `${base}/api/opportunities?talentName=Natiruts&platform=YouTube&metric=visualizacoes&centerMunicipalityId=4106902&radiusKm=150`
      )
    ).json();
    assert.equal(opp.evaluatedCount, 2); // Curitiba e Joinville têm audiência e cobertura
    const pgItem = opp.items.find(i => i.municipalityCode === '4119905'); // Ponta Grossa não tem relatório de audiência
    assert.equal(pgItem.quadrant, 'insufficient_coverage');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

test('classificação de modalidades e Radar Score versionado respeitam regras de cobertura', () => {
  const c1 = classifyEventModality({
    title: 'Meia Maratona Internacional 21km',
    originalCategory: 'Corrida de Rua',
  });
  assert.equal(c1.modalityId, 'corridas');
  assert.equal(c1.submodalityId, 'corridas:meia-maratona');
  assert.equal(c1.confidence, 'alta');

  const scorePartial = computeRadarScore(
    { growth: 85, acceleration: 70, consistency: 80 },
    { formulaVersion: 'v1-growth', modalityId: 'corridas' }
  );
  assert.ok(scorePartial.score > 0);
  assert.equal(scorePartial.coveragePct, 80);
  assert.deepEqual(scorePartial.missingComponents, [
    'categoryPosition',
    'regionalInterest',
  ]);
});
