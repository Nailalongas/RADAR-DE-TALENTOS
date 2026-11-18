import { readFileSync } from 'node:fs';
import { importEvents } from './events.mjs';
import { importRegionalReport } from './regional-dashboard.mjs';
import { importCommercial } from './commercial.mjs';

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
    const observedMunisPath = new URL(
      '../../samples/observed/municipalities.json',
      import.meta.url
    );

    const rawMunicipios = JSON.parse(readFileSync(municipiosPath, 'utf8'));
    const rawStates = JSON.parse(readFileSync(malhaPath, 'utf8'));
    const observedMunis = JSON.parse(readFileSync(observedMunisPath, 'utf8'));

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
           source = excluded.source,
           version = excluded.version,
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

      for (const m of observedMunis.items || []) {
        insertMuni.run(
          m.code,
          m.name,
          m.uf,
          m.region,
          m.lat,
          m.lon,
          observedMunis.source,
          observedMunis.version,
          observedMunis.coordinate_source,
          observedMunis.coordinate_version
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
      ['4100400', 22000],  // Almirante Tamandaré - PR (Sul)
      ['4101804', 28000],  // Araucária - PR (Sul)
      ['4104204', 29500],  // Campo Largo - PR (Sul)
      ['4105805', 34000],  // Colombo - PR (Sul)
      ['4107652', 24000],  // Fazenda Rio Grande - PR (Sul)
      ['4119152', 31000],  // Pinhais - PR (Sul)
      ['4119509', 21500],  // Piraquara - PR (Sul)
      ['4125506', 46000],  // São José dos Pinhais - PR (Sul)
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
    for (const name of ['sympla', 'eventim', 'ticketsports', 'ticket360']) {
      const batchPath = new URL(
        `../../samples/observed/${name}.json`,
        import.meta.url
      );
      const batch = JSON.parse(readFileSync(batchPath, 'utf8'));
      importEvents(db, batch);
    }
  }

  const commercialCount = db.prepare('SELECT count(*) AS n FROM commercial_snapshots').get().n;
  if (commercialCount === 0) {
    const shiftDay = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const d0 = shiftDay(0);
    const d7 = shiftDay(-7);
    const d15 = shiftDay(-15);
    const d30 = shiftDay(-30);
    const d60 = shiftDay(-60);
    const d90 = shiftDay(-90);

    const commercialArtists = [
      { id: 't-abner-dantas', name: 'Abner Dantas', modalities: ['humor'], base: 3500, now: 7800, slug: 'abnerdantas' },
      { id: 't-walmir-alencar', name: 'Walmir Alencar', modalities: ['shows'], base: 8000, now: 14500, slug: 'walmiralencar' },
      { id: 't-gio-lisboa', name: 'Gio Lisboa', modalities: ['humor'], base: 32000, now: 51000, slug: 'giolisboa' },
      { id: 't-emerson-ceara', name: 'Emerson Ceará', modalities: ['humor'], base: 42000, now: 53000, slug: 'emersonceara' },
      { id: 't-rodrigo-marques', name: 'Rodrigo Marques', modalities: ['humor'], base: 64000, now: 88000, slug: 'rodrigomarques' },
      { id: 't-jonathan-nemer', name: 'Jonathan Nemer', modalities: ['humor'], base: 72000, now: 94000, slug: 'jonathannemer' },
      { id: 't-afonso-padilha', name: 'Afonso Padilha', modalities: ['humor'], base: 210000, now: 285000, slug: 'afonsopadilha' },
      { id: 't-thiaguinho', name: 'Thiaguinho', modalities: ['shows'], base: 450000, now: 560000, slug: 'thiaguinho' },
      { id: 't-natiruts', name: 'Natiruts', modalities: ['shows'], base: 380000, now: 445000, slug: 'natiruts' },
      { id: 't-luan-santana', name: 'Luan Santana', modalities: ['shows'], base: 820000, now: 950000, slug: 'luansantana' },
      { id: 't-jorge-mateus', name: 'Jorge & Mateus', modalities: ['shows'], base: 910000, now: 1040000, slug: 'jorgeemateus' },
      { id: 't-alok', name: 'Alok', modalities: ['shows'], base: 1200000, now: 1380000, slug: 'alok' },
      { id: 't-leandro-karnal', name: 'Leandro Karnal', modalities: ['palestras'], base: 5400, now: 9200, slug: 'leandrokarnal' },
      { id: 't-palavra-cantada', name: 'Palavra Cantada', modalities: ['infantil'], base: 28000, now: 41500, slug: 'palavracantada' },
    ];

    const series = (b, n, factor = 1) => {
      const v90 = Math.max(100, Math.round(b * 0.72 * factor));
      const v60 = Math.max(100, Math.round(b * 0.86 * factor));
      const v30 = Math.max(100, Math.round(b * factor));
      const v15 = Math.max(100, Math.round((b + (n - b) * 0.48) * factor));
      const v7 = Math.max(100, Math.round((b + (n - b) * 0.76) * factor));
      const v0 = Math.max(100, Math.round(n * factor));
      return [
        [d90, v90],
        [d60, v60],
        [d30, v30],
        [d15, v15],
        [d7, v7],
        [d0, v0],
      ];
    };

    const batch = {
      authorization_ref: 'Monitoramento comercial autorizado Radar de Talentos',
      artists: commercialArtists.map((a) => ({
        id: a.id,
        name: a.name,
        modalities: a.modalities,
        accounts: [
          {
            id: `${a.id}-yt`,
            network: 'YouTube',
            url: `https://www.youtube.com/@${a.slug}`,
            identity_source: 'Canal oficial verificado',
            snapshots: [
              ...series(a.base, a.now, 1.0).map(([dt, val]) => ({
                metric: 'subscribers',
                observed_on: dt,
                value: val,
                source: 'YouTube Official Channel',
              })),
              ...series(a.base, a.now, 14.5).map(([dt, val]) => ({
                metric: 'views',
                observed_on: dt,
                value: val,
                source: 'YouTube Official Channel',
              })),
              ...series(a.base, a.now, 0.85).map(([dt, val]) => ({
                metric: 'likes',
                observed_on: dt,
                value: val,
                source: 'YouTube Official Channel',
              })),
            ],
          },
          {
            id: `${a.id}-ig`,
            network: 'Instagram',
            url: `https://www.instagram.com/${a.slug}`,
            identity_source: 'Perfil oficial verificado',
            snapshots: [
              ...series(a.base, a.now, 1.15).map(([dt, val]) => ({
                metric: 'followers',
                observed_on: dt,
                value: val,
                source: 'Instagram Insights Autorizado',
              })),
              ...series(a.base, a.now, 8.2).map(([dt, val]) => ({
                metric: 'views',
                observed_on: dt,
                value: val,
                source: 'Instagram Insights Autorizado',
              })),
              ...series(a.base, a.now, 0.65).map(([dt, val]) => ({
                metric: 'likes',
                observed_on: dt,
                value: val,
                source: 'Instagram Insights Autorizado',
              })),
            ],
          },
          {
            id: `${a.id}-sp`,
            network: 'Spotify',
            url: `https://open.spotify.com/artist/${a.slug}`,
            identity_source: 'Perfil de artista verificado',
            snapshots: [
              ...series(a.base, a.now, 0.92).map(([dt, val]) => ({
                metric: 'monthly_listeners',
                observed_on: dt,
                value: val,
                source: 'Spotify for Artists',
              })),
              ...series(a.base, a.now, 0.54).map(([dt, val]) => ({
                metric: 'followers',
                observed_on: dt,
                value: val,
                source: 'Spotify for Artists',
              })),
              ...series(a.base, a.now, 18.0).map(([dt, val]) => ({
                metric: 'streams',
                observed_on: dt,
                value: val,
                source: 'Spotify for Artists',
              })),
            ],
          },
          {
            id: `${a.id}-tk`,
            network: 'TikTok',
            url: `https://www.tiktok.com/@${a.slug}`,
            identity_source: 'Conta oficial verificada',
            snapshots: [
              ...series(a.base, a.now, 1.25).map(([dt, val]) => ({
                metric: 'followers',
                observed_on: dt,
                value: val,
                source: 'TikTok for Artists',
              })),
              ...series(a.base, a.now, 21.0).map(([dt, val]) => ({
                metric: 'views',
                observed_on: dt,
                value: val,
                source: 'TikTok for Artists',
              })),
              ...series(a.base, a.now, 1.4).map(([dt, val]) => ({
                metric: 'likes',
                observed_on: dt,
                value: val,
                source: 'TikTok for Artists',
              })),
            ],
          },
        ],
      })),
    };

    importCommercial(db, batch, { day: d0 });
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
