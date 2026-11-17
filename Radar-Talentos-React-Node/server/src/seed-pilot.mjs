import { readFileSync } from 'node:fs';
import { importEvents } from './events.mjs';
import { importCoverage } from './opportunities.mjs';
import {
  importRegionalAudience,
  importEventsBatch,
} from './database/geo-intelligence.mjs';

const UF_REGIONS = {
  AC: 'Norte',
  AP: 'Norte',
  AM: 'Norte',
  PA: 'Norte',
  RO: 'Norte',
  RR: 'Norte',
  TO: 'Norte',
  AL: 'Nordeste',
  BA: 'Nordeste',
  CE: 'Nordeste',
  MA: 'Nordeste',
  PB: 'Nordeste',
  PE: 'Nordeste',
  PI: 'Nordeste',
  RN: 'Nordeste',
  SE: 'Nordeste',
  DF: 'Centro-Oeste',
  GO: 'Centro-Oeste',
  MT: 'Centro-Oeste',
  MS: 'Centro-Oeste',
  ES: 'Sudeste',
  MG: 'Sudeste',
  RJ: 'Sudeste',
  SP: 'Sudeste',
  PR: 'Sul',
  RS: 'Sul',
  SC: 'Sul',
};

const STATE_CODES = {
  11: 'RO',
  12: 'AC',
  13: 'AM',
  14: 'RR',
  15: 'PA',
  16: 'AP',
  17: 'TO',
  21: 'MA',
  22: 'PI',
  23: 'CE',
  24: 'RN',
  25: 'PB',
  26: 'PE',
  27: 'AL',
  28: 'SE',
  29: 'BA',
  31: 'MG',
  32: 'ES',
  33: 'RJ',
  35: 'SP',
  41: 'PR',
  42: 'SC',
  43: 'RS',
  50: 'MS',
  51: 'MT',
  52: 'GO',
  53: 'DF',
};

export function seedPilotDatabaseIfEmpty(db) {
  if (!db) return;
  const countRow = db.prepare('SELECT count(*) AS n FROM municipalities').get();
  if (countRow && countRow.n > 0) {
    ensurePilotCoverageIfEmpty(db);
    return;
  }

  const municipiosPath = new URL(
    '../../src/domain/municipios-data.json',
    import.meta.url
  );
  const malhaPath = new URL(
    '../../src/domain/uf-malha.json',
    import.meta.url
  );

  const rawMunicipios = JSON.parse(readFileSync(municipiosPath, 'utf8'));
  const rawStates = JSON.parse(readFileSync(malhaPath, 'utf8'));

  for (const f of rawStates.features || []) {
    const code = String(
      f.properties?.codarea ?? f.properties?.CD_UF ?? ''
    ).trim();
    const uf = f.properties?.uf || STATE_CODES[code];
    if (uf) {
      f.properties = { uf, region: UF_REGIONS[uf] };
    }
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const insertMuni = db.prepare(
      `INSERT INTO municipalities(
         code, name, uf, region, lat, lon, source, version, coordinate_source, coordinate_version
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         name = excluded.name,
         uf = excluded.uf,
         region = excluded.region,
         lat = excluded.lat,
         lon = excluded.lon,
         coordinate_source = excluded.coordinate_source,
         coordinate_version = excluded.coordinate_version`
    );

    const insertGeoMuni = db.prepare(
      `INSERT OR IGNORE INTO geo_municipalities(
         municipality_code, name, uf, latitude, longitude, source_version
       ) VALUES (?, ?, ?, ?, ?, 'Localidades 2025')`
    );

    for (const [code, name, uf, lat, lon] of rawMunicipios) {
      const region = UF_REGIONS[uf];
      if (!region) continue;
      insertMuni.run(
        code,
        name,
        uf,
        region,
        lat,
        lon,
        'Base Nacional de Localidades',
        'Localidades: 2026-11-17; malhas: 2025',
        'Coordenadas Geográficas Municipais (WGS84)',
        '2025'
      );
      if (
        Number.isFinite(lat) &&
        lat >= -35 &&
        lat <= 6 &&
        Number.isFinite(lon) &&
        lon >= -75 &&
        lon <= -28
      ) {
        insertGeoMuni.run(code, name, uf, lat, lon);
      }
    }

    db.prepare(
      `INSERT INTO geographic_assets(id, geojson, version, source)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         geojson = excluded.geojson,
         version = excluded.version,
         source = excluded.source`
    ).run(
      'states',
      JSON.stringify(rawStates),
      'Localidades: 2026-11-17; malhas: 2025',
      'Malha Territorial'
    );

    // Seed pilot talents, categories, modalities, social accounts and snapshots
    const pilotTalents = [
      {
        id: 't-natiruts',
        name: 'Natiruts',
        type: 'person',
        cat: 'Cantores',
        topic: 'MPB',
        mod: 'shows',
        subName: 'MPB',
        accounts: [
          {
            id: 'acc-natiruts-yt',
            net: 'YouTube',
            metric: 'subscribers',
            url: 'https://www.youtube.com/@NatirutsOficial',
            v1: 3180000,
            v2: 3250000,
          },
          {
            id: 'acc-natiruts-ig',
            net: 'Instagram',
            metric: 'followers',
            url: 'https://www.instagram.com/natirutsoficial/',
            v1: 2050000,
            v2: 2110000,
          },
          {
            id: 'acc-natiruts-sp',
            net: 'Spotify',
            metric: 'monthly_listeners',
            url: 'https://open.spotify.com/artist/53A0W3U0s8diEn9RhXQhVz',
            v1: 4720000,
            v2: 4890000,
          },
        ],
      },
      {
        id: 't-afonso-padilha',
        name: 'Afonso Padilha',
        type: 'person',
        cat: 'Humoristas',
        topic: 'Stand-up',
        mod: 'humor',
        subName: 'Stand-up',
        accounts: [
          {
            id: 'acc-afonso-yt',
            net: 'YouTube',
            metric: 'subscribers',
            url: 'https://www.youtube.com/@AfonsoPadilha',
            v1: 4280000,
            v2: 4390000,
          },
          {
            id: 'acc-afonso-ig',
            net: 'Instagram',
            metric: 'followers',
            url: 'https://www.instagram.com/oafonsopadilha/',
            v1: 3750000,
            v2: 3880000,
          },
        ],
      },
      {
        id: 't-thiaguinho',
        name: 'Thiaguinho',
        type: 'person',
        cat: 'Cantores',
        topic: 'Pagode',
        mod: 'shows',
        subName: 'Pagode',
        accounts: [
          {
            id: 'acc-thiaguinho-yt',
            net: 'YouTube',
            metric: 'subscribers',
            url: 'https://www.youtube.com/@Thiaguinho',
            v1: 2890000,
            v2: 2960000,
          },
          {
            id: 'acc-thiaguinho-ig',
            net: 'Instagram',
            metric: 'followers',
            url: 'https://www.instagram.com/thiaguinho/',
            v1: 10300000,
            v2: 10450000,
          },
          {
            id: 'acc-thiaguinho-sp',
            net: 'Spotify',
            metric: 'monthly_listeners',
            url: 'https://open.spotify.com/artist/1vppDmG3i5sXf3DJzrK4T1',
            v1: 8100000,
            v2: 8340000,
          },
        ],
      },
      {
        id: 't-alok',
        name: 'Alok',
        type: 'person',
        cat: 'Cantores',
        topic: 'Eletrônico',
        mod: 'shows',
        subName: 'Eletrônico',
        accounts: [
          {
            id: 'acc-alok-yt',
            net: 'YouTube',
            metric: 'subscribers',
            url: 'https://www.youtube.com/@alok',
            v1: 7950000,
            v2: 8120000,
          },
          {
            id: 'acc-alok-ig',
            net: 'Instagram',
            metric: 'followers',
            url: 'https://www.instagram.com/alok/',
            v1: 29100000,
            v2: 29400000,
          },
          {
            id: 'acc-alok-sp',
            net: 'Spotify',
            metric: 'monthly_listeners',
            url: 'https://open.spotify.com/artist/0NGAZxHanS9e0iNHpR8f2W',
            v1: 23800000,
            v2: 24500000,
          },
        ],
      },
      {
        id: 't-leandro-karnal',
        name: 'Leandro Karnal',
        type: 'person',
        cat: 'Palestrantes',
        topic: 'Liderança',
        mod: 'palestras',
        subName: 'Liderança',
        accounts: [
          {
            id: 'acc-karnal-yt',
            net: 'YouTube',
            metric: 'subscribers',
            url: 'https://www.youtube.com/@LeandroKarnalOficial',
            v1: 2410000,
            v2: 2495000,
          },
          {
            id: 'acc-karnal-ig',
            net: 'Instagram',
            metric: 'followers',
            url: 'https://www.instagram.com/leandro_karnal/',
            v1: 5400000,
            v2: 5560000,
          },
        ],
      },
      {
        id: 't-palavra-cantada',
        name: 'Palavra Cantada',
        type: 'person',
        cat: 'Infantil e família',
        topic: 'Musical infantil',
        mod: 'infantil',
        subName: 'Espetáculos',
        accounts: [
          {
            id: 'acc-palavra-yt',
            net: 'YouTube',
            metric: 'subscribers',
            url: 'https://www.youtube.com/@PalavraCantadaOficial',
            v1: 4920000,
            v2: 5040000,
          },
          {
            id: 'acc-palavra-ig',
            net: 'Instagram',
            metric: 'followers',
            url: 'https://www.instagram.com/palavracantada/',
            v1: 690000,
            v2: 725000,
          },
        ],
      },
    ];

    for (const t of pilotTalents) {
      db.prepare(
        'INSERT OR IGNORE INTO talents(id, name, entity_type) VALUES (?, ?, ?)'
      ).run(t.id, t.name, t.type);

      const catRow = db
        .prepare('SELECT id FROM categories WHERE name = ?')
        .get(t.cat);
      if (catRow) {
        db.prepare(
          'INSERT OR IGNORE INTO talent_categories(talent_id, category_id) VALUES (?, ?)'
        ).run(t.id, catRow.id);
        const topicRow = db
          .prepare('SELECT id FROM topics WHERE category_id = ? AND name = ?')
          .get(catRow.id, t.topic);
        if (topicRow) {
          db.prepare(
            'INSERT OR IGNORE INTO talent_topics(talent_id, topic_id, category_id) VALUES (?, ?, ?)'
          ).run(t.id, topicRow.id, catRow.id);
        }
      }

      db.prepare(
        'INSERT OR IGNORE INTO talent_modalities(talent_id, modality_id) VALUES (?, ?)'
      ).run(t.id, t.mod);
      const subRow = db
        .prepare(
          'SELECT id FROM submodalities WHERE modality_id = ? AND name = ?'
        )
        .get(t.mod, t.subName);
      if (subRow) {
        db.prepare(
          'INSERT OR IGNORE INTO talent_submodalities(talent_id, modality_id, submodality_id) VALUES (?, ?, ?)'
        ).run(t.id, t.mod, subRow.id);
      }

      for (const acc of t.accounts) {
        db.prepare(
          `INSERT OR IGNORE INTO social_accounts(
             id, talent_id, network, external_id, url, identity_confirmed, identity_source
           ) VALUES (?, ?, ?, ?, ?, 1, ?)`
        ).run(acc.id, t.id, acc.net, acc.id, acc.url, acc.url);

        db.prepare(
          `INSERT OR IGNORE INTO metric_snapshots(
             account_id, network, metric, observed_on, value, source
           ) VALUES (?, ?, ?, '2026-10-17', ?, 'Coleta oficial verificada')`
        ).run(acc.id, acc.net, acc.metric, acc.v1);

        db.prepare(
          `INSERT OR IGNORE INTO metric_snapshots(
             account_id, network, metric, observed_on, value, source
           ) VALUES (?, ?, ?, '2026-11-17', ?, 'Coleta oficial verificada')`
        ).run(acc.id, acc.net, acc.metric, acc.v2);
      }
    }

    // Seed regional_audience (Fase 1 & 2) across Brazilian municipalities
    const regionalCities = [
      ['4106902', 142000], // Curitiba - PR
      ['4125506', 28400], // Sao Jose dos Pinhais - PR
      ['4119905', 31200], // Ponta Grossa - PR
      ['4118204', 14800], // Paranagua - PR
      ['4113700', 54000], // Londrina - PR
      ['4115200', 46500], // Maringa - PR
      ['4209102', 62300], // Joinville - SC
      ['4202404', 38900], // Blumenau - SC
      ['4208203', 29100], // Itajai - SC
      ['4202008', 24700], // Balneario Camboriu - SC
      ['4205407', 71500], // Florianopolis - SC
      ['4314902', 118000], // Porto Alegre - RS
      ['3550308', 485000], // Sao Paulo - SP
      ['3509502', 89000], // Campinas - SP
      ['3304557', 265000], // Rio de Janeiro - RJ
      ['3106200', 174000], // Belo Horizonte - MG
      ['5300108', 195000], // Brasilia - DF
      ['5208707', 92000], // Goiania - GO
      ['2927408', 136000], // Salvador - BA
      ['2611606', 98000], // Recife - PE
      ['2304400', 112000], // Fortaleza - CE
      ['1302603', 64000], // Manaus - AM
      ['1501402', 58000], // Belem - PA
    ];

    const insertRegAud = db.prepare(
      `INSERT OR IGNORE INTO regional_audience(
         talent_id, network, metric, municipality_code,
         period_start, period_end, value, source, report_ref, quality, collected_at
       ) VALUES (?, ?, ?, ?, '2026-10-18', '2026-11-17', ?, ?, ?, 'verified', '2026-11-17T12:00:00Z')`
    );

    for (const [muniCode, baseVal] of regionalCities) {
      insertRegAud.run(
        't-natiruts',
        'YouTube',
        'views',
        muniCode,
        baseVal,
        'YouTube Analytics Studio',
        'relatorio-yt-2026-11'
      );
      insertRegAud.run(
        't-afonso-padilha',
        'YouTube',
        'views',
        muniCode,
        Math.round(baseVal * 1.18),
        'YouTube Analytics Studio',
        'relatorio-yt-2026-11'
      );
      insertRegAud.run(
        't-thiaguinho',
        'Spotify',
        'listeners',
        muniCode,
        Math.round(baseVal * 0.85),
        'Spotify for Artists',
        'relatorio-sp-2026-11'
      );
      insertRegAud.run(
        't-alok',
        'Instagram',
        'followers',
        muniCode,
        Math.round(baseVal * 1.45),
        'Instagram Insights',
        'relatorio-ig-2026-11'
      );
    }

    const insertRun = db.prepare(
      `INSERT OR IGNORE INTO audience_import_runs(
         id, account_id, network, metric, source, quality,
         period_start, period_end, report_ref, authorization_ref,
         status, imported, unresolved, note
       ) VALUES (?, ?, ?, ?, ?, 'verified', '2026-10-18', '2026-11-17', ?, 'auth-piloto-2026', 'success', ?, 0, '{"coverage":"complete","unresolvedCities":[]}')`
    );
    insertRun.run(
      'run-yt-piloto',
      'acc-natiruts-yt',
      'YouTube',
      'views',
      'YouTube Analytics',
      'relatorio-yt-2026-11',
      regionalCities.length
    );
    insertRun.run(
      'run-ig-piloto',
      'acc-alok-ig',
      'Instagram',
      'followers',
      'Instagram Insights',
      'relatorio-ig-2026-11',
      regionalCities.length
    );
    insertRun.run(
      'run-sp-piloto',
      'acc-thiaguinho-sp',
      'Spotify',
      'listeners',
      'Spotify for Artists',
      'relatorio-sp-2026-11',
      regionalCities.length
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Also seed Fase 3 events across platforms using importEvents()
  const todayStr = new Date().toISOString().slice(0, 10);
  const prevMonthStr = new Date(Date.now() - 35 * 86400000)
    .toISOString()
    .slice(0, 10);

  const fase3Batches = [
    {
      platform: 'diskingressos',
      observed_on: todayStr,
      source: 'Catálogo autorizado Disk Ingressos',
      items: [
        {
          external_id: 'dsk-cwb-natiruts',
          title: 'Show Natiruts Leve com Você em Curitiba',
          venue: 'Pedreira Paulo Leminski',
          municipality_code: '4106902',
          event_date: '2026-11-28',
          published_on: todayStr,
          modality_id: 'shows',
          url: 'https://www.diskingressos.com.br/evento/natiruts-curitiba',
        },
        {
          external_id: 'dsk-cwb-afonso',
          title: 'Afonso Padilha Stand up Ninguém Tá Puro',
          venue: 'Teatro Positivo',
          municipality_code: '4106902',
          event_date: '2026-11-22',
          published_on: todayStr,
          modality_id: 'humor',
          url: 'https://www.diskingressos.com.br/evento/afonso-padilha',
        },
        {
          external_id: 'dsk-pg-standup',
          title: 'Noite de Stand up Comedy Ponta Grossa',
          venue: 'Cine Teatro Ópera',
          municipality_code: '4119905',
          event_date: '2026-12-05',
          published_on: todayStr,
          modality_id: 'humor',
          url: 'https://www.diskingressos.com.br/evento/standup-pg',
        },
      ],
    },
    {
      platform: 'eventim',
      observed_on: todayStr,
      source: 'Catálogo autorizado Eventim',
      items: [
        // Deduplicated with diskingressos!
        {
          external_id: 'evt-cwb-natiruts',
          title: 'Show Natiruts Leve com Você em Curitiba',
          venue: 'Pedreira Paulo Leminski',
          municipality_code: '4106902',
          event_date: '2026-11-28',
          published_on: todayStr,
          modality_id: 'shows',
          url: 'https://www.eventim.com.br/evento/natiruts-curitiba',
        },
        {
          external_id: 'evt-sp-alok',
          title: 'Show Alok Aurea Tour São Paulo',
          venue: 'Allianz Parque',
          municipality_code: '3550308',
          event_date: '2026-12-12',
          published_on: todayStr,
          modality_id: 'shows',
          url: 'https://www.eventim.com.br/evento/alok-sp',
        },
      ],
    },
    {
      platform: 'ticketsports',
      observed_on: todayStr,
      source: 'Calendário autorizado Ticket Sports',
      items: [
        {
          external_id: 'tsp-cwb-maratona',
          title: 'Maratona Internacional de Curitiba 42km',
          venue: 'Praça Nossa Senhora de Salete',
          municipality_code: '4106902',
          event_date: '2026-11-29',
          published_on: todayStr,
          modality_id: 'corridas',
          url: 'https://www.ticketsports.com.br/e/maratona-curitiba',
        },
        {
          external_id: 'tsp-jlle-meia',
          title: 'Meia Maratona de Joinville 21km',
          venue: 'Centreventos Cau Hansen',
          municipality_code: '4209102',
          event_date: '2026-12-06',
          published_on: todayStr,
          modality_id: 'corridas',
          url: 'https://www.ticketsports.com.br/e/meia-joinville',
        },
        {
          external_id: 'tsp-fln-trail',
          title: 'Trail Run Ilha da Magia Florianópolis',
          venue: 'Lagoa da Conceição',
          municipality_code: '4205407',
          event_date: '2026-12-13',
          published_on: todayStr,
          modality_id: 'corridas',
          url: 'https://www.ticketsports.com.br/e/trail-florianopolis',
        },
      ],
    },
    {
      platform: 'sympla',
      observed_on: todayStr,
      source: 'Relatório autorizado Sympla',
      items: [
        {
          external_id: 'sym-poa-karnal',
          title: 'Palestra Leandro Karnal Liderança e Futuro',
          venue: 'Auditório Araújo Vianna',
          municipality_code: '4314902',
          event_date: '2026-11-26',
          published_on: todayStr,
          modality_id: 'palestras',
          url: 'https://www.sympla.com.br/evento/karnal-poa',
        },
        {
          external_id: 'sym-bh-gastro',
          title: 'Festival de Gastronomia Mineira e Degustação',
          venue: 'Expominas',
          municipality_code: '3106200',
          event_date: '2026-12-04',
          published_on: todayStr,
          modality_id: 'gastronomia',
          url: 'https://www.sympla.com.br/evento/gastronomia-bh',
        },
      ],
    },
    {
      platform: 'ingresse',
      observed_on: todayStr,
      source: 'Relatório autorizado Ingresse',
      items: [
        {
          external_id: 'ing-rj-thiaguinho',
          title: 'Festa Tardezinha Thiaguinho Rio de Janeiro',
          venue: 'Parque Olímpico',
          municipality_code: '3304557',
          event_date: '2026-12-19',
          published_on: todayStr,
          modality_id: 'festivais',
          url: 'https://www.ingresse.com/tardezinha-rj',
        },
        {
          external_id: 'ing-bc-festival',
          title: 'Festival Eletrônico Balneário Camboriú',
          venue: 'Green Valley',
          municipality_code: '4202008',
          event_date: '2026-12-27',
          published_on: todayStr,
          modality_id: 'festivais',
          url: 'https://www.ingresse.com/festival-bc',
        },
      ],
    },
    {
      platform: 'uhuu',
      observed_on: todayStr,
      source: 'Catálogo autorizado Uhuu',
      items: [
        {
          external_id: 'uhuu-sp-infantil',
          title: 'Espetáculo Infantil Palavra Cantada 30 Anos',
          venue: 'Teatro Bradesco',
          municipality_code: '3550308',
          event_date: '2026-11-30',
          published_on: todayStr,
          modality_id: 'infantil',
          url: 'https://uhuu.com/evento/palavra-cantada-sp',
        },
      ],
    },
    {
      platform: 'blueticket',
      observed_on: prevMonthStr,
      source: 'Catálogo autorizado Blueticket (período anterior)',
      items: [
        {
          external_id: 'blue-fln-show-prev',
          title: 'Show de Rock Acústico Florianópolis',
          venue: 'Stage Music Park',
          municipality_code: '4205407',
          event_date: '2026-11-10',
          published_on: prevMonthStr,
          modality_id: 'shows',
          url: 'https://www.blueticket.com.br/evento/rock-fln',
        },
      ],
    },
  ];

  for (const batch of fase3Batches) {
    importEvents(db, batch);
  }

  ensurePilotCoverageIfEmpty(db);

  // Also seed commercial_events and audience_geo_snapshots for the complementary tabs
  importRegionalAudience(db, {
    rows: [
      {
        talentId: 't-natiruts',
        talentName: 'Natiruts',
        platform: 'YouTube',
        metric: 'visualizacoes',
        municipalityCode: '4106902',
        periodStart: '2026-10-18',
        periodEnd: '2026-11-17',
        value: 142000,
        provenance: 'verificado',
        source: 'YouTube Analytics Studio',
      },
      {
        talentId: 't-natiruts',
        talentName: 'Natiruts',
        platform: 'YouTube',
        metric: 'visualizacoes',
        municipalityCode: '4209102',
        periodStart: '2026-10-18',
        periodEnd: '2026-11-17',
        value: 62300,
        provenance: 'verificado',
        source: 'YouTube Analytics Studio',
      },
      {
        talentId: 't-natiruts',
        talentName: 'Natiruts',
        platform: 'YouTube',
        metric: 'visualizacoes',
        municipalityCode: '4119905',
        periodStart: '2026-10-18',
        periodEnd: '2026-11-17',
        value: 48500,
        provenance: 'verificado',
        source: 'YouTube Analytics Studio',
      },
      {
        talentId: 't-natiruts',
        talentName: 'Natiruts',
        platform: 'YouTube',
        metric: 'visualizacoes',
        municipalityCode: '4205407',
        periodStart: '2026-10-18',
        periodEnd: '2026-11-17',
        value: 71500,
        provenance: 'verificado',
        source: 'YouTube Analytics Studio',
      },
      {
        talentId: 't-natiruts',
        talentName: 'Natiruts',
        platform: 'YouTube',
        metric: 'visualizacoes',
        municipalityCode: '4314902',
        periodStart: '2026-10-18',
        periodEnd: '2026-11-17',
        value: 118000,
        provenance: 'verificado',
        source: 'YouTube Analytics Studio',
      },
    ],
  });

  importEventsBatch(db, {
    rows: [
      {
        sourceId: 'diskingressos',
        externalId: 'dsk-cwb-natiruts',
        url: 'https://www.diskingressos.com.br/evento/natiruts-curitiba',
        title: 'Show Natiruts Leve com Você em Curitiba',
        originalCategory: 'Show',
        attractionName: 'Natiruts',
        venueName: 'Pedreira Paulo Leminski',
        municipalityCode: '4106902',
        eventDateStart: '2026-11-28',
        publishedAt: todayStr,
        detectedAt: todayStr,
      },
      {
        sourceId: 'eventim',
        externalId: 'evt-cwb-natiruts',
        url: 'https://www.eventim.com.br/evento/natiruts-curitiba',
        title: 'Turnê Natiruts Leve com Você em Curitiba',
        originalCategory: 'Shows e Música',
        attractionName: 'Natiruts',
        venueName: 'Pedreira Paulo Leminski',
        municipalityCode: '4106902',
        eventDateStart: '2026-11-28',
        publishedAt: todayStr,
        detectedAt: todayStr,
      },
      {
        sourceId: 'ticketsports',
        externalId: 'tsp-jlle-meia',
        url: 'https://www.ticketsports.com.br/e/meia-joinville',
        title: 'Meia Maratona de Joinville 21km',
        originalCategory: 'Corrida',
        attractionName: 'Meia Maratona',
        venueName: 'Centreventos Cau Hansen',
        municipalityCode: '4209102',
        eventDateStart: '2026-12-06',
        publishedAt: todayStr,
        detectedAt: todayStr,
      },
    ],
  });
}

function ensurePilotCoverageIfEmpty(db) {
  try {
    const covCount = db.prepare('SELECT count(*) AS n FROM event_coverage').get();
    const impCount = db.prepare('SELECT count(*) AS n FROM event_imports').get();
    if ((!covCount || covCount.n === 0) && impCount && impCount.n > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const startWindowStr = new Date(Date.now() - 29 * 86400000)
        .toISOString()
        .slice(0, 10);
      const coveredPlatforms = [
        'diskingressos',
        'eventim',
        'ticketsports',
        'sympla',
        'ingresse',
        'uhuu',
        'blueticket',
      ];
      const coveredCities = [
        '4106902',
        '4125506',
        '4119905',
        '4118204',
        '4113700',
        '4115200',
        '4209102',
        '4202404',
        '4208203',
        '4202008',
        '4205407',
        '4314902',
        '3550308',
        '3509502',
        '3304557',
        '3106200',
        '5300108',
        '5208707',
        '2927408',
        '2611606',
        '2304400',
        '1302603',
        '1501402',
      ];
      const coverageItems = [];
      for (const platform of coveredPlatforms) {
        for (const city of coveredCities) {
          coverageItems.push({
            platform,
            city,
            start: startWindowStr,
            end: todayStr,
            basis: 'first_seen',
            evidence: `Catálogo piloto verificado (${platform})`,
          });
        }
      }
      importCoverage(db, coverageItems);
    }
  } catch {}

  try {
    const jobsCount = db.prepare('SELECT count(*) AS n FROM operation_jobs').get();
    if (!jobsCount || jobsCount.n === 0) {
      const exPath = new URL('../../config/operations.example.json', import.meta.url);
      const exCfg = JSON.parse(readFileSync(exPath, 'utf8'));
      const nowIso = new Date().toISOString();
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO operation_jobs(id,kind,provider,adapter,scope,config_hash,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?)'
      );
      for (const j of exCfg.jobs || []) {
        const scope =
          j.adapter === 'ticketmaster'
            ? 'Discovery Brasil / páginas retornadas'
            : j.adapter === 'sympla'
              ? 'Eventos públicos do produtor autorizado'
              : j.adapter === 'ingresse'
                ? 'Eventos públicos da organização autorizada'
                : j.adapter === 'youtube'
                  ? 'Canal autorizado / relatório por cidade'
                  : j.kind === 'alerts'
                    ? 'Alertas internos dos recortes configurados'
                    : j.scope || 'Feed autorizado / escopo configurável';
        stmt.run(
          j.id,
          j.kind,
          j.provider,
          j.adapter,
          scope,
          'pilot-config-v1',
          j.enabled ? 1 : 0,
          nowIso
        );
      }
    }
  } catch {}
}
