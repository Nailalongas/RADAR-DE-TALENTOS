import { readFileSync } from 'node:fs';
import { importEvents } from './events.mjs';
import { importRegionalReport } from './regional-dashboard.mjs';

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

  const muniCount = db.prepare('SELECT count(*) AS n FROM municipalities').get().n;
  const assetCount = db.prepare('SELECT count(*) AS n FROM geographic_assets').get().n;

  if (muniCount === 0 || assetCount === 0) {
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
          'Localidades: 2026-11-18; malhas: 2025',
          'Malha Territorial — centro da caixa envolvente (aproximado)',
          '2025'
        );
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
        'Localidades: 2026-11-18; malhas: 2025',
        'Malha Territorial'
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  const audienceCount = db.prepare('SELECT count(*) AS n FROM regional_audience').get().n;
  if (audienceCount === 0) {
    const pilotTalents = [
      { id: 't-alok', name: 'Alok', mod: 'shows', subName: 'Eletrônico' },
      { id: 't-natiruts', name: 'Natiruts', mod: 'shows', subName: 'MPB' },
      { id: 't-thiaguinho', name: 'Thiaguinho', mod: 'shows', subName: 'Pagode' },
      { id: 't-jorge-mateus', name: 'Jorge & Mateus', mod: 'shows', subName: 'Sertanejo' },
      { id: 't-luan-santana', name: 'Luan Santana', mod: 'shows', subName: 'Sertanejo' },
      { id: 't-afonso-padilha', name: 'Afonso Padilha', mod: 'humor', subName: 'Stand-up' },
      { id: 't-leandro-karnal', name: 'Leandro Karnal', mod: 'palestras', subName: 'Liderança' },
      { id: 't-palavra-cantada', name: 'Palavra Cantada', mod: 'infantil', subName: 'Espetáculos' },
    ];

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const t of pilotTalents) {
        db.prepare('INSERT OR IGNORE INTO talents(id, name, entity_type) VALUES (?, ?, ?)').run(t.id, t.name, 'person');
        db.prepare('INSERT OR IGNORE INTO talent_modalities(talent_id, modality_id) VALUES (?, ?)').run(t.id, t.mod);
        const subRow = db.prepare('SELECT id FROM submodalities WHERE modality_id = ? AND name = ?').get(t.mod, t.subName);
        if (subRow) {
          db.prepare('INSERT OR IGNORE INTO talent_submodalities(talent_id, modality_id, submodality_id) VALUES (?, ?, ?)').run(t.id, t.mod, subRow.id);
        }
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    const regionalCities = [
      ['3550308', 485000], // São Paulo - SP (Sudeste)
      ['3509502', 94000],  // Campinas - SP (Sudeste)
      ['3543402', 68000],  // Ribeirão Preto - SP (Sudeste)
      ['3304557', 275000], // Rio de Janeiro - RJ (Sudeste)
      ['3303302', 62000],  // Niterói - RJ (Sudeste)
      ['3106200', 184000], // Belo Horizonte - MG (Sudeste)
      ['3170206', 59000],  // Uberlândia - MG (Sudeste)
      ['3205309', 54000],  // Vitória - ES (Sudeste)
      ['4106902', 162000], // Curitiba - PR (Sul)
      ['4113700', 64000],  // Londrina - PR (Sul)
      ['4115200', 56500],  // Maringá - PR (Sul)
      ['4119905', 38200],  // Ponta Grossa - PR (Sul)
      ['4104808', 34500],  // Cascavel - PR (Sul)
      ['4209102', 72300],  // Joinville - SC (Sul)
      ['4205407', 81500],  // Florianópolis - SC (Sul)
      ['4202404', 44900],  // Blumenau - SC (Sul)
      ['4314902', 128000], // Porto Alegre - RS (Sul)
      ['4305108', 42000],  // Caxias do Sul - RS (Sul)
      ['2927408', 136000], // Salvador - BA (Nordeste)
      ['2611606', 98000],  // Recife - PE (Nordeste)
      ['2304400', 112000], // Fortaleza - CE (Nordeste)
      ['2408102', 52000],  // Natal - RN (Nordeste)
      ['5300108', 125000], // Brasília - DF (Centro-Oeste)
      ['5208707', 86000],  // Goiânia - GO (Centro-Oeste)
      ['5103403', 48000],  // Cuiabá - MT (Centro-Oeste)
      ['1302603', 64000],  // Manaus - AM (Norte)
      ['1501402', 58000],  // Belém - PA (Norte)
    ];

    const talentMultipliers = [
      ['t-alok', 1.55],
      ['t-jorge-mateus', 1.42],
      ['t-luan-santana', 1.35],
      ['t-thiaguinho', 1.22],
      ['t-natiruts', 1.05],
      ['t-afonso-padilha', 0.96],
      ['t-palavra-cantada', 0.78],
      ['t-leandro-karnal', 0.68],
    ];

    const mediaConfigs = [
      { network: 'YouTube', metric: 'views', source: 'YouTube Analytics', quality: 'verified', factor: 1.0 },
      { network: 'Instagram', metric: 'views', source: 'Instagram Insights', quality: 'verified', factor: 1.35 },
      { network: 'Instagram', metric: 'reach', source: 'Instagram Insights', quality: 'verified', factor: 0.92 },
      { network: 'Instagram', metric: 'followers', source: 'Instagram Insights', quality: 'verified', factor: 0.42 },
      { network: 'Spotify', metric: 'streams', source: 'Spotify for Artists', quality: 'verified', factor: 1.65 },
      { network: 'Spotify', metric: 'listeners', source: 'Spotify for Artists', quality: 'verified', factor: 0.58 },
      { network: 'TikTok', metric: 'views', source: 'TikTok for Artists', quality: 'verified', factor: 1.9 },
      { network: 'TikTok', metric: 'reach', source: 'TikTok for Artists', quality: 'verified', factor: 1.18 },
      { network: 'TikTok', metric: 'followers', source: 'TikTok for Artists', quality: 'verified', factor: 0.48 },
    ];

    for (const cfg of mediaConfigs) {
      for (const [talentId, mult] of talentMultipliers) {
        importRegionalReport(db, {
          talent_id: talentId,
          network: cfg.network,
          metric: cfg.metric,
          period_start: '2026-10-18',
          period_end: '2026-11-17',
          source: cfg.source,
          quality: cfg.quality,
          report_ref: `relatorio-${cfg.network.toLowerCase()}-${cfg.metric}-2026-11`,
          authorization_ref: 'Relatório oficial autorizado',
          coverage: 'complete',
          rows: regionalCities.map(([code, base], idx) => ({
            municipality_code: code,
            value: Math.max(150, Math.round(base * mult * cfg.factor * (1 + ((idx % 4) - 1.5) * 0.07))),
          })),
        });
      }
    }
  }

  const eventsCount = db.prepare('SELECT count(*) AS n FROM events').get().n;
  if (eventsCount === 0) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const prevMonthStr = new Date(Date.now() - 20 * 86400000)
      .toISOString()
      .slice(0, 10);

    const batches = [
      {
        platform: 'ticketmaster',
        observed_on: todayStr,
        source: 'Ticketmaster Discovery API / Acesso autorizado',
        items: [
          {
            external_id: 'tm-cwb-natiruts',
            title: 'Show Natiruts Leve com Você em Curitiba',
            venue: 'Pedreira Paulo Leminski',
            municipality_code: '4106902',
            event_date: '2026-11-28',
            published_on: todayStr,
            modality_id: 'shows',
            artists: [{ name: 'Natiruts', id: 'tm-art-natiruts' }],
            url: 'https://www.ticketmaster.com.br/event/natiruts-curitiba',
          },
          {
            external_id: 'tm-sp-natiruts',
            title: 'Show Natiruts Leve com Você em São Paulo',
            venue: 'Allianz Parque',
            municipality_code: '3550308',
            event_date: '2026-12-05',
            published_on: todayStr,
            modality_id: 'shows',
            artists: [{ name: 'Natiruts', id: 'tm-art-natiruts' }],
            url: 'https://www.ticketmaster.com.br/event/natiruts-sp',
          },
          {
            external_id: 'tm-poa-natiruts',
            title: 'Show Natiruts Leve com Você em Porto Alegre',
            venue: 'Auditório Araújo Vianna',
            municipality_code: '4314902',
            event_date: '2026-12-12',
            published_on: todayStr,
            modality_id: 'shows',
            artists: [{ name: 'Natiruts', id: 'tm-art-natiruts' }],
            url: 'https://www.ticketmaster.com.br/event/natiruts-poa',
          },
          {
            external_id: 'tm-sp-alok',
            title: 'Show Alok Aurea Tour São Paulo',
            venue: 'Allianz Parque',
            municipality_code: '3550308',
            event_date: '2026-12-19',
            published_on: todayStr,
            modality_id: 'shows',
            artists: [{ name: 'Alok', id: 'tm-art-alok' }],
            url: 'https://www.ticketmaster.com.br/event/alok-sp',
          },
          {
            external_id: 'tm-bh-alok',
            title: 'Show Alok Aurea Tour Belo Horizonte',
            venue: 'Mineirão',
            municipality_code: '3106200',
            event_date: '2026-12-26',
            published_on: todayStr,
            modality_id: 'shows',
            artists: [{ name: 'Alok', id: 'tm-art-alok' }],
            url: 'https://www.ticketmaster.com.br/event/alok-bh',
          },
          {
            external_id: 'tm-bsb-alok',
            title: 'Show Alok Aurea Tour Brasília',
            venue: 'Arena BRB Mané Garrincha',
            municipality_code: '5300108',
            event_date: '2026-12-28',
            published_on: todayStr,
            modality_id: 'shows',
            artists: [{ name: 'Alok', id: 'tm-art-alok' }],
            url: 'https://www.ticketmaster.com.br/event/alok-bsb',
          },
          {
            external_id: 'tm-gyn-jm',
            title: 'Show Sertanejo Jorge & Mateus Único Goiânia',
            venue: 'Estádio Serra Dourada',
            municipality_code: '5208707',
            event_date: '2026-12-15',
            published_on: todayStr,
            modality_id: 'shows',
            artists: [{ name: 'Jorge & Mateus', id: 'tm-art-jm' }],
            url: 'https://www.ticketmaster.com.br/event/jorge-mateus-goiania',
          },
        ],
      },
      {
        platform: 'eventim',
        observed_on: todayStr,
        source: 'Catálogo autorizado Eventim',
        items: [
          {
            external_id: 'evt-sp-jm',
            title: 'Show Sertanejo Jorge & Mateus Único São Paulo',
            venue: 'Arena Anhembi',
            municipality_code: '3550308',
            event_date: '2026-12-20',
            published_on: todayStr,
            modality_id: 'shows',
            artists: ['Jorge & Mateus'],
            url: 'https://www.eventim.com.br/evento/jorge-mateus-sp',
          },
          {
            external_id: 'evt-cwb-luan',
            title: 'Show Sertanejo Luan Santana City 2.0 Curitiba',
            venue: 'Expotrade Pinhais Arena',
            municipality_code: '4106902',
            event_date: '2026-12-18',
            published_on: todayStr,
            modality_id: 'shows',
            artists: ['Luan Santana'],
            url: 'https://www.eventim.com.br/evento/luan-curitiba',
          },
          {
            external_id: 'evt-rj-musical',
            title: 'Teatro Musical O Fantasma da Ópera Rio de Janeiro',
            venue: 'Theatro Municipal',
            municipality_code: '3304557',
            event_date: '2026-12-11',
            published_on: todayStr,
            modality_id: 'teatro',
            url: 'https://www.eventim.com.br/evento/fantasma-opera-rj',
          },
        ],
      },
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
            artists: ['Natiruts'],
            url: 'https://www.diskingressos.com.br/evento/natiruts-curitiba',
          },
          {
            external_id: 'dsk-cwb-afonso',
            title: 'Afonso Padilha Stand up Ninguém Tá Puro Curitiba',
            venue: 'Teatro Positivo',
            municipality_code: '4106902',
            event_date: '2026-11-22',
            published_on: todayStr,
            modality_id: 'humor',
            artists: ['Afonso Padilha'],
            url: 'https://www.diskingressos.com.br/evento/afonso-padilha',
          },
          {
            external_id: 'dsk-jlle-afonso',
            title: 'Afonso Padilha Stand up Joinville',
            venue: 'Teatro Juarez Machado',
            municipality_code: '4209102',
            event_date: '2026-11-29',
            published_on: todayStr,
            modality_id: 'humor',
            artists: ['Afonso Padilha'],
            url: 'https://www.diskingressos.com.br/evento/afonso-joinville',
          },
          {
            external_id: 'dsk-pg-standup',
            title: 'Afonso Padilha Stand up Ponta Grossa',
            venue: 'Cine Teatro Ópera',
            municipality_code: '4119905',
            event_date: '2026-12-05',
            published_on: todayStr,
            modality_id: 'humor',
            artists: ['Afonso Padilha'],
            url: 'https://www.diskingressos.com.br/evento/standup-pg',
          },
          {
            external_id: 'dsk-lda-standup',
            title: 'Afonso Padilha Stand up Londrina',
            venue: 'Teatro Ouro Verde',
            municipality_code: '4113700',
            event_date: '2026-12-07',
            published_on: todayStr,
            modality_id: 'humor',
            artists: ['Afonso Padilha'],
            url: 'https://www.diskingressos.com.br/evento/standup-londrina',
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
          {
            external_id: 'tsp-for-corrida',
            title: 'Corrida de Rua Beira Mar 10km Fortaleza',
            venue: 'Avenida Beira Mar',
            municipality_code: '2304400',
            event_date: '2026-12-14',
            published_on: todayStr,
            modality_id: 'corridas',
            url: 'https://www.ticketsports.com.br/e/corrida-fortaleza',
          },
          {
            external_id: 'tsp-sp-corrida',
            title: 'Corrida de Rua Internacional de São Silvestre 15km',
            venue: 'Avenida Paulista',
            municipality_code: '3550308',
            event_date: '2026-12-31',
            published_on: todayStr,
            modality_id: 'corridas',
            url: 'https://www.ticketsports.com.br/e/sao-silvestre-sp',
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
            title: 'Palestra Leandro Karnal Liderança e Futuro Porto Alegre',
            venue: 'Auditório Araújo Vianna',
            municipality_code: '4314902',
            event_date: '2026-11-26',
            published_on: todayStr,
            modality_id: 'palestras',
            artists: ['Leandro Karnal'],
            url: 'https://www.sympla.com.br/evento/karnal-poa',
          },
          {
            external_id: 'sym-cwb-karnal',
            title: 'Palestra Leandro Karnal Liderança em Curitiba',
            venue: 'Teatro Guaíra',
            municipality_code: '4106902',
            event_date: '2026-12-03',
            published_on: todayStr,
            modality_id: 'palestras',
            artists: ['Leandro Karnal'],
            url: 'https://www.sympla.com.br/evento/karnal-curitiba',
          },
          {
            external_id: 'sym-rec-karnal',
            title: 'Palestra Leandro Karnal Liderança em Recife',
            venue: 'Teatro Guararapes',
            municipality_code: '2611606',
            event_date: '2026-12-10',
            published_on: todayStr,
            modality_id: 'palestras',
            artists: ['Leandro Karnal'],
            url: 'https://www.sympla.com.br/evento/karnal-recife',
          },
          {
            external_id: 'sym-sp-karnal',
            title: 'Congresso de Tecnologia e Liderança São Paulo',
            venue: 'WTC Events Center',
            municipality_code: '3550308',
            event_date: '2026-12-16',
            published_on: todayStr,
            modality_id: 'palestras',
            artists: ['Leandro Karnal'],
            url: 'https://www.sympla.com.br/evento/karnal-sp',
          },
          {
            external_id: 'sym-bh-gastro',
            title: 'Festival de Gastronomia Mineira e Degustação de Vinho',
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
            title: 'Show Pagode Tardezinha Thiaguinho Rio de Janeiro',
            venue: 'Parque Olímpico',
            municipality_code: '3304557',
            event_date: '2026-12-19',
            published_on: todayStr,
            modality_id: 'shows',
            artists: ['Thiaguinho'],
            url: 'https://www.ingresse.com/tardezinha-rj',
          },
          {
            external_id: 'ing-fln-thiaguinho',
            title: 'Show Pagode Thiaguinho Tardezinha Florianópolis',
            venue: 'Stage Music Park',
            municipality_code: '4205407',
            event_date: '2026-12-27',
            published_on: todayStr,
            modality_id: 'shows',
            artists: ['Thiaguinho'],
            url: 'https://www.ingresse.com/tardezinha-fln',
          },
          {
            external_id: 'ing-ssa-thiaguinho',
            title: 'Show Pagode Thiaguinho Tardezinha Salvador',
            venue: 'Arena Fonte Nova',
            municipality_code: '2927408',
            event_date: '2026-12-21',
            published_on: todayStr,
            modality_id: 'shows',
            artists: ['Thiaguinho'],
            url: 'https://www.ingresse.com/tardezinha-ssa',
          },
          {
            external_id: 'ing-bel-festival',
            title: 'Festival Amazônico de Música em Belém',
            venue: 'Espaço Náutico Marine Club',
            municipality_code: '1501402',
            event_date: '2026-12-22',
            published_on: todayStr,
            modality_id: 'festivais',
            artists: ['Alok', 'Natiruts'],
            url: 'https://www.ingresse.com/festival-belem',
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
            title: 'Espetáculo Infantil Palavra Cantada 30 Anos São Paulo',
            venue: 'Teatro Bradesco',
            municipality_code: '3550308',
            event_date: '2026-11-30',
            published_on: todayStr,
            modality_id: 'infantil',
            artists: ['Palavra Cantada'],
            url: 'https://uhuu.com/evento/palavra-cantada-sp',
          },
          {
            external_id: 'uhuu-cwb-infantil',
            title: 'Espetáculo Infantil Palavra Cantada Curitiba',
            venue: 'Teatro Guaíra',
            municipality_code: '4106902',
            event_date: '2026-12-06',
            published_on: todayStr,
            modality_id: 'infantil',
            artists: ['Palavra Cantada'],
            url: 'https://uhuu.com/evento/palavra-cantada-cwb',
          },
          {
            external_id: 'uhuu-man-teatro',
            title: 'Teatro Musical Clássico no Teatro Amazonas Manaus',
            venue: 'Teatro Amazonas',
            municipality_code: '1302603',
            event_date: '2026-12-08',
            published_on: todayStr,
            modality_id: 'teatro',
            artists: ['Palavra Cantada'],
            url: 'https://uhuu.com/evento/teatro-amazonas',
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
            artists: ['Natiruts'],
            url: 'https://www.blueticket.com.br/evento/rock-fln',
          },
        ],
      },
    ];

    for (const batch of batches) {
      importEvents(db, batch);
    }
  }

  try {
    const opsExamplePath = new URL(
      '../../config/operations.example.json',
      import.meta.url
    );
    const opsConfig = JSON.parse(readFileSync(opsExamplePath, 'utf8'));
    const nowIso = new Date().toISOString();
    const insertJob = db.prepare(
      `INSERT OR IGNORE INTO operation_jobs(
         id, kind, provider, adapter, scope, config_hash, enabled, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const j of opsConfig.jobs || []) {
      const scope =
        j.adapter === 'ticketmaster'
          ? 'Discovery Brasil / páginas retornadas'
          : j.adapter === 'sympla'
            ? 'Eventos públicos do produtor autorizado'
            : j.adapter === 'ingresse'
              ? 'Eventos públicos da organização autorizada'
              : j.kind === 'alerts'
                ? 'Alertas internos dos recortes configurados'
                : j.scope || 'Feed autorizado / escopo configurável';
      insertJob.run(
        j.id,
        j.kind,
        j.provider,
        j.adapter,
        scope,
        'seed-' + j.id,
        j.enabled ? 1 : 0,
        nowIso
      );
    }
  } catch {
    // Optional operation_jobs seed
  }
}
