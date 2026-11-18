import { readFileSync } from 'node:fs';
import { importEvents } from './events.mjs';
import { importCoverage } from './opportunities.mjs';

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
      'Localidades: 2026-11-17; malhas: 2025',
      'Malha Territorial'
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const prevMonthStr = new Date(Date.now() - 35 * 86400000)
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
          title: 'Afonso Padilha Stand up Ninguém Tá Puro',
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
          modality_id: 'shows',
          artists: ['Thiaguinho'],
          url: 'https://www.ingresse.com/tardezinha-rj',
        },
        {
          external_id: 'ing-fln-thiaguinho',
          title: 'Show Thiaguinho Tardezinha Florianópolis',
          venue: 'Stage Music Park',
          municipality_code: '4205407',
          event_date: '2026-12-27',
          published_on: todayStr,
          modality_id: 'shows',
          artists: ['Thiaguinho'],
          url: 'https://www.ingresse.com/tardezinha-fln',
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
          artists: ['Palavra Cantada'],
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
          artists: ['Natiruts'],
          url: 'https://www.blueticket.com.br/evento/rock-fln',
        },
      ],
    },
  ];

  for (const batch of batches) {
    importEvents(db, batch);
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
