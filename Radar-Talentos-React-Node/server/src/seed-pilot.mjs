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
    const shiftDay = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const curStart = shiftDay(-29);
    const curEnd = shiftDay(0);
    const prevStart = shiftDay(-59);
    const prevEnd = shiftDay(-30);

    const pilotTalents = [
      { id: 't-alok', name: 'Alok', mod: 'shows', subName: 'Eletrônico' },
      { id: 't-natiruts', name: 'Natiruts', mod: 'shows', subName: 'MPB' },
      { id: 't-thiaguinho', name: 'Thiaguinho', mod: 'shows', subName: 'Pagode' },
      { id: 't-jorge-mateus', name: 'Jorge & Mateus', mod: 'shows', subName: 'Sertanejo' },
      { id: 't-luan-santana', name: 'Luan Santana', mod: 'shows', subName: 'Sertanejo' },
      { id: 't-walmir-alencar', name: 'Walmir Alencar', mod: 'shows', subName: 'Gospel' },
      { id: 't-afonso-padilha', name: 'Afonso Padilha', mod: 'humor', subName: 'Stand-up' },
      { id: 't-abner-dantas', name: 'Abner Dantas', mod: 'humor', subName: 'Stand-up' },
      { id: 't-gio-lisboa', name: 'Gio Lisboa', mod: 'humor', subName: 'Stand-up' },
      { id: 't-emerson-ceara', name: 'Emerson Ceará', mod: 'humor', subName: 'Stand-up' },
      { id: 't-rodrigo-marques', name: 'Rodrigo Marques', mod: 'humor', subName: 'Stand-up' },
      { id: 't-jonathan-nemer', name: 'Jonathan Nemer', mod: 'humor', subName: 'Stand-up' },
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
      ['t-alok', 1.55, 0.78],
      ['t-jorge-mateus', 1.42, 0.80],
      ['t-luan-santana', 1.35, 0.81],
      ['t-thiaguinho', 1.22, 0.76],
      ['t-natiruts', 1.05, 0.82],
      ['t-afonso-padilha', 0.96, 0.72],
      ['t-rodrigo-marques', 0.65, 0.71],
      ['t-jonathan-nemer', 0.68, 0.74],
      ['t-gio-lisboa', 0.48, 0.62],
      ['t-emerson-ceara', 0.52, 0.75],
      ['t-palavra-cantada', 0.78, 0.73],
      ['t-leandro-karnal', 0.68, 0.68],
      ['t-walmir-alencar', 0.32, 0.56],
      ['t-abner-dantas', 0.22, 0.46],
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

    const networkCityWeights = {
      Instagram: { '4106902': 3.4, '3550308': 0.9, '5208707': 3.6, '4113700': 2.6, '4209102': 2.1 },
      YouTube: { '3550308': 1.5, '4106902': 1.9, '2611606': 2.8, '5208707': 2.4, '2927408': 1.7 },
      Spotify: { '3106200': 3.2, '3550308': 0.95, '4314902': 2.7, '4106902': 1.8, '5300108': 1.6 },
      TikTok: { '5208707': 5.8, '3550308': 0.85, '2304400': 3.1, '4106902': 1.6, '2611606': 2.2 },
    };

    const networkGrowthBoost = {
      Instagram: { '4106902': 0.56, '4113700': 0.58 },
      YouTube: { '3550308': 0.76, '2611606': 0.64 },
      Spotify: { '3106200': 0.62, '4113700': 0.57 },
      TikTok: { '5208707': 0.43, '2304400': 0.55 },
    };

    for (const cfg of mediaConfigs) {
      const cityW = networkCityWeights[cfg.network] || {};
      const growthW = networkGrowthBoost[cfg.network] || {};
      for (const [talentId, mult, prevRatio] of talentMultipliers) {
        importRegionalReport(db, {
          talent_id: talentId,
          network: cfg.network,
          metric: cfg.metric,
          period_start: prevStart,
          period_end: prevEnd,
          source: cfg.source,
          quality: cfg.quality,
          report_ref: `relatorio-${cfg.network.toLowerCase()}-${cfg.metric}-anterior`,
          authorization_ref: 'Relatório oficial autorizado',
          coverage: 'complete',
          rows: regionalCities.map(([code, base], idx) => {
            const w = cityW[code] || 1.0;
            const pRatio = growthW[code] || prevRatio;
            return {
              municipality_code: code,
              value: Math.max(100, Math.round(base * w * mult * pRatio * cfg.factor * (1 + ((idx % 4) - 1.5) * 0.06))),
            };
          }),
        });
        importRegionalReport(db, {
          talent_id: talentId,
          network: cfg.network,
          metric: cfg.metric,
          period_start: curStart,
          period_end: curEnd,
          source: cfg.source,
          quality: cfg.quality,
          report_ref: `relatorio-${cfg.network.toLowerCase()}-${cfg.metric}-atual`,
          authorization_ref: 'Relatório oficial autorizado',
          coverage: 'complete',
          rows: regionalCities.map(([code, base], idx) => {
            const w = cityW[code] || 1.0;
            return {
              municipality_code: code,
              value: Math.max(150, Math.round(base * w * mult * cfg.factor * (1 + ((idx % 4) - 1.5) * 0.07))),
            };
          }),
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
    const d14 = shiftDay(-14);
    const d21 = shiftDay(-21);
    const d30 = shiftDay(-30);
    const d45 = shiftDay(-45);
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

    const curveShapes = {
      YouTube:   [0.74, 0.81, 0.88, 1.00, 1.12, 1.19, 1.38, 1.52],
      Instagram: [0.68, 0.79, 0.91, 1.00, 1.24, 1.46, 1.63, 1.88],
      Spotify:   [0.71, 0.77, 0.89, 1.00, 1.08, 1.34, 1.58, 1.74],
      TikTok:    [0.62, 0.70, 0.83, 1.00, 1.16, 1.54, 1.92, 2.23],
    };

    const series = (b, n, factor = 1, net = 'YouTube') => {
      const shape = curveShapes[net] || curveShapes.YouTube;
      const growthRatio = n / Math.max(1, b);
      const scale = (idx) => {
        const s = shape[idx];
        if (idx <= 3) return b * s * factor;
        const t = (s - 1.0) / (shape[7] - 1.0);
        const netBoost = net === 'TikTok' ? 1.18 : net === 'Instagram' ? 1.04 : net === 'Spotify' ? 0.94 : 0.82;
        const targetNow = b * (1 + (growthRatio - 1) * netBoost);
        return (b + (targetNow - b) * t) * factor;
      };
      const days = [d90, d60, d45, d30, d21, d14, d7, d0];
      return days.map((dt, idx) => [dt, Math.max(100, Math.round(scale(idx)))]);
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
              ...series(a.base, a.now, 1.0, 'YouTube').map(([dt, val]) => ({
                metric: 'subscribers',
                observed_on: dt,
                value: val,
                source: 'YouTube Official Channel',
              })),
              ...series(a.base, a.now, 14.5, 'YouTube').map(([dt, val]) => ({
                metric: 'views',
                observed_on: dt,
                value: val,
                source: 'YouTube Official Channel',
              })),
              ...series(a.base, a.now, 0.85, 'YouTube').map(([dt, val]) => ({
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
              ...series(a.base, a.now, 1.15, 'Instagram').map(([dt, val]) => ({
                metric: 'followers',
                observed_on: dt,
                value: val,
                source: 'Instagram Insights Autorizado',
              })),
              ...series(a.base, a.now, 8.2, 'Instagram').map(([dt, val]) => ({
                metric: 'views',
                observed_on: dt,
                value: val,
                source: 'Instagram Insights Autorizado',
              })),
              ...series(a.base, a.now, 0.65, 'Instagram').map(([dt, val]) => ({
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
              ...series(a.base, a.now, 1.32, 'Spotify').map(([dt, val]) => ({
                metric: 'monthly_listeners',
                observed_on: dt,
                value: val,
                source: 'Spotify for Artists',
              })),
              ...series(a.base, a.now, 0.54, 'Spotify').map(([dt, val]) => ({
                metric: 'followers',
                observed_on: dt,
                value: val,
                source: 'Spotify for Artists',
              })),
              ...series(a.base, a.now, 18.0, 'Spotify').map(([dt, val]) => ({
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
              ...series(a.base, a.now, 1.25, 'TikTok').map(([dt, val]) => ({
                metric: 'followers',
                observed_on: dt,
                value: val,
                source: 'TikTok for Artists',
              })),
              ...series(a.base, a.now, 21.0, 'TikTok').map(([dt, val]) => ({
                metric: 'views',
                observed_on: dt,
                value: val,
                source: 'TikTok for Artists',
              })),
              ...series(a.base, a.now, 1.4, 'TikTok').map(([dt, val]) => ({
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
