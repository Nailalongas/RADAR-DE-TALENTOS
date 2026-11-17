import {
  BRAZIL_REGIONS,
  DEFAULT_MUNICIPALITIES,
  EVENT_MODALITIES,
  TICKETING_SOURCES,
  filterMunicipalitiesByGeo,
} from '../domain/geo-intelligence.js';

const researchResponseCache = new Map();
const CACHE_TTL_MS = 120000;

export function clearResearchCache() {
  researchResponseCache.clear();
}

export async function getHealth(signal) {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('Servidor indisponível');
  return response.json();
}

export async function getTaxonomy(signal) {
  const response = await fetch('/api/taxonomy', { signal });
  if (!response.ok) throw new Error('Não foi possível carregar a taxonomia.');
  return response.json();
}

export async function getModalities(signal) {
  try {
    const response = await fetch('/api/modalities', { signal });
    if (response.ok) return await response.json();
  } catch {}
  return { modalities: EVENT_MODALITIES };
}

export async function getGeoMunicipalities({
  search = '',
  uf = '',
  region = '',
  centerMunicipalityId = '',
  radiusKm = null,
  signal,
} = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (uf && uf !== 'all') params.set('uf', uf);
  if (region && region !== 'all') params.set('region', region);
  if (centerMunicipalityId) {
    params.set('centerMunicipalityId', centerMunicipalityId);
  }
  if (radiusKm !== null && radiusKm !== undefined && radiusKm !== '') {
    params.set('radiusKm', String(radiusKm));
  }
  try {
    const response = await fetch(`/api/geo/municipalities?${params.toString()}`, {
      signal,
    });
    if (response.ok) return await response.json();
  } catch {}
  return {
    ...filterMunicipalitiesByGeo(DEFAULT_MUNICIPALITIES, {
      search,
      uf,
      region,
      centerMunicipalityId,
      radiusKm,
    }),
    totalInBase: DEFAULT_MUNICIPALITIES.length,
    sourceVersion: 'IBGE Censo 2022',
  };
}

export async function getAudienceMap(filters = {}, signal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== null && v !== undefined && v !== '' && v !== 'all') {
      params.set(k, String(v));
    }
  }
  try {
    const response = await fetch(`/api/audience/map?${params.toString()}`, {
      signal,
    });
    if (response.ok) return await response.json();
  } catch {}
  return {
    items: [],
    byRegion: [],
    byState: [],
    coverageNotice:
      'Nenhum relatório de audiência municipal importado nesta sessão. Use a importação CSV/JSON abaixo para carregar dados autorizados.',
  };
}

export async function getEventTrends(filters = {}, signal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== null && v !== undefined && v !== '' && v !== 'all') {
      params.set(k, String(v));
    }
  }
  try {
    const response = await fetch(`/api/events/trends?${params.toString()}`, {
      signal,
    });
    if (response.ok) return await response.json();
  } catch {}
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

export async function getOpportunities(filters = {}, signal) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== null && v !== undefined && v !== '' && v !== 'all') {
      params.set(k, String(v));
    }
  }
  try {
    const response = await fetch(`/api/opportunities?${params.toString()}`, {
      signal,
    });
    if (response.ok) return await response.json();
  } catch {}
  return {
    thresholds: { audienceMedian: 0, eventsMedian: 0 },
    evaluatedCount: 0,
    insufficientCount: 0,
    items: [],
  };
}

export async function getSourcesStatus(signal) {
  try {
    const response = await fetch('/api/sources/status', { signal });
    if (response.ok) return await response.json();
  } catch {}
  return {
    sources: TICKETING_SOURCES.map(s => ({
      ...s,
      enabled: true,
      integrationState: 'adapter_ready',
      listingsCount: 0,
    })),
  };
}

export async function postAdminAudienceImport(rows, adminToken = 'radar-local-admin') {
  const response = await fetch('/api/admin/audience/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ rows }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Falha ao importar audiência regional.');
  }
  return body;
}

export async function postAdminEventsImport(
  rows,
  { isInitialInventory = false, adminToken = 'radar-local-admin' } = {}
) {
  const response = await fetch('/api/admin/events/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ rows, isInitialInventory }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Falha ao importar eventos.');
  }
  return body;
}

async function fetchJsonWithCache(path, { signal, useCache = true } = {}) {
  if (useCache && researchResponseCache.has(path)) {
    const cached = researchResponseCache.get(path);
    if (Date.now() - cached.at < CACHE_TTL_MS) {
      return structuredClone(cached.value);
    }
  }
  const response = await fetch(`/api/${path}`, { signal });
  const raw = await response.text();
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      `O servidor não conseguiu concluir a consulta (HTTP ${response.status}). Os dados já carregados foram preservados.`
    );
  }
  if (!response.ok) {
    throw new Error(value?.error || 'Falha ao acessar dados reais');
  }
  if (useCache) {
    researchResponseCache.set(path, { at: Date.now(), value });
  }
  return structuredClone(value);
}

export async function getResearch({ start, end, signal, useCache = true } = {}) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const query = params.toString();
  return fetchJsonWithCache(query ? `research?${query}` : 'research', {
    signal,
    useCache,
  });
}

export async function getHistory({ signal, useCache = true } = {}) {
  return fetchJsonWithCache('history', { signal, useCache });
}

export async function getEvolution({
  personId = '',
  name = '',
  signal,
  useCache = true,
} = {}) {
  const params = new URLSearchParams();
  if (personId) params.set('personId', personId);
  if (name) params.set('name', name);
  return fetchJsonWithCache(`evolution?${params.toString()}`, {
    signal,
    useCache,
  });
}
