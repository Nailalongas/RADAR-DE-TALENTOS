import { useEffect, useMemo, useState } from 'react';
import {
  ALL_IBGE_MUNICIPALITIES,
  BRAZIL_REGIONS,
  RADIUS_PRESETS_KM,
  UF_TO_REGION,
  filterMunicipalitiesByGeo,
} from '../domain/geo-intelligence.js';
import ibgeUfMalha from '../domain/ibge-uf-malha.json' with { type: 'json' };
import { formatNumber } from '../domain/research.js';
import {
  getAudienceMap,
  postAdminAudienceImport,
} from '../services/api.js';

const IBGE_CODE_TO_UF = {
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

const REGION_BASE_COLORS = {
  N: '#d1e7dd',
  NE: '#fce8d5',
  CO: '#e5dcf2',
  SE: '#d2e4f5',
  S: '#cde6eb',
};

const PLATFORM_METRICS = {
  Instagram: [
    { value: 'seguidores', label: 'Seguidores' },
    { value: 'alcance', label: 'Alcance' },
    { value: 'visualizacoes', label: 'Visualizações' },
  ],
  YouTube: [
    { value: 'visualizacoes', label: 'Visualizações' },
    { value: 'minutos_assistidos', label: 'Minutos assistidos' },
    { value: 'seguidores', label: 'Inscritos' },
  ],
  Spotify: [
    { value: 'ouvintes', label: 'Ouvintes mensais' },
    { value: 'reproducoes', label: 'Reproduções' },
  ],
};

function projectToSvg(lat, lon) {
  // Maps Brazil bounds: lon [-75, -33] -> x [10, 430], lat [6, -34] -> y [10, 410]
  const x = ((lon + 75) / 42) * 420 + 10;
  const y = ((6 - lat) / 40) * 400 + 10;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

function buildStateSvgPaths(geojson) {
  const features = geojson?.features || [];
  return features
    .map(feature => {
      const codarea = String(feature.properties?.codarea || feature.id || '');
      const uf = IBGE_CODE_TO_UF[codarea];
      if (!uf || !feature.geometry) return null;
      const polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      const d = polygons
        .flatMap(poly =>
          poly.map(
            ring =>
              'M' +
              ring
                .map(([lng, lat]) => {
                  const pt = projectToSvg(lat, lng);
                  return `${pt.x},${pt.y}`;
                })
                .join('L') +
              'Z'
          )
        )
        .join('');
      return {
        uf,
        codarea,
        regionCode: UF_TO_REGION[uf] || '',
        d,
      };
    })
    .filter(Boolean);
}

const STATE_SVG_PATHS = buildStateSvgPaths(ibgeUfMalha);

const SAMPLE_AUDIENCE_CSV = [
  'talentName;platform;metric;unit;granularity;ibgeCode;periodStart;periodEnd;value;provenance;source',
  'Natiruts;YouTube;visualizacoes;visualizacoes;municipality;4106902;2026-10-01;2026-10-31;85000;verificado;YouTube Analytics Autorizado (Exemplo)',
  'Natiruts;YouTube;visualizacoes;visualizacoes;municipality;4209102;2026-10-01;2026-10-31;32000;verificado;YouTube Analytics Autorizado (Exemplo)',
  'Natiruts;YouTube;visualizacoes;visualizacoes;municipality;4119905;2026-10-01;2026-10-31;21000;verificado;YouTube Analytics Autorizado (Exemplo)',
  'Natiruts;YouTube;visualizacoes;visualizacoes;municipality;4125506;2026-10-01;2026-10-31;18000;verificado;YouTube Analytics Autorizado (Exemplo)',
  'Natiruts;YouTube;visualizacoes;visualizacoes;municipality;4118204;2026-10-01;2026-10-31;9000;verificado;YouTube Analytics Autorizado (Exemplo)',
  'Natiruts;YouTube;visualizacoes;visualizacoes;municipality;3550308;2026-10-01;2026-10-31;240000;verificado;YouTube Analytics Autorizado (Exemplo)',
  'Natiruts;YouTube;visualizacoes;visualizacoes;municipality;4314902;2026-10-01;2026-10-31;95000;verificado;YouTube Analytics Autorizado (Exemplo)',
  'Natiruts;Instagram;seguidores;seguidores;municipality;4106902;2026-10-01;2026-10-31;62000;verificado;Instagram Insights Autorizado (Exemplo)',
  'Natiruts;Instagram;seguidores;seguidores;municipality;4209102;2026-10-01;2026-10-31;24000;verificado;Instagram Insights Autorizado (Exemplo)',
  'Natiruts;Instagram;seguidores;seguidores;municipality;3550308;2026-10-01;2026-10-31;185000;verificado;Instagram Insights Autorizado (Exemplo)',
  'Natiruts;Spotify;ouvintes;ouvintes;municipality;4106902;2026-10-01;2026-10-31;43000;verificado;Spotify for Artists (Exemplo)',
].join('\n');

export default function GeoAudienceRadar() {
  const [municipalities] = useState(ALL_IBGE_MUNICIPALITIES);
  const [talentName, setTalentName] = useState('');
  const [platform, setPlatform] = useState('YouTube');
  const [metric, setMetric] = useState('visualizacoes');
  const [region, setRegion] = useState('all');
  const [uf, setUf] = useState('all');
  const [citySearch, setCitySearch] = useState('');
  const [centerSelectorQuery, setCenterSelectorQuery] = useState('');
  const [centerMunicipalityId, setCenterMunicipalityId] = useState('4106902'); // Curitiba default
  const [radiusMode, setRadiusMode] = useState('150'); // 'none' | preset | 'custom'
  const [customRadiusKm, setCustomRadiusKm] = useState('150');
  const [perCapita, setPerCapita] = useState(false);
  const [zoomMode, setZoomMode] = useState('brazil'); // 'brazil' | 'focus' | '2x' | '4x'

  const [audienceReport, setAudienceReport] = useState({
    items: [],
    byRegion: [],
    byState: [],
    coverageNotice: '',
  });
  const [localImportedRows, setLocalImportedRows] = useState([]);
  const [importStatus, setImportStatus] = useState('');
  const [tablePage, setTablePage] = useState(0);
  const PAGE_SIZE = 50;

  const effectiveRadiusKm = useMemo(() => {
    if (radiusMode === 'none') return null;
    const raw = radiusMode === 'custom' ? customRadiusKm : radiusMode;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [radiusMode, customRadiusKm]);

  const availableUfs = useMemo(() => {
    if (region === 'all') {
      return BRAZIL_REGIONS.flatMap(r => r.ufs).sort();
    }
    return BRAZIL_REGIONS.find(r => r.code === region)?.ufs || [];
  }, [region]);

  const centerCandidateOptions = useMemo(() => {
    const q = centerSelectorQuery.trim().toLowerCase();
    const current = municipalities.find(
      m => m.ibge_code === centerMunicipalityId
    );
    const matches = q
      ? municipalities
          .filter(
            m =>
              m.name.toLowerCase().includes(q) ||
              m.ibge_code.includes(q) ||
              `${m.name.toLowerCase()} (${m.uf.toLowerCase()})`.includes(q)
          )
          .slice(0, 120)
      : municipalities.filter(m => m.capital || m.population).slice(0, 120);
    if (current && !matches.some(m => m.ibge_code === current.ibge_code)) {
      return [current, ...matches];
    }
    return matches;
  }, [municipalities, centerSelectorQuery, centerMunicipalityId]);

  const geoFiltered = useMemo(() => {
    try {
      return filterMunicipalitiesByGeo(municipalities, {
        region: region === 'all' ? '' : region,
        uf: uf === 'all' ? '' : uf,
        centerMunicipalityId:
          effectiveRadiusKm !== null ? centerMunicipalityId : '',
        radiusKm: effectiveRadiusKm,
        search: citySearch,
      });
    } catch {
      return { center: null, radiusKm: null, municipalities: [] };
    }
  }, [
    municipalities,
    region,
    uf,
    centerMunicipalityId,
    effectiveRadiusKm,
    citySearch,
  ]);

  async function refreshAudienceReport() {
    try {
      const report = await getAudienceMap({
        talentName,
        platform,
        metric,
        region: region === 'all' ? '' : region,
        uf: uf === 'all' ? '' : uf,
        centerMunicipalityId:
          effectiveRadiusKm !== null ? centerMunicipalityId : '',
        radiusKm: effectiveRadiusKm ?? '',
        perCapita,
      });
      setAudienceReport(report);
    } catch {}
  }

  useEffect(() => {
    setTablePage(0);
    refreshAudienceReport();
  }, [
    talentName,
    platform,
    metric,
    region,
    uf,
    centerMunicipalityId,
    effectiveRadiusKm,
    perCapita,
  ]);

  const displayedAudienceItems = useMemo(() => {
    if (audienceReport.items?.length) return audienceReport.items;
    if (!localImportedRows.length) return [];
    const allowedMap = new Map(
      geoFiltered.municipalities.map(m => [m.ibge_code, m])
    );
    const filtered = localImportedRows.filter(
      r =>
        (!talentName ||
          r.talentName.toLowerCase().includes(talentName.toLowerCase())) &&
        r.platform === platform &&
        r.metric === metric &&
        allowedMap.has(r.ibgeCode)
    );
    const total = filtered.reduce((s, r) => s + r.value, 0);
    return filtered
      .map(r => {
        const city = allowedMap.get(r.ibgeCode);
        return {
          ibgeCode: r.ibgeCode,
          cityName: city.name,
          uf: city.uf,
          regionCode: city.region_code,
          population: city.population,
          distanceKm: city.distanceKm,
          platform: r.platform,
          metric: r.metric,
          value: r.value,
          provenance: r.provenance,
          source: r.source,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          per100kInhabitants:
            city.population > 0
              ? Number(((r.value / city.population) * 100000).toFixed(1))
              : null,
          shareOfKnownAudiencePct:
            total > 0 ? Number(((r.value / total) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) =>
        perCapita
          ? (b.per100kInhabitants || 0) - (a.per100kInhabitants || 0)
          : b.value - a.value
      );
  }, [
    audienceReport.items,
    localImportedRows,
    geoFiltered.municipalities,
    talentName,
    platform,
    metric,
    perCapita,
  ]);

  const audienceByIbge = useMemo(
    () => new Map(displayedAudienceItems.map(i => [i.ibgeCode, i])),
    [displayedAudienceItems]
  );

  const audienceByState = useMemo(() => {
    const totals = new Map();
    for (const item of displayedAudienceItems) {
      totals.set(item.uf, (totals.get(item.uf) || 0) + item.value);
    }
    return totals;
  }, [displayedAudienceItems]);

  const maxStateVal = Math.max(1, ...audienceByState.values());
  const maxVal = Math.max(1, ...displayedAudienceItems.map(i => i.value));

  const totalKnownInFilter = displayedAudienceItems.reduce(
    (s, x) => s + x.value,
    0
  );

  const centerCoords = geoFiltered.center
    ? projectToSvg(geoFiltered.center.latitude, geoFiltered.center.longitude)
    : null;

  const svgViewBox = useMemo(() => {
    if (zoomMode === 'brazil' || !centerCoords) {
      return '0 0 440 420';
    }
    const radiusSvg =
      effectiveRadiusKm !== null
        ? Math.max(25, (effectiveRadiusKm / 4200) * 400)
        : 80;
    const halfSpan =
      zoomMode === 'focus'
        ? Math.min(200, Math.max(35, radiusSvg * 1.6))
        : zoomMode === '4x'
          ? 55
          : 110;
    const minX = Math.max(0, Math.min(440 - halfSpan * 2, centerCoords.x - halfSpan));
    const minY = Math.max(0, Math.min(420 - halfSpan * 2, centerCoords.y - halfSpan));
    return `${minX.toFixed(1)} ${minY.toFixed(1)} ${(halfSpan * 2).toFixed(1)} ${(halfSpan * 2).toFixed(1)}`;
  }, [zoomMode, centerCoords, effectiveRadiusKm]);

  async function handleCsvUpload(text) {
    const lines = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/)
      .filter(l => l.trim());
    if (lines.length < 2) {
      setImportStatus('Arquivo CSV vazio.');
      return;
    }
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines
      .shift()
      .split(sep)
      .map(h => h.trim());
    const parsedRows = lines.map(line => {
      const cols = line.split(sep).map(c => c.trim());
      const obj = Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
      return {
        talentName: obj.talentName || obj.nome || 'Natiruts',
        platform: obj.platform || obj.rede || 'YouTube',
        metric: (obj.metric || obj.metrica || 'visualizacoes').toLowerCase(),
        unit: obj.unit || obj.metric || 'visualizacoes',
        granularity: obj.granularity || 'municipality',
        ibgeCode: obj.ibgeCode || obj.ibge,
        periodStart: obj.periodStart || obj.inicio || '2026-10-01',
        periodEnd: obj.periodEnd || obj.fim || '2026-10-31',
        value: Number(obj.value ?? obj.valor),
        provenance: obj.provenance || 'verificado',
        source: obj.source || obj.fonte || 'Importação CSV',
      };
    });

    try {
      const res = await postAdminAudienceImport(parsedRows);
      setImportStatus(
        `Importação concluída no banco: ${res.imported} novos, ${res.updated} atualizados, ${res.rejectedCount} rejeitados.`
      );
      await refreshAudienceReport();
    } catch {
      setLocalImportedRows(parsedRows);
      setImportStatus(
        `Carregados ${parsedRows.length} registros de audiência regional nesta sessão.`
      );
    }
  }

  function downloadSampleCsv() {
    const blob = new Blob(['\ufeff' + SAMPLE_AUDIENCE_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-audiencia-regional-ibge.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Sort municipalities in the table: those with known audience first, then by distance or population
  const sortedMunicipalitiesForTable = useMemo(() => {
    return [...geoFiltered.municipalities].sort((a, b) => {
      const audA = audienceByIbge.get(a.ibge_code);
      const audB = audienceByIbge.get(b.ibge_code);
      if (audA && !audB) return -1;
      if (!audA && audB) return 1;
      if (audA && audB) {
        return perCapita
          ? (audB.per100kInhabitants || 0) - (audA.per100kInhabitants || 0)
          : audB.value - audA.value;
      }
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'pt-BR');
      }
      return (
        (b.population || 0) - (a.population || 0) ||
        a.name.localeCompare(b.name, 'pt-BR')
      );
    });
  }, [geoFiltered.municipalities, audienceByIbge, perCapita]);

  const pagedMunicipalities = sortedMunicipalitiesForTable.slice(
    tablePage * PAGE_SIZE,
    (tablePage + 1) * PAGE_SIZE
  );
  const totalPages = Math.max(
    1,
    Math.ceil(sortedMunicipalitiesForTable.length / PAGE_SIZE)
  );

  // Limit map points to avoid rendering 5571 SVG circles simultaneously when viewing whole country without radius
  const mapPoints = useMemo(() => {
    if (effectiveRadiusKm !== null && effectiveRadiusKm <= 500) {
      return geoFiltered.municipalities;
    }
    return geoFiltered.municipalities.filter(
      m =>
        m.capital ||
        m.population > 100000 ||
        audienceByIbge.has(m.ibge_code) ||
        m.ibge_code === centerMunicipalityId
    );
  }, [
    geoFiltered.municipalities,
    effectiveRadiusKm,
    audienceByIbge,
    centerMunicipalityId,
  ]);

  return (
    <section id="geoAudienceRadar" aria-label="Radar Geográfico de Audiência">
      <div className="research-panel">
        <h2 className="research-panel-title">
          Radar Geográfico Cartográfico do Brasil ({formatNumber(municipalities.length)}{' '}
          municípios oficiais IBGE)
        </h2>
        <p className="small" style={{ marginBottom: 16 }}>
          Malha territorial oficial das 27 UFs (IBGE) e todos os{' '}
          <b>{formatNumber(municipalities.length)} municípios brasileiros</b>{' '}
          com coordenadas WGS84 e cálculo geodésico Haversine por raio em km.
          Métricas de redes distintas não são somadas como pessoas únicas.
        </p>

        <div className="persistent-filters">
          <div className="filters">
            <label>
              Talento / Atração
              <input
                type="search"
                placeholder="Ex.: Natiruts ou todos…"
                value={talentName}
                onChange={e => setTalentName(e.target.value)}
              />
            </label>

            <label>
              Plataforma
              <select
                value={platform}
                onChange={e => {
                  const nextPlat = e.target.value;
                  setPlatform(nextPlat);
                  setMetric(PLATFORM_METRICS[nextPlat][0].value);
                }}
              >
                <option value="YouTube">YouTube</option>
                <option value="Instagram">Instagram</option>
                <option value="Spotify">Spotify</option>
              </select>
            </label>

            <label>
              Indicador da plataforma
              <select value={metric} onChange={e => setMetric(e.target.value)}>
                {(PLATFORM_METRICS[platform] || []).map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Região brasileira
              <select
                value={region}
                onChange={e => {
                  setRegion(e.target.value);
                  setUf('all');
                }}
              >
                <option value="all">Brasil inteiro (5 regiões)</option>
                {BRAZIL_REGIONS.map(r => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.ufs.join(', ')})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado (UF)
              <select value={uf} onChange={e => setUf(e.target.value)}>
                <option value="all">Todos os 27 estados</option>
                {availableUfs.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Filtrar cidade de referência (5.571 municípios)
              <input
                type="search"
                placeholder="Digite qualquer cidade ou código IBGE…"
                value={centerSelectorQuery}
                onChange={e => setCenterSelectorQuery(e.target.value)}
              />
            </label>

            <label>
              Cidade de referência selecionada
              <select
                id="centerMunicipalitySelect"
                value={centerMunicipalityId}
                onChange={e => setCenterMunicipalityId(e.target.value)}
              >
                {centerCandidateOptions.map(m => (
                  <option key={m.ibge_code} value={m.ibge_code}>
                    {m.name} ({m.uf}) · IBGE {m.ibge_code}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Raio de atuação (Haversine)
              <select
                id="radiusPresetSelect"
                value={radiusMode}
                onChange={e => setRadiusMode(e.target.value)}
              >
                <option value="none">Brasil / Sem limite de raio</option>
                {RADIUS_PRESETS_KM.map(km => (
                  <option key={km} value={String(km)}>
                    Até {km} km de distância
                  </option>
                ))}
                <option value="custom">Raio personalizado (km)</option>
              </select>
            </label>

            {radiusMode === 'custom' && (
              <label>
                Quilômetros (0 a 5.000 km)
                <input
                  type="number"
                  min="0"
                  max="5000"
                  value={customRadiusKm}
                  onChange={e => setCustomRadiusKm(e.target.value)}
                />
              </label>
            )}

            <label>
              Buscar município no resultado
              <input
                type="search"
                placeholder="Ex.: Bom Jesus, Joinville, 4106902…"
                value={citySearch}
                onChange={e => setCitySearch(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="tools" style={{ justifyContent: 'space-between' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={perCapita}
              onChange={e => setPerCapita(e.target.checked)}
            />
            Ordenar proporcionalmente por 100 mil habitantes (população Censo
            IBGE 2022)
          </label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="primary"
              onClick={() => handleCsvUpload(SAMPLE_AUDIENCE_CSV)}
            >
              Carregar exemplo piloto (Natiruts · Curitiba/Joinville/SP/POA)
            </button>
            <button
              type="button"
              onClick={() => {
                setTalentName('');
                setRegion('all');
                setUf('all');
                setRadiusMode('none');
                setCitySearch('');
                setZoomMode('brazil');
              }}
            >
              Limpar filtros geográficos
            </button>
          </div>
        </div>
      </div>

      <section className="result-summary" aria-label="Resumo geográfico">
        <div className="summary-grid">
          <div className="summary-card">
            <strong>{formatNumber(geoFiltered.municipalities.length)}</strong>
            <span>
              de {formatNumber(municipalities.length)} municípios no recorte
            </span>
          </div>
          <div className="summary-card">
            <strong>
              {effectiveRadiusKm !== null
                ? `${effectiveRadiusKm} km`
                : 'País inteiro'}
            </strong>
            <span>
              {geoFiltered.center
                ? `a partir de ${geoFiltered.center.name} (${geoFiltered.center.uf})`
                : 'sem cidade central fixada'}
            </span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(displayedAudienceItems.length)}</strong>
            <span>municípios com audiência registrada</span>
          </div>
          <div className="summary-card">
            <strong>
              {displayedAudienceItems.length
                ? formatNumber(totalKnownInFilter)
                : 'Indisponível'}
            </strong>
            <span>
              {platform} · {metric} no recorte
            </span>
          </div>
        </div>
        <p className="summary-note">
          {audienceReport.coverageNotice ||
            'Malha territorial oficial do IBGE (27 UFs) e 5.571 municípios com coordenadas WGS84. Ausência de relatório oficial aparece como Indisponível, nunca como zero.'}
        </p>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 1.05fr) minmax(0, 1.35fr)',
          gap: '22px',
          alignItems: 'start',
        }}
      >
        <section className="panel">
          <div className="sectionhead" style={{ marginBottom: 10 }}>
            <h3>Mapa Cartográfico do Brasil (Malha IBGE)</h3>
            <div className="chips">
              <button
                type="button"
                className={zoomMode === 'brazil' ? 'active' : ''}
                onClick={() => setZoomMode('brazil')}
              >
                Brasil (1x)
              </button>
              <button
                type="button"
                className={zoomMode === 'focus' ? 'active' : ''}
                onClick={() => setZoomMode('focus')}
              >
                Focar no Raio
              </button>
              <button
                type="button"
                className={zoomMode === '2x' ? 'active' : ''}
                onClick={() => setZoomMode('2x')}
              >
                Zoom 2x
              </button>
              <button
                type="button"
                className={zoomMode === '4x' ? 'active' : ''}
                onClick={() => setZoomMode('4x')}
              >
                Zoom 4x
              </button>
            </div>
          </div>

          <p className="small">
            {geoFiltered.center && effectiveRadiusKm !== null
              ? `Raio geodésico de ${effectiveRadiusKm} km centrado em ${geoFiltered.center.name} (${geoFiltered.center.uf}) · ${formatNumber(geoFiltered.municipalities.length)} municípios incluídos.`
              : 'Clique em qualquer estado para filtrar pela UF ou em qualquer município para centralizar o raio em km.'}
          </p>

          <svg
            viewBox={svgViewBox}
            style={{
              width: '100%',
              height: 'auto',
              background: '#e5f1f8',
              borderRadius: '14px',
              border: '1px solid #bdd4e7',
            }}
            role="img"
            aria-label="Mapa cartográfico oficial do Brasil por estado e municípios"
          >
            {/* Camada 1: Malha territorial oficial das 27 UFs (IBGE) */}
            <g aria-label="Estados brasileiros">
              {STATE_SVG_PATHS.map(st => {
                const stateVal = audienceByState.get(st.uf) || 0;
                const isSelectedUf = uf === st.uf;
                const inSelectedRegion =
                  region === 'all' || st.regionCode === region;
                const fill =
                  stateVal > 0
                    ? `hsl(168, 72%, ${Math.round(74 - (stateVal / maxStateVal) * 42)}%)`
                    : !inSelectedRegion || (uf !== 'all' && !isSelectedUf)
                      ? '#dbe4ec'
                      : REGION_BASE_COLORS[st.regionCode] || '#dfe9f2';

                return (
                  <path
                    key={st.uf}
                    d={st.d}
                    fill={fill}
                    stroke={isSelectedUf ? '#085f4c' : '#7a96af'}
                    strokeWidth={isSelectedUf ? '1.6' : '0.7'}
                    style={{ cursor: 'pointer', transition: 'fill .15s' }}
                    onClick={() =>
                      setUf(prev => (prev === st.uf ? 'all' : st.uf))
                    }
                  >
                    <title>
                      {`Estado: ${st.uf}${
                        stateVal > 0
                          ? ` · ${platform} (${metric}): ${formatNumber(stateVal)}`
                          : ' · Clique para filtrar UF'
                      }`}
                    </title>
                  </path>
                );
              })}
            </g>

            {/* Camada 2: Círculo do raio geodésico de atuação */}
            {centerCoords && effectiveRadiusKm !== null && (
              <circle
                cx={centerCoords.x}
                cy={centerCoords.y}
                r={Math.max(4, (effectiveRadiusKm / 4200) * 400)}
                fill="#00b58b28"
                stroke="#007c64"
                strokeWidth="1.4"
                strokeDasharray="4 2"
              />
            )}

            {/* Camada 3: Municípios dentro do recorte e bolhas de audiência */}
            <g aria-label="Municípios no recorte">
              {mapPoints.map(m => {
                if (m.latitude == null || m.longitude == null) return null;
                const pt = projectToSvg(m.latitude, m.longitude);
                const audItem = audienceByIbge.get(m.ibge_code);
                const isCenter =
                  geoFiltered.center &&
                  m.ibge_code === geoFiltered.center.ibge_code;
                const r = audItem
                  ? 4.5 + (audItem.value / maxVal) * 11
                  : isCenter
                    ? 5.5
                    : 2.2;
                const fill = audItem
                  ? '#007e68'
                  : isCenter
                    ? '#102d4c'
                    : '#3b648c';

                return (
                  <g
                    key={m.ibge_code}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setCenterMunicipalityId(m.ibge_code)}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={r}
                      fill={fill}
                      opacity={audItem || isCenter ? 0.92 : 0.65}
                      stroke="#fff"
                      strokeWidth={audItem || isCenter ? '1' : '0.4'}
                    >
                      <title>
                        {`${m.name} (${m.uf}) · IBGE ${m.ibge_code}${
                          m.distanceKm !== null ? ` · ${m.distanceKm} km` : ''
                        }${
                          audItem
                            ? ` · ${platform} (${metric}): ${formatNumber(audItem.value)}`
                            : ' · Clique para definir como centro do raio'
                        }`}
                      </title>
                    </circle>
                    {(isCenter || audItem) && (
                      <text
                        x={pt.x}
                        y={pt.y - r - 3}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="700"
                        fill="#0b223d"
                      >
                        {m.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          <div
            className="chips"
            style={{ marginTop: 12, fontSize: 11, color: '#456276' }}
          >
            <span className="badge" style={{ background: '#007e68', color: '#fff' }}>
              ● Audiência verificada/estimada
            </span>
            <span className="badge" style={{ background: '#102d4c', color: '#fff' }}>
              ● Cidade de referência do raio
            </span>
            <span className="badge">● Municípios no raio (IBGE)</span>
          </div>
        </section>

        <section className="panel">
          <div className="sectionhead">
            <h3>
              Municípios no recorte ({formatNumber(sortedMunicipalitiesForTable.length)}{' '}
              cidades)
            </h3>
            <span className="small">
              Página {tablePage + 1} de {totalPages}
            </span>
          </div>
          <p className="small">
            Qualquer um dos 5.571 municípios brasileiros pode ser selecionado
            como referência do raio em km. Homônimos são desambiguados pela UF e
            pelo código IBGE de 7 dígitos.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="discovery-report">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Município (UF) · IBGE</th>
                  <th>Distância</th>
                  <th>
                    {platform} · {metric}
                  </th>
                  <th>Participação / Fonte</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {pagedMunicipalities.map((m, idx) => {
                  const aud = audienceByIbge.get(m.ibge_code);
                  const pos = tablePage * PAGE_SIZE + idx + 1;
                  return (
                    <tr key={m.ibge_code}>
                      <td>{pos}</td>
                      <td>
                        <b>
                          {m.name} ({m.uf})
                        </b>
                        <br />
                        <small>IBGE {m.ibge_code}</small>
                      </td>
                      <td>
                        {m.distanceKm !== null ? `${m.distanceKm} km` : '—'}
                      </td>
                      <td>
                        {aud ? (
                          <strong>{formatNumber(aud.value)}</strong>
                        ) : (
                          <span className="small">Indisponível</span>
                        )}
                      </td>
                      <td>
                        {aud ? (
                          <>
                            <span className="badge">
                              {aud.shareOfKnownAudiencePct}% · {aud.provenance}
                            </span>
                            <br />
                            <small>{aud.source}</small>
                          </>
                        ) : (
                          <small>Sem relatório municipal</small>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          onClick={() => {
                            setCenterMunicipalityId(m.ibge_code);
                            if (radiusMode === 'none') setRadiusMode('150');
                          }}
                        >
                          Usar como centro
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="tools">
              <button
                type="button"
                disabled={tablePage === 0}
                onClick={() => setTablePage(p => Math.max(0, p - 1))}
              >
                ← Anterior
              </button>
              <span className="small">
                Exibindo {tablePage * PAGE_SIZE + 1}–
                {Math.min(
                  (tablePage + 1) * PAGE_SIZE,
                  sortedMunicipalitiesForTable.length
                )}{' '}
                de {formatNumber(sortedMunicipalitiesForTable.length)} municípios
              </span>
              <button
                type="button"
                disabled={tablePage + 1 >= totalPages}
                onClick={() =>
                  setTablePage(p => Math.min(totalPages - 1, p + 1))
                }
              >
                Próxima →
              </button>
            </div>
          )}
        </section>
      </div>

      <details className="panel" style={{ marginTop: 22 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Importar relatório CSV de audiência regional (YouTube Analytics /
          Instagram Insights / Spotify for Artists)
        </summary>
        <p className="small">
          Campos esperados:{' '}
          <code>
            talentName;platform;metric;unit;granularity;ibgeCode;periodStart;periodEnd;value;provenance;source
          </code>
          . Importar o mesmo relatório duas vezes atualiza o registro existente
          sem duplicar.
        </p>
        <div className="tools">
          <button type="button" onClick={downloadSampleCsv}>
            Baixar CSV de exemplo (fictício)
          </button>
          <label style={{ display: 'inline-block' }}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                await handleCsvUpload(text);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {importStatus && (
          <p className="note" role="status">
            {importStatus}
          </p>
        )}
      </details>
    </section>
  );
}
