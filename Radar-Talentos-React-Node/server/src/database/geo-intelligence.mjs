import { randomUUID } from 'node:crypto';
import {
  BRAZIL_REGIONS,
  EVENT_MODALITIES,
  TICKETING_SOURCES,
  UF_TO_REGION,
  canonicalEventKey,
  classifyEventModality,
  computeOpportunitiesMatrix,
  filterMunicipalitiesByGeo,
} from '../../../src/domain/geo-intelligence.js';
import { normalizeName } from '../../../src/domain/research.js';

const VALID_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !VALID_DATE_RE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return false;
  return new Date(parsed).toISOString().slice(0, 10) === value;
}

export function queryGeoRegions(db) {
  if (!db) return { regions: BRAZIL_REGIONS };
  const regions = db
    .prepare('SELECT code, name FROM geo_regions ORDER BY code')
    .all();
  const states = db
    .prepare('SELECT uf, region_code FROM geo_states ORDER BY uf')
    .all();
  return {
    regions: regions.map(r => ({
      code: r.code,
      name: r.name,
      ufs: states.filter(s => s.region_code === r.code).map(s => s.uf),
    })),
  };
}

export function queryGeoStates(db, { region = '' } = {}) {
  if (!db) return { states: [] };
  const rows =
    region && region !== 'all'
      ? db
          .prepare(
            'SELECT uf, ibge_code, name, region_code, latitude, longitude FROM geo_states WHERE region_code = ? ORDER BY uf'
          )
          .all(region)
      : db
          .prepare(
            'SELECT uf, ibge_code, name, region_code, latitude, longitude FROM geo_states ORDER BY uf'
          )
          .all();
  return { states: rows };
}

export function queryGeoMunicipalities(
  db,
  {
    search = '',
    uf = '',
    region = '',
    centerMunicipalityId = '',
    radiusKm = null,
  } = {}
) {
  if (!db) {
    return {
      center: null,
      radiusKm: null,
      municipalities: [],
      sourceVersion: 'IBGE Censo 2022',
    };
  }
  const all = db
    .prepare(
      `SELECT m.ibge_code, m.name, m.uf, s.region_code, m.latitude, m.longitude,
              m.population, m.gdp_per_capita, m.source_version
       FROM geo_municipalities m
       JOIN geo_states s ON s.uf = m.uf
       ORDER BY m.name ASC, m.uf ASC`
    )
    .all();

  const filtered = filterMunicipalitiesByGeo(all, {
    region,
    uf,
    centerMunicipalityId,
    radiusKm,
    search,
  });

  return {
    ...filtered,
    totalInBase: all.length,
    sourceVersion: all[0]?.source_version || 'IBGE Censo 2022',
  };
}

export function queryModalities(db) {
  if (!db) return { modalities: EVENT_MODALITIES };
  const mods = db
    .prepare(
      'SELECT id, name, active, sort_order FROM event_modalities WHERE active = 1 ORDER BY sort_order ASC, name ASC'
    )
    .all();
  const subs = db
    .prepare(
      'SELECT id, modality_id, name, active FROM event_submodalities WHERE active = 1 ORDER BY id ASC'
    )
    .all();
  return {
    modalities: mods.map(m => ({
      id: m.id,
      name: m.name,
      submodalities: subs
        .filter(s => s.modality_id === m.id)
        .map(s => ({ id: s.id, name: s.name })),
    })),
  };
}

export function importRegionalAudience(db, { rows = [] } = {}) {
  if (!db) throw new Error('Banco de dados indisponível.');
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000) {
    throw new Error('Envie entre 1 e 2.000 registros de audiência regional.');
  }

  const allowedMetrics = {
    Instagram: ['seguidores', 'alcance', 'visualizacoes'],
    YouTube: ['visualizacoes', 'minutos_assistidos', 'seguidores'],
    Spotify: ['ouvintes', 'reproducoes'],
  };

  let imported = 0;
  let updated = 0;
  const rejected = [];

  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const lineNum = i + 1;
      const platform = String(r.platform || r.rede || '').trim();
      const metric = String(r.metric || r.metrica || '')
        .trim()
        .toLowerCase();
      const granularity = String(r.granularity || 'municipality').trim();
      const ibgeCode = r.ibgeCode || r.ibge ? String(r.ibgeCode || r.ibge).trim() : null;
      const territoryKey = String(
        r.territoryKey || (granularity === 'municipality' ? ibgeCode : r.uf || 'BR') || ''
      ).trim();
      const periodStart = String(r.periodStart || r.inicio || '').trim();
      const periodEnd = String(r.periodEnd || r.fim || '').trim();
      const value = Number(r.value ?? r.valor);
      const provenance = String(r.provenance || 'verificado').trim();
      const confidence = String(r.confidence || 'alta').trim();
      const source = String(r.source || r.fonte || '').trim();
      const unit = String(r.unit || metric).trim();
      const reportReference = r.reportReference ? String(r.reportReference).trim() : null;

      if (
        !allowedMetrics[platform] ||
        !allowedMetrics[platform].includes(metric) ||
        !['country', 'region', 'state', 'municipality'].includes(granularity) ||
        (granularity === 'municipality' && !/^\d{7}$/.test(ibgeCode || '')) ||
        !isValidIsoDate(periodStart) ||
        !isValidIsoDate(periodEnd) ||
        periodStart > periodEnd ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        !['verificado', 'estimado', 'demonstracao'].includes(provenance) ||
        !source
      ) {
        rejected.push({
          line: lineNum,
          reason:
            'Campos inválidos (verifique plataforma, métrica, código IBGE de 7 dígitos, datas YYYY-MM-DD, valor inteiro >= 0 e fonte).',
        });
        continue;
      }

      if (granularity === 'municipality') {
        const cityExists = db
          .prepare('SELECT 1 FROM geo_municipalities WHERE ibge_code = ?')
          .get(ibgeCode);
        if (!cityExists) {
          rejected.push({
            line: lineNum,
            reason: `Código IBGE não encontrado na base nacional: ${ibgeCode}`,
          });
          continue;
        }
      }

      // Resolve or create talent
      let talentId = r.talentId ? String(r.talentId).trim() : '';
      const talentName = String(r.talentName || r.nome || '').trim();
      if (talentId) {
        const existingTalent = db
          .prepare('SELECT id FROM talents WHERE id = ?')
          .get(talentId);
        if (!existingTalent && talentName) {
          db.prepare('INSERT INTO talents(id, name) VALUES (?, ?)').run(
            talentId,
            talentName
          );
        } else if (!existingTalent) {
          rejected.push({
            line: lineNum,
            reason: `Talento não encontrado para talentId=${talentId}`,
          });
          continue;
        }
      } else if (talentName) {
        const byName = db
          .prepare('SELECT id FROM talents WHERE lower(name) = lower(?)')
          .get(talentName);
        if (byName) {
          talentId = byName.id;
        } else {
          talentId = `talent-${normalizeName(talentName).replace(/\s+/g, '-')}`;
          db.prepare(
            'INSERT OR IGNORE INTO talents(id, name) VALUES (?, ?)'
          ).run(talentId, talentName);
        }
      } else {
        rejected.push({
          line: lineNum,
          reason: 'Informe talentId ou talentName.',
        });
        continue;
      }

      const existingSnap = db
        .prepare(
          `SELECT id FROM audience_geo_snapshots
           WHERE talent_id = ? AND platform = ? AND metric = ?
             AND granularity = ? AND territory_key = ?
             AND period_start = ? AND period_end = ? AND source = ?`
        )
        .get(
          talentId,
          platform,
          metric,
          granularity,
          territoryKey,
          periodStart,
          periodEnd,
          source
        );

      if (existingSnap) {
        db.prepare(
          `UPDATE audience_geo_snapshots
           SET value = ?, provenance = ?, confidence = ?, report_reference = ?, collected_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
           WHERE id = ?`
        ).run(value, provenance, confidence, reportReference, existingSnap.id);
        updated++;
      } else {
        db.prepare(
          `INSERT INTO audience_geo_snapshots(
             talent_id, platform, metric, unit, granularity, territory_key, ibge_code,
             period_start, period_end, value, provenance, confidence, source, report_reference
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          talentId,
          platform,
          metric,
          unit,
          granularity,
          territoryKey,
          ibgeCode,
          periodStart,
          periodEnd,
          value,
          provenance,
          confidence,
          source,
          reportReference
        );
        imported++;
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    imported,
    updated,
    rejectedCount: rejected.length,
    rejected,
    totalProcessed: imported + updated,
  };
}

export function queryAudienceMapAndDistribution(
  db,
  {
    talentId = '',
    talentName = '',
    platform = 'all',
    metric = '',
    region = '',
    uf = '',
    centerMunicipalityId = '',
    radiusKm = null,
    provenance = 'all',
    perCapita = false,
  } = {}
) {
  if (!db) {
    return {
      items: [],
      byRegion: [],
      byState: [],
      totalKnownAudience: 0,
      coverageNotice: 'Banco de dados indisponível.',
    };
  }

  const geoFilter = queryGeoMunicipalities(db, {
    region,
    uf,
    centerMunicipalityId,
    radiusKm,
  });
  const allowedIbge = new Map(
    geoFilter.municipalities.map(m => [m.ibge_code, m])
  );

  let sql = `
    SELECT ags.*, t.name AS talent_name
    FROM audience_geo_snapshots ags
    JOIN talents t ON t.id = ags.talent_id
    WHERE t.blocked = 0
  `;
  const params = [];

  if (talentId) {
    sql += ' AND ags.talent_id = ?';
    params.push(talentId);
  } else if (talentName) {
    sql += ' AND lower(t.name) LIKE ?';
    params.push(`%${talentName.trim().toLowerCase()}%`);
  }
  if (platform && platform !== 'all') {
    sql += ' AND ags.platform = ?';
    params.push(platform);
  }
  if (metric && metric !== 'all') {
    sql += ' AND ags.metric = ?';
    params.push(metric);
  }
  if (provenance && provenance !== 'all') {
    sql += ' AND ags.provenance = ?';
    params.push(provenance);
  } else {
    sql += " AND ags.provenance != 'demonstracao'";
  }

  sql += ' ORDER BY ags.period_end DESC, ags.value DESC';
  const rawRows = db.prepare(sql).all(...params);

  const nationalOnlyRows = rawRows.filter(r => r.granularity === 'country');
  const muniRows = rawRows.filter(
    r => r.granularity === 'municipality' && allowedIbge.has(r.ibge_code)
  );

  // Deduplicate latest period per (talent_id, platform, metric, ibge_code)
  const latestByCell = new Map();
  for (const row of muniRows) {
    const key = `${row.talent_id}|${row.platform}|${row.metric}|${row.ibge_code}`;
    const prev = latestByCell.get(key);
    if (!prev || row.period_end > prev.period_end) {
      latestByCell.set(key, row);
    }
  }

  const dedupedRows = [...latestByCell.values()];

  // Group by municipality AND platform/metric so we never sum incompatible metrics!
  const byMunicipality = new Map();
  for (const row of dedupedRows) {
    const city = allowedIbge.get(row.ibge_code);
    if (!city) continue;
    const key = `${row.ibge_code}|${row.platform}|${row.metric}`;
    const entry = byMunicipality.get(key) || {
      ibgeCode: row.ibge_code,
      cityName: city.name,
      uf: city.uf,
      regionCode: city.region_code,
      latitude: city.latitude,
      longitude: city.longitude,
      population: city.population,
      distanceKm: city.distanceKm,
      platform: row.platform,
      metric: row.metric,
      unit: row.unit,
      value: 0,
      provenance: row.provenance,
      confidence: row.confidence,
      source: row.source,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    };
    entry.value += row.value;
    byMunicipality.set(key, entry);
  }

  const items = [...byMunicipality.values()].map(item => ({
    ...item,
    per100kInhabitants:
      item.population > 0
        ? Number(((item.value / item.population) * 100000).toFixed(1))
        : null,
  }));

  items.sort((a, b) =>
    perCapita
      ? (b.per100kInhabitants || 0) - (a.per100kInhabitants || 0)
      : b.value - a.value
  );

  // Regional distribution per platform+metric (never mixing platforms in one sum)
  const totalsByPlatformMetric = new Map();
  for (const item of items) {
    const pmKey = `${item.platform}|${item.metric}`;
    totalsByPlatformMetric.set(
      pmKey,
      (totalsByPlatformMetric.get(pmKey) || 0) + item.value
    );
  }

  const itemsWithShare = items.map(item => {
    const denom = totalsByPlatformMetric.get(`${item.platform}|${item.metric}`) || 0;
    return {
      ...item,
      shareOfKnownAudiencePct:
        denom > 0 ? Number(((item.value / denom) * 100).toFixed(2)) : 0,
    };
  });

  const byRegionMap = new Map();
  const byStateMap = new Map();

  for (const item of itemsWithShare) {
    const regKey = `${item.regionCode}|${item.platform}|${item.metric}`;
    const regEntry = byRegionMap.get(regKey) || {
      regionCode: item.regionCode,
      regionName:
        BRAZIL_REGIONS.find(r => r.code === item.regionCode)?.name ||
        item.regionCode,
      platform: item.platform,
      metric: item.metric,
      value: 0,
      municipalitiesCount: 0,
    };
    regEntry.value += item.value;
    regEntry.municipalitiesCount += 1;
    byRegionMap.set(regKey, regEntry);

    const ufKey = `${item.uf}|${item.platform}|${item.metric}`;
    const ufEntry = byStateMap.get(ufKey) || {
      uf: item.uf,
      regionCode: item.regionCode,
      platform: item.platform,
      metric: item.metric,
      value: 0,
      municipalitiesCount: 0,
    };
    ufEntry.value += item.value;
    ufEntry.municipalitiesCount += 1;
    byStateMap.set(ufKey, ufEntry);
  }

  const byRegion = [...byRegionMap.values()].map(r => {
    const denom = totalsByPlatformMetric.get(`${r.platform}|${r.metric}`) || 0;
    return {
      ...r,
      sharePct: denom > 0 ? Number(((r.value / denom) * 100).toFixed(1)) : 0,
    };
  });

  const byState = [...byStateMap.values()].map(s => {
    const denom = totalsByPlatformMetric.get(`${s.platform}|${s.metric}`) || 0;
    return {
      ...s,
      sharePct: denom > 0 ? Number(((s.value / denom) * 100).toFixed(1)) : 0,
    };
  });

  let coverageNotice =
    itemsWithShare.length > 0
      ? `Exibindo ${itemsWithShare.length} registro(s) municipais verificados/estimados. Percentuais calculados sobre a audiência conhecida no recorte, sem presumir cobertura integral do país.`
      : nationalOnlyRows.length > 0
        ? 'Há apenas dados nacionais para esta seleção. O filtro municipal/raio em km não pode ser calculado sem relatório por cidade.'
        : 'Nenhum relatório de audiência municipal importado para estes filtros. Importe um relatório CSV/JSON autorizado para visualizar a distribuição regional.';

  return {
    filters: {
      talentId,
      talentName,
      platform,
      metric,
      region,
      uf,
      centerMunicipalityId,
      radiusKm: geoFilter.radiusKm,
      centerMunicipality: geoFilter.center,
    },
    municipalitiesInGeoFilter: geoFilter.municipalities.length,
    items: itemsWithShare,
    byRegion,
    byState,
    coverageNotice,
    updatedAt: new Date().toISOString(),
  };
}

export function importEventsBatch(
  db,
  { rows = [], isInitialInventory = false } = {}
) {
  if (!db) throw new Error('Banco de dados indisponível.');
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000) {
    throw new Error('Envie entre 1 e 2.000 anúncios de eventos.');
  }

  let createdEvents = 0;
  let mergedDuplicates = 0;
  let updatedListings = 0;
  const rejected = [];

  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const lineNum = i + 1;
      const sourceId = String(r.sourceId || r.plataforma || '')
        .trim()
        .toLowerCase();
      const externalId = String(r.externalId || r.idExterno || '').trim();
      const url = String(r.url || '').trim();
      const title = String(r.title || r.nome || '').trim();
      const description = String(r.description || r.descricao || '').trim();
      const originalCategory = String(
        r.originalCategory || r.categoriaOriginal || ''
      ).trim();
      const attractionName = String(r.attractionName || r.atracao || '').trim();
      const producerName = String(r.producerName || r.produtor || '').trim();
      const venueName = String(r.venueName || r.local || '').trim();
      const deliveryMode = String(r.deliveryMode || 'presencial').trim();
      const ibgeCode =
        r.ibgeCode || r.ibge ? String(r.ibgeCode || r.ibge).trim() : null;
      const eventDateStart = String(r.eventDateStart || r.dataEvento || '').trim();
      const eventDateEnd = r.eventDateEnd ? String(r.eventDateEnd).trim() : null;
      const publishedAt = r.publishedAt ? String(r.publishedAt).trim() : null;
      const detectedAt = String(
        r.detectedAt || new Date().toISOString().slice(0, 10)
      ).trim();
      const isFree = r.isFree ? 1 : 0;
      const priceMin =
        r.priceMin !== undefined && r.priceMin !== null && r.priceMin !== ''
          ? Number(r.priceMin)
          : null;
      const priceMax =
        r.priceMax !== undefined && r.priceMax !== null && r.priceMax !== ''
          ? Number(r.priceMax)
          : null;
      const status = String(r.status || 'published').trim();
      const provenance = String(r.provenance || 'verificado').trim();

      const sourceRow = db
        .prepare('SELECT id FROM event_sources WHERE id = ?')
        .get(sourceId);
      if (
        !sourceRow ||
        !externalId ||
        !url.startsWith('https://') ||
        !title ||
        !['presencial', 'online', 'hibrido'].includes(deliveryMode) ||
        !isValidIsoDate(eventDateStart) ||
        (eventDateEnd && (!isValidIsoDate(eventDateEnd) || eventDateStart > eventDateEnd))
      ) {
        rejected.push({
          line: lineNum,
          reason:
            'Campos obrigatórios inválidos (verifique sourceId, externalId, url https://, title e eventDateStart YYYY-MM-DD).',
        });
        continue;
      }

      let cityRow = null;
      if (ibgeCode) {
        cityRow = db
          .prepare(
            'SELECT m.ibge_code, m.uf, s.region_code, m.latitude, m.longitude FROM geo_municipalities m JOIN geo_states s ON s.uf = m.uf WHERE m.ibge_code = ?'
          )
          .get(ibgeCode);
        if (!cityRow) {
          rejected.push({
            line: lineNum,
            reason: `Município IBGE não encontrado: ${ibgeCode}`,
          });
          continue;
        }
      }

      const classified = classifyEventModality({
        title,
        description,
        originalCategory,
        modalityId: r.modalityId || '',
        submodalityId: r.submodalityId || '',
      });

      const cKey = canonicalEventKey({
        title,
        attractionName,
        venueName,
        ibgeCode: cityRow?.ibge_code || '',
        eventDateStart,
        deliveryMode,
      });

      // Check if listing already exists for this platform + externalId/url
      const existingListing = db
        .prepare(
          'SELECT id, event_id FROM commercial_event_listings WHERE (source_id = ? AND external_id = ?) OR (source_id = ? AND url = ?)'
        )
        .get(sourceId, externalId, sourceId, url);

      if (existingListing) {
        db.prepare(
          `UPDATE commercial_event_listings
           SET last_detected_at = ?, status = ?, original_title = ?, original_category = ?
           WHERE id = ?`
        ).run(
          detectedAt,
          status,
          title,
          originalCategory || null,
          existingListing.id
        );
        db.prepare(
          `UPDATE commercial_events
           SET last_detected_at = ?, status = ?
           WHERE id = ?`
        ).run(detectedAt, status, existingListing.event_id);
        updatedListings++;
        continue;
      }

      // Check if canonical event already exists (e.g. announced on another platform!)
      let canonicalEvent = db
        .prepare('SELECT id FROM commercial_events WHERE canonical_key = ?')
        .get(cKey);

      let eventId;
      if (canonicalEvent) {
        eventId = canonicalEvent.id;
        db.prepare(
          `UPDATE commercial_events
           SET last_detected_at = max(last_detected_at, ?),
               first_published_at = coalesce(first_published_at, ?)
           WHERE id = ?`
        ).run(detectedAt, publishedAt, eventId);
        mergedDuplicates++;
      } else {
        eventId = `evt-${randomUUID()}`;
        db.prepare(
          `INSERT INTO commercial_events(
             id, canonical_key, title, normalized_title, attraction_name, producer_name, venue_name,
             ibge_code, uf, region_code, latitude, longitude,
             primary_modality_id, primary_submodality_id, classification_confidence, needs_review,
             delivery_mode, is_free, price_min, price_max,
             event_date_start, event_date_end, first_published_at, first_detected_at, last_detected_at,
             is_initial_inventory, status, provenance
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          eventId,
          cKey,
          title,
          normalizeName(title),
          attractionName || null,
          producerName || null,
          venueName || null,
          cityRow?.ibge_code || null,
          cityRow?.uf || null,
          cityRow?.region_code || null,
          cityRow?.latitude ?? null,
          cityRow?.longitude ?? null,
          classified.modalityId,
          classified.submodalityId,
          classified.confidence,
          classified.needsReview ? 1 : 0,
          deliveryMode,
          isFree,
          priceMin,
          priceMax,
          eventDateStart,
          eventDateEnd,
          publishedAt,
          detectedAt,
          detectedAt,
          isInitialInventory || r.isInitialInventory ? 1 : 0,
          status,
          provenance
        );
        createdEvents++;
      }

      db.prepare(
        `INSERT INTO commercial_event_listings(
           id, event_id, source_id, external_id, url, original_title, original_category,
           published_at, first_detected_at, last_detected_at, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `lst-${randomUUID()}`,
        eventId,
        sourceId,
        externalId,
        url,
        title,
        originalCategory || null,
        publishedAt,
        detectedAt,
        detectedAt,
        status
      );

      db.prepare(
        `UPDATE event_sources
         SET last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
             last_success_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`
      ).run(sourceId);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    createdEvents,
    mergedDuplicates,
    updatedListings,
    rejectedCount: rejected.length,
    rejected,
  };
}

export function queryEventTrendsAndRankings(
  db,
  {
    modalityId = 'all',
    submodalityId = 'all',
    region = '',
    uf = '',
    centerMunicipalityId = '',
    radiusKm = null,
    sourceId = 'all',
    dateFrom = '',
    dateTo = '',
    dateBasis = 'realization', // 'realization' | 'publication'
    includeFree = false,
  } = {}
) {
  if (!db) {
    return {
      summary: {
        uniqueEvents: 0,
        totalListings: 0,
        newlyDetected: 0,
        activeModalities: 0,
        coveredMunicipalities: 0,
        activeSources: 0,
      },
      byModality: [],
      bySubmodality: [],
      byCity: [],
      byPlatform: [],
      calendarByMonth: [],
      events: [],
    };
  }

  const geoFilter = queryGeoMunicipalities(db, {
    region,
    uf,
    centerMunicipalityId,
    radiusKm,
  });
  const allowedIbge = new Map(
    geoFilter.municipalities.map(m => [m.ibge_code, m])
  );
  const hasGeoConstraint = Boolean(
    (region && region !== 'all') ||
      (uf && uf !== 'all') ||
      centerMunicipalityId
  );

  const allEvents = db
    .prepare(
      `SELECT e.*, m.name AS modality_name, sm.name AS submodality_name,
              gm.name AS city_name, gm.population AS city_population
       FROM commercial_events e
       JOIN event_modalities m ON m.id = e.primary_modality_id
       LEFT JOIN event_submodalities sm ON sm.id = e.primary_submodality_id
       LEFT JOIN geo_municipalities gm ON gm.ibge_code = e.ibge_code
       WHERE e.provenance != 'demonstracao'
       ORDER BY e.event_date_start ASC, e.title ASC`
    )
    .all();

  const allListings = db
    .prepare(
      `SELECT el.*, es.name AS source_name
       FROM commercial_event_listings el
       JOIN event_sources es ON es.id = el.source_id`
    )
    .all();

  const listingsByEvent = new Map();
  for (const l of allListings) {
    if (!listingsByEvent.has(l.event_id)) {
      listingsByEvent.set(l.event_id, []);
    }
    listingsByEvent.get(l.event_id).push(l);
  }

  const filteredEvents = [];
  for (const ev of allEvents) {
    if (!includeFree && ev.is_free === 1) continue;
    if (modalityId && modalityId !== 'all' && ev.primary_modality_id !== modalityId) {
      continue;
    }
    if (
      submodalityId &&
      submodalityId !== 'all' &&
      ev.primary_submodality_id !== submodalityId
    ) {
      continue;
    }

    // Online events without physical location do not enter radius/geo filter (Section 9)
    if (hasGeoConstraint) {
      if (ev.delivery_mode === 'online' || !ev.ibge_code) continue;
      if (!allowedIbge.has(ev.ibge_code)) continue;
    }

    const evListings = listingsByEvent.get(ev.id) || [];
    if (
      sourceId &&
      sourceId !== 'all' &&
      !evListings.some(l => l.source_id === sourceId)
    ) {
      continue;
    }

    const effectiveDate =
      dateBasis === 'publication'
        ? (ev.first_published_at || ev.first_detected_at || '').slice(0, 10)
        : ev.event_date_start;

    if (dateFrom && effectiveDate < dateFrom) continue;
    if (dateTo && effectiveDate > dateTo) continue;

    const cityInfo = ev.ibge_code ? allowedIbge.get(ev.ibge_code) : null;
    filteredEvents.push({
      ...ev,
      distanceKm: cityInfo?.distanceKm ?? null,
      listings: evListings,
      sources: [...new Set(evListings.map(l => l.source_name))],
    });
  }

  const totalUnique = filteredEvents.length;
  const totalListings = filteredEvents.reduce(
    (sum, e) => sum + e.listings.length,
    0
  );
  const newlyDetected = filteredEvents.filter(
    e => e.is_initial_inventory === 0
  ).length;

  const modalityCounts = new Map();
  const submodalityCounts = new Map();
  const cityCounts = new Map();
  const platformCounts = new Map();
  const monthModalityCounts = new Map();

  for (const ev of filteredEvents) {
    const mEntry = modalityCounts.get(ev.primary_modality_id) || {
      modalityId: ev.primary_modality_id,
      modalityName: ev.modality_name,
      uniqueEvents: 0,
      newlyDetected: 0,
      listingsCount: 0,
    };
    mEntry.uniqueEvents++;
    if (ev.is_initial_inventory === 0) mEntry.newlyDetected++;
    mEntry.listingsCount += ev.listings.length;
    modalityCounts.set(ev.primary_modality_id, mEntry);

    if (ev.primary_submodality_id) {
      const sEntry = submodalityCounts.get(ev.primary_submodality_id) || {
        submodalityId: ev.primary_submodality_id,
        submodalityName: ev.submodality_name,
        modalityId: ev.primary_modality_id,
        modalityName: ev.modality_name,
        uniqueEvents: 0,
      };
      sEntry.uniqueEvents++;
      submodalityCounts.set(ev.primary_submodality_id, sEntry);
    }

    if (ev.ibge_code) {
      const cEntry = cityCounts.get(ev.ibge_code) || {
        ibgeCode: ev.ibge_code,
        cityName: ev.city_name,
        uf: ev.uf,
        population: ev.city_population,
        distanceKm: ev.distanceKm,
        uniqueEvents: 0,
      };
      cEntry.uniqueEvents++;
      cityCounts.set(ev.ibge_code, cEntry);
    }

    // Count each unique event once per platform it appears on (Section 9)
    const uniqueSourcesForEvent = new Map(
      ev.listings.map(l => [l.source_id, l.source_name])
    );
    for (const [sId, sName] of uniqueSourcesForEvent.entries()) {
      const pEntry = platformCounts.get(sId) || {
        sourceId: sId,
        sourceName: sName,
        uniqueEventsOnPlatform: 0,
      };
      pEntry.uniqueEventsOnPlatform++;
      platformCounts.set(sId, pEntry);
    }

    const monthKey = ev.event_date_start.slice(0, 7);
    const calKey = `${monthKey}|${ev.primary_modality_id}`;
    const calEntry = monthModalityCounts.get(calKey) || {
      month: monthKey,
      modalityId: ev.primary_modality_id,
      modalityName: ev.modality_name,
      uniqueEvents: 0,
    };
    calEntry.uniqueEvents++;
    monthModalityCounts.set(calKey, calEntry);
  }

  const byModality = [...modalityCounts.values()]
    .map(m => ({
      ...m,
      sharePct:
        totalUnique > 0
          ? Number(((m.uniqueEvents / totalUnique) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.uniqueEvents - a.uniqueEvents);

  const bySubmodality = [...submodalityCounts.values()]
    .map(s => ({
      ...s,
      sharePct:
        totalUnique > 0
          ? Number(((s.uniqueEvents / totalUnique) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.uniqueEvents - a.uniqueEvents);

  const byCity = [...cityCounts.values()]
    .map(c => ({
      ...c,
      eventsPer100k:
        c.population > 0
          ? Number(((c.uniqueEvents / c.population) * 100000).toFixed(2))
          : null,
    }))
    .sort((a, b) => b.uniqueEvents - a.uniqueEvents);

  const byPlatform = [...platformCounts.values()].sort(
    (a, b) => b.uniqueEventsOnPlatform - a.uniqueEventsOnPlatform
  );

  const calendarByMonth = [...monthModalityCounts.values()].sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  return {
    filters: {
      modalityId,
      submodalityId,
      region,
      uf,
      centerMunicipalityId,
      radiusKm: geoFilter.radiusKm,
      centerMunicipality: geoFilter.center,
      sourceId,
      dateFrom,
      dateTo,
      dateBasis,
      includeFree,
    },
    summary: {
      uniqueEvents: totalUnique,
      totalListings,
      newlyDetected,
      activeModalities: byModality.length,
      coveredMunicipalities: byCity.length,
      activeSources: byPlatform.length,
    },
    byModality,
    bySubmodality,
    byCity,
    byPlatform,
    calendarByMonth,
    events: filteredEvents,
    disclaimer:
      'O Radar de Tendências mede a oferta de eventos publicados/detectados nas plataformas monitoradas. Volume de eventos publicados não equivale a vendas de ingressos ou faturamento.',
  };
}

export function queryOpportunities(
  db,
  {
    talentId = '',
    talentName = '',
    platform = 'Instagram',
    metric = 'seguidores',
    modalityId = 'all',
    region = '',
    uf = '',
    centerMunicipalityId = '',
    radiusKm = null,
  } = {}
) {
  if (!db) {
    return computeOpportunitiesMatrix({ municipalities: [] });
  }
  const geoFilter = queryGeoMunicipalities(db, {
    region,
    uf,
    centerMunicipalityId,
    radiusKm,
  });

  const audienceReport = queryAudienceMapAndDistribution(db, {
    talentId,
    talentName,
    platform,
    metric,
    region,
    uf,
    centerMunicipalityId,
    radiusKm,
  });

  const eventsReport = queryEventTrendsAndRankings(db, {
    modalityId,
    region,
    uf,
    centerMunicipalityId,
    radiusKm,
  });

  const audienceByIbge = new Map();
  for (const item of audienceReport.items) {
    audienceByIbge.set(item.ibgeCode, {
      value: item.value,
      source: item.source,
      provenance: item.provenance,
    });
  }

  const eventsByIbge = new Map();
  for (const c of eventsReport.byCity) {
    eventsByIbge.set(c.ibgeCode, { count: c.uniqueEvents });
  }
  // If events have been imported in the database, cities in the geo filter with 0 events have 0 observed offer ONLY if that state/region has active event monitoring
  const monitoredUfs = new Set(eventsReport.byCity.map(c => c.uf));
  for (const m of geoFilter.municipalities) {
    if (monitoredUfs.has(m.uf) && !eventsByIbge.has(m.ibge_code)) {
      eventsByIbge.set(m.ibge_code, { count: 0 });
    }
  }

  return computeOpportunitiesMatrix({
    municipalities: geoFilter.municipalities,
    audienceByIbge,
    eventsByIbge,
  });
}

export function querySourcesStatus(db) {
  if (!db) {
    return {
      sources: TICKETING_SOURCES.map(s => ({
        ...s,
        enabled: true,
        integrationState: 'adapter_ready',
        listingsCount: 0,
      })),
    };
  }
  const rows = db
    .prepare(
      `SELECT es.*,
              (SELECT count(*) FROM commercial_event_listings el WHERE el.source_id = es.id) AS listings_count
       FROM event_sources es
       ORDER BY es.name ASC`
    )
    .all();
  return {
    sources: rows.map(r => ({
      id: r.id,
      name: r.name,
      segment: r.segment,
      websiteUrl: r.website_url,
      enabled: Boolean(r.enabled),
      integrationState: r.integration_state,
      lastAttemptAt: r.last_attempt_at,
      lastSuccessAt: r.last_success_at,
      coverageNote: r.coverage_note,
      listingsCount: r.listings_count,
    })),
  };
}
