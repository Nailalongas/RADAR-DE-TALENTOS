import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/src/database/index.mjs';
import { createRadarServer } from '../server/src/app.mjs';
import {
  categories,
  validTalentTopics,
  suggestedBiographyTopics,
} from '../src/domain/taxonomy.js';
import {
  analysisSnapshot,
  audienceTotal,
  brazilToday,
  buildAnalysis,
  computeCoverage,
  dailyChangeLabel,
  dailyEvolutionData,
  dailyEvolutionPage,
  dailyEvolutionWindow,
  discoveryEvolutionModel,
  growthDashboardData,
  growthDisplayNetworks,
  matchesFollowerReference,
  matchesTalent,
  pageResults,
  profileURL,
  reportCSV,
  sameTalentIdentity,
  shiftDate,
} from '../src/domain/research.js';

test('identidade de talentos agrupa variantes, duplas e rejeita fã-clubes', () => {
  for (const [a, b] of [
    ['NatirutsVEVO', 'Banda Natiruts'],
    ['Natiruts Oficial', 'Natiruts'],
    ['Dupla João & Maria', 'Maria e João'],
    ['Canal Andréa Vermont Oficial', 'Andréa Vermont'],
  ]) {
    assert.equal(sameTalentIdentity(a, b), true, a);
    assert.equal(matchesTalent(a, b), true, a);
  }
  for (const [a, b] of [
    ['Natiruts Fãs', 'Natiruts'],
    ['Natiruts cover', 'Natiruts'],
    ['João Silva', 'João Souza'],
    ['Ana', 'Ana Paula'],
  ]) {
    assert.equal(sameTalentIdentity(a, b), false, a);
  }
});

test('taxonomia valida subcategorias hierárquicas e infere temas da biografia', () => {
  assert.equal(
    validTalentTopics(
      [
        'Palestrantes|Vendas',
        'Palestrantes|Liderança',
        'Influenciadores|Finanças',
      ],
      ['Palestrantes', 'Influenciadores']
    ),
    true
  );
  assert.equal(
    validTalentTopics(['Cantores|Rock'], ['Palestrantes']),
    false
  );
  assert.deepEqual(
    suggestedBiographyTopics({
      categoria: 'Humoristas',
      description: 'Comediante de stand-up e improviso.',
    }),
    ['Humoristas|Stand-up', 'Humoristas|Improviso']
  );
});

test('descoberta e crescimento preservam filtros, períodos exatos/disponíveis, contas pendentes e CSV', () => {
  const today = brazilToday();

  // Group accent variants across networks and compute exact 7-day growth
  const growthRows = [0, 7].flatMap(d => [
    {
      nome: 'Andrea Vermont',
      categoria: 'Palestrantes',
      rede: 'Instagram',
      url: 'https://instagram.com/a',
      data: shiftDate(today, -7 + d),
      seguidores: 1000000 + d * 10000,
    },
    {
      nome: 'Andréa Vermont ',
      categoria: 'Palestrantes',
      rede: 'YouTube',
      url: 'https://youtube.com/channel/a',
      data: shiftDate(today, -7 + d),
      seguidores: 800000 + d * 1000,
    },
  ]);

  let res = buildAnalysis(growthRows, {
    chosenCategories: ['Palestrantes'],
    resultMode: 'growth',
    period: '7',
    calculation: 'full',
    today,
  });
  assert.equal(res.rank.length, 1);
  assert.equal(res.rank[0].gain, 77000);
  assert.equal(res.rank[0].score, (77000 / 1800000) * 100);

  // Never substitute 7 days for 30 in full mode
  res = buildAnalysis(growthRows, {
    chosenCategories: ['Palestrantes'],
    resultMode: 'growth',
    period: '30',
    calculation: 'full',
    today,
  });
  assert.equal(res.rank.length, 0);

  // Available mode uses available dates in the 30-day window
  res = buildAnalysis(growthRows, {
    chosenCategories: ['Palestrantes'],
    resultMode: 'growth',
    period: '30',
    calculation: 'available',
    today,
  });
  assert.equal(res.rank.length, 1);
  assert.equal(res.rank[0].days, 7);

  // Newly found Instagram with 1 collection is excluded from period gain but visible in growthDisplayNetworks
  const natirutsRows = [
    {
      nome: 'Natiruts',
      categoria: 'Cantores',
      rede: 'YouTube',
      url: 'https://youtube.com/channel/natiruts',
      data: shiftDate(today, -7),
      seguidores: 882000,
    },
    {
      nome: 'Natiruts',
      categoria: 'Cantores',
      rede: 'YouTube',
      url: 'https://youtube.com/channel/natiruts',
      data: today,
      seguidores: 883000,
    },
    {
      nome: 'Natiruts',
      categoria: 'Cantores',
      rede: 'Instagram',
      url: 'https://instagram.com/natirutsoficial',
      data: today,
      seguidores: 1390334,
    },
  ];
  res = buildAnalysis(natirutsRows, {
    chosenCategories: ['Cantores'],
    resultMode: 'growth',
    period: '7',
    calculation: 'full',
    today,
  });
  assert.equal(res.rank[0].gain, 1000);
  assert.equal(growthDisplayNetworks(res.rank[0]).length, 2);
  assert.equal(
    growthDisplayNetworks(res.rank[0]).find(n => n.rede === 'Instagram').pending,
    true
  );

  // Linked Instagram without a Meta count stays visible alongside YouTube without invented followers
  const pendingRows = [
    {
      nome: 'Talento vinculado',
      personId: 'youtube:test',
      categoria: 'Cantores',
      rede: 'YouTube',
      url: 'https://youtube.com/channel/test',
      data: today,
      seguidores: 200000,
    },
    {
      nome: 'Talento vinculado',
      personId: 'youtube:test',
      categoria: 'Cantores',
      rede: 'Instagram',
      url: 'https://instagram.com/outro.nome',
      data: '',
      seguidores: null,
      collectionPending: true,
    },
  ];
  res = buildAnalysis(pendingRows, {
    chosenCategories: ['Cantores'],
    network: 'all',
    resultMode: 'discover',
    followerBand: '0:0',
    today,
  });
  assert.equal(res.people.length, 1);
  assert.equal(audienceTotal(res.people[0].latest).value, 200000);
  assert.equal(audienceTotal(res.people[0].latest).partial, true);

  // Unknown count does not qualify when filtering by Instagram follower band
  res = buildAnalysis(pendingRows, {
    chosenCategories: ['Cantores'],
    network: 'Instagram',
    resultMode: 'discover',
    followerBand: '100000:0',
    today,
  });
  assert.equal(res.people.length, 0);

  // Comparison mode: 'two' requires recent counts in both Instagram and YouTube
  res = buildAnalysis(pendingRows, {
    chosenCategories: ['Cantores'],
    comparisonMode: 'two',
    resultMode: 'discover',
    followerBand: '0:0',
    today,
  });
  assert.equal(res.people.length, 0);

  const bothRecentRows = [
    {
      nome: 'Completo',
      personId: 'complete-1',
      categoria: 'Cantores',
      rede: 'YouTube',
      url: 'https://youtube.com/channel/c1',
      data: today,
      seguidores: 200000,
    },
    {
      nome: 'Completo',
      personId: 'complete-1',
      categoria: 'Cantores',
      rede: 'Instagram',
      url: 'https://instagram.com/c1',
      data: shiftDate(today, -3),
      seguidores: 300000,
    },
  ];
  res = buildAnalysis(bothRecentRows, {
    chosenCategories: ['Cantores'],
    comparisonMode: 'two',
    resultMode: 'discover',
    followerBand: '100000:0',
    today,
  });
  assert.equal(res.people.length, 1);

  // Pagination & limits (Top 20/30/40/50 and 'all')
  const manyRows = Array.from({ length: 68 }, (_, i) => ({
    nome: `Perfil ${String(i).padStart(2, '0')}`,
    categoria: 'Cantores',
    rede: 'Instagram',
    url: `https://www.instagram.com/test${i}/`,
    data: today,
    seguidores: 500000 - i * 1000,
  }));
  for (const limit of ['20', '30', '40', '50']) {
    const rLimit = buildAnalysis(manyRows, {
      chosenCategories: ['Cantores'],
      resultLimit: limit,
      today,
    });
    assert.equal(rLimit.people.length, Number(limit));
    assert.equal(rLimit.stats.eligible, 68);
  }
  const rAll = buildAnalysis(manyRows, {
    chosenCategories: ['Cantores'],
    resultLimit: 'all',
    today,
  });
  assert.equal(rAll.people.length, 68);
  assert.equal(pageResults(rAll.people, 'all', 0).length, 50);
  assert.equal(pageResults(rAll.people, 'all', 1).length, 18);

  const csv = reportCSV(
    {
      createdAt: new Date().toISOString(),
      filters: { resultMode: 'discover', categories: ['Cantores'] },
      results: analysisSnapshot('discover', rAll.people, []),
    },
    today
  );
  assert.match(csv, /Perfil 67/);
});

test('cobertura, evolução diária e URLs seguras seguem as regras do legado', () => {
  const today = brazilToday();
  const covRows = [
    ...['Instagram', 'YouTube'].flatMap(rede =>
      [0, 1].map(d => ({
        nome: 'Banda Teste',
        categoria: 'Cantores',
        rede,
        url: `https://example.com/${rede}`,
        data: shiftDate(today, -d),
        seguidores: 200000,
        entityType: 'person',
      }))
    ),
    {
      nome: 'Produtora',
      categoria: 'Cantores',
      rede: 'YouTube',
      url: 'https://example.com/org',
      data: today,
      seguidores: 500000,
      entityType: 'organization',
    },
  ];

  const covPersonOnly = computeCoverage(covRows, { includeOrganizations: false });
  const cantoresPerson = covPersonOnly.byCategory.find(
    c => c.category === 'Cantores'
  );
  assert.deepEqual(cantoresPerson, {
    category: 'Cantores',
    talents: 1,
    Instagram: 1,
    YouTube: 1,
    Spotify: 0,
    both: 1,
  });

  const covWithOrg = computeCoverage(covRows, { includeOrganizations: true });
  const cantoresWithOrg = covWithOrg.byCategory.find(
    c => c.category === 'Cantores'
  );
  assert.deepEqual(cantoresWithOrg, {
    category: 'Cantores',
    talents: 2,
    Instagram: 1,
    YouTube: 2,
    Spotify: 0,
    both: 1,
  });

  // Daily evolution preserves missing dates and baseline
  const daily = dailyEvolutionData([
    {
      rede: 'Instagram',
      hist: [
        { data: '2026-10-22', seguidores: 100 },
        { data: '2026-10-24', seguidores: 90 },
      ],
    },
    { rede: 'YouTube', hist: [{ data: '2026-10-23', seguidores: 50 }] },
  ]);
  assert.deepEqual(daily.dates, ['2026-10-22', '2026-10-23', '2026-10-24']);
  assert.equal(daily.series[0].byDate.get('2026-10-23'), undefined);
  assert.equal(daily.series[0].byDate.get('2026-10-24').gain, -10);
  assert.equal(daily.series[0].byDate.get('2026-10-24').percent, -10);

  const window7 = dailyEvolutionWindow(
    [
      {
        rede: 'Instagram',
        hist: [
          { data: '2026-10-01', seguidores: 100 },
          { data: '2026-10-20', seguidores: 150 },
          { data: '2026-10-25', seguidores: 200 },
        ],
      },
    ],
    { period: '7' }
  );
  assert.equal(window7.dates.length, 7);
  assert.equal(window7.dates[0], '2026-10-19');
  assert.equal(window7.series[0].byDate.get('2026-10-25').percent, 100);

  const aligned = dailyEvolutionPage(
    { dates: Array.from({ length: 15 }, (_, i) => `d${i}`) },
    null,
    7
  );
  assert.equal(aligned.pages, 3);
  assert.equal(aligned.current, 2);
  assert.deepEqual(aligned.dates, ['d8', 'd9', 'd10', 'd11', 'd12', 'd13', 'd14']);

  assert.equal(
    dailyChangeLabel({ previous: '2026-10-24', gain: 12500 }, '2026-10-25'),
    '+12.500 no dia'
  );
  assert.equal(
    dailyChangeLabel({ previous: '2026-10-23', gain: 12500 }, '2026-10-25'),
    'Sem comparação diária'
  );

  // Safe URL resolution
  assert.equal(
    profileURL(
      { rede: 'Instagram', end: { nome: 'Teste', url: 'javascript:alert(1)' } },
      [{ nome: 'Teste', rede: 'Instagram', data: today, url: 'https://www.instagram.com/fallback/' }]
    ),
    'https://www.instagram.com/fallback/'
  );

  // Unified audience bands
  assert.equal(
    matchesFollowerReference(
      [
        { rede: 'Instagram', seguidores: 2000000 },
        { rede: 'YouTube', seguidores: 200000 },
      ],
      'all',
      100000,
      300000
    ),
    true
  );

  // Discovery evolution model & Growth dashboard data
  const evoModel = discoveryEvolutionModel(
    {
      rows: [
        {
          nome: 'Dupla',
          rede: 'Instagram',
          url: 'https://instagram.com/dupla/',
          data: '2026-10-22',
          seguidores: 1103484,
        },
        {
          nome: 'Dupla',
          rede: 'Instagram',
          url: 'https://instagram.com/dupla/',
          data: '2026-10-25',
          seguidores: 1314690,
        },
        {
          nome: 'Dupla',
          rede: 'YouTube',
          url: 'https://youtube.com/channel/dupla',
          data: '2026-10-17',
          seguidores: 557000,
        },
        {
          nome: 'Dupla',
          rede: 'YouTube',
          url: 'https://youtube.com/channel/dupla',
          data: '2026-10-24',
          seguidores: 571000,
        },
      ],
    },
    '2026-10-25'
  );
  assert.equal(evoModel.total, 1885690);
  assert.equal(evoModel.gain, 225206);
  assert.equal(evoModel.comparable, 2);

  const gd = growthDashboardData(
    evoModel.networks.flatMap(n => n.hist),
    0,
    'all',
    'all',
    'gain',
    '2026-10-25',
    '0:0'
  );
  assert.equal(gd.ranked.length, 1);
  assert.equal(gd.ranked[0].gain, 225206);
});

test('rotas /api/taxonomy, /api/research, /api/history e /api/evolution consultam o SQLite corretamente', async () => {
  const db = openDatabase(':memory:');
  try {
    const cantoresId = db
      .prepare("SELECT id FROM categories WHERE name = 'Cantores'")
      .get().id;
    const mpbTopic = db
      .prepare(
        "SELECT id, category_id FROM topics WHERE category_id = ? AND name = 'MPB'"
      )
      .get(cantoresId);

    // Talent 1: Active with Instagram (pt), YouTube companion (unknown, confirmed), and queued Spotify
    db.prepare('INSERT INTO talents(id, name, entity_type, blocked) VALUES (?, ?, ?, ?)')
      .run('t-natiruts', 'Natiruts', 'person', 0);
    db.prepare('INSERT INTO talent_categories(talent_id, category_id) VALUES (?, ?)')
      .run('t-natiruts', cantoresId);
    db.prepare(
      'INSERT INTO talent_topics(talent_id, topic_id, category_id) VALUES (?, ?, ?)'
    ).run('t-natiruts', mpbTopic.id, mpbTopic.category_id);

    db.prepare(
      `INSERT INTO social_accounts(id, talent_id, network, external_id, url, identity_confirmed, identity_source, content_language, collection_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'acc-ig',
      't-natiruts',
      'Instagram',
      'natirutsoficial',
      'https://www.instagram.com/natirutsoficial/',
      1,
      'https://www.youtube.com/channel/UCfguI5bxcFwOjuD3qti4FAw',
      'pt',
      'collected'
    );

    db.prepare(
      `INSERT INTO social_accounts(id, talent_id, network, external_id, url, identity_confirmed, identity_source, content_language, collection_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'acc-yt',
      't-natiruts',
      'YouTube',
      'UCfguI5bxcFwOjuD3qti4FAw',
      'https://www.youtube.com/channel/UCfguI5bxcFwOjuD3qti4FAw',
      1,
      'https://www.youtube.com/channel/UCfguI5bxcFwOjuD3qti4FAw',
      'unknown',
      'collected'
    );

    db.prepare(
      `INSERT INTO social_accounts(id, talent_id, network, external_id, url, identity_confirmed, identity_source, content_language, collection_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'acc-sp',
      't-natiruts',
      'Spotify',
      'spotify-natiruts',
      'https://open.spotify.com/artist/natiruts',
      1,
      'https://open.spotify.com/artist/natiruts',
      'pt',
      'queued'
    );

    // 3 snapshots for Instagram, 1 for YouTube
    for (const [date, val] of [
      ['2026-11-10', 1300000],
      ['2026-11-14', 1350000],
      ['2026-11-17', 1390334],
    ]) {
      db.prepare(
        `INSERT INTO metric_snapshots(account_id, network, metric, observed_on, value, source)
         VALUES (?, 'Instagram', 'followers', ?, ?, 'Meta Graph API')`
      ).run('acc-ig', date, val);
    }
    db.prepare(
      `INSERT INTO metric_snapshots(account_id, network, metric, observed_on, value, source)
       VALUES ('acc-yt', 'YouTube', 'subscribers', '2026-11-17', 883000, 'YouTube Data API')`
    ).run();

    // Talent 2: Blocked talent (must not appear)
    db.prepare('INSERT INTO talents(id, name, entity_type, blocked) VALUES (?, ?, ?, ?)')
      .run('t-blocked', 'Bloqueado', 'person', 1);
    db.prepare(
      `INSERT INTO social_accounts(id, talent_id, network, url, content_language, collection_state)
       VALUES ('acc-blocked', 't-blocked', 'Instagram', 'https://www.instagram.com/blocked/', 'pt', 'collected')`
    ).run();
    db.prepare(
      `INSERT INTO metric_snapshots(account_id, network, metric, observed_on, value, source)
       VALUES ('acc-blocked', 'Instagram', 'followers', '2026-11-17', 999999, 'teste')`
    ).run();

    // Talent 3: Foreign language account ('en') (must be filtered out)
    db.prepare('INSERT INTO talents(id, name, entity_type, blocked) VALUES (?, ?, ?, ?)')
      .run('t-foreign', 'Foreign Star', 'person', 0);
    db.prepare(
      `INSERT INTO social_accounts(id, talent_id, network, url, content_language, collection_state)
       VALUES ('acc-en', 't-foreign', 'Instagram', 'https://www.instagram.com/foreign/', 'en', 'collected')`
    ).run();
    db.prepare(
      `INSERT INTO metric_snapshots(account_id, network, metric, observed_on, value, source)
       VALUES ('acc-en', 'Instagram', 'followers', '2026-11-17', 500000, 'teste')`
    ).run();

    const server = createRadarServer({ database: db });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;

      // 1. Taxonomy
      const taxRes = await fetch(`${base}/api/taxonomy`);
      assert.equal(taxRes.status, 200);
      const taxData = await taxRes.json();
      assert.deepEqual(taxData.categories, categories);
      assert.ok(taxData.taxonomy.Cantores.includes('MPB'));

      // 2. Research summary (compact first + last per profile in range + pending accounts)
      const researchRes = await fetch(
        `${base}/api/research?start=2026-11-01&end=2026-11-17`
      );
      assert.equal(researchRes.status, 200);
      const researchData = await researchRes.json();
      assert.equal(researchData.summaryOnly, true);
      assert.equal(researchData.historyStart, '2026-11-10');
      // 2 for Instagram (first + last), 1 for YouTube, 1 for queued Spotify = 4 rows
      assert.equal(researchData.rows.length, 4);
      assert.equal(
        researchData.rows.some(r => r.nome === 'Bloqueado'),
        false
      );
      assert.equal(
        researchData.rows.some(r => r.nome === 'Foreign Star'),
        false
      );
      const ytRow = researchData.rows.find(r => r.rede === 'YouTube');
      assert.equal(ytRow.languageExempt, true);
      assert.deepEqual(ytRow.subcategorias, ['Cantores|MPB']);
      const spRow = researchData.rows.find(r => r.rede === 'Spotify');
      assert.equal(spRow.collectionPending, true);
      assert.equal(spRow.seguidores, null);

      // 3. Full history (includes middle snapshot 2026-11-14)
      const histRes = await fetch(`${base}/api/history`);
      assert.equal(histRes.status, 200);
      const histData = await histRes.json();
      assert.equal(histData.summaryOnly, false);
      assert.equal(histData.rows.length, 5);

      // 4. Evolution by personId
      const evoRes = await fetch(
        `${base}/api/evolution?personId=t-natiruts&name=Natiruts`
      );
      assert.equal(evoRes.status, 200);
      const evoData = await evoRes.json();
      assert.equal(evoData.rows.length, 5);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    db.close();
  }
});
