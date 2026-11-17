import { useEffect, useMemo, useState } from 'react';
import {
  BRAZIL_REGIONS,
  DEFAULT_MUNICIPALITIES,
  RADIUS_PRESETS_KM,
  filterMunicipalitiesByGeo,
} from '../domain/geo-intelligence.js';
import { formatNumber } from '../domain/research.js';
import {
  getAudienceMap,
  getGeoMunicipalities,
  postAdminAudienceImport,
} from '../services/api.js';

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
  // Maps Brazil bounds: lon [-74, -34] -> x [20, 420], lat [5, -34] -> y [20, 410]
  const x = ((lon + 74) / 40) * 400 + 20;
  const y = ((5 - lat) / 39) * 390 + 20;
  return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
}

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
  const [municipalities, setMunicipalities] = useState(DEFAULT_MUNICIPALITIES);
  const [talentName, setTalentName] = useState('');
  const [platform, setPlatform] = useState('YouTube');
  const [metric, setMetric] = useState('visualizacoes');
  const [region, setRegion] = useState('all');
  const [uf, setUf] = useState('all');
  const [citySearch, setCitySearch] = useState('');
  const [centerMunicipalityId, setCenterMunicipalityId] = useState('4106902'); // Curitiba default
  const [radiusMode, setRadiusMode] = useState('150'); // 'none' | preset | 'custom'
  const [customRadiusKm, setCustomRadiusKm] = useState('150');
  const [perCapita, setPerCapita] = useState(false);

  const [audienceReport, setAudienceReport] = useState({
    items: [],
    byRegion: [],
    byState: [],
    coverageNotice: '',
  });
  const [localImportedRows, setLocalImportedRows] = useState([]);
  const [importStatus, setImportStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const effectiveRadiusKm = useMemo(() => {
    if (radiusMode === 'none') return null;
    const raw = radiusMode === 'custom' ? customRadiusKm : radiusMode;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [radiusMode, customRadiusKm]);

  useEffect(() => {
    const controller = new AbortController();
    getGeoMunicipalities({ signal: controller.signal })
      .then(data => {
        if (Array.isArray(data?.municipalities) && data.municipalities.length) {
          setMunicipalities(data.municipalities);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const availableUfs = useMemo(() => {
    if (region === 'all') {
      return BRAZIL_REGIONS.flatMap(r => r.ufs).sort();
    }
    return BRAZIL_REGIONS.find(r => r.code === region)?.ufs || [];
  }, [region]);

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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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

  // Combine backend rows with any locally imported rows (if running on serverless preview)
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

  const totalKnownInFilter = displayedAudienceItems.reduce(
    (s, x) => s + x.value,
    0
  );

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

  const centerCoords = geoFiltered.center
    ? projectToSvg(geoFiltered.center.latitude, geoFiltered.center.longitude)
    : null;
  const maxVal = Math.max(1, ...displayedAudienceItems.map(i => i.value));

  return (
    <section id="geoAudienceRadar" aria-label="Radar Geográfico de Audiência">
      <div className="research-panel">
        <h2 className="research-panel-title">
          Radar Geográfico de Audiência e Filtro por Raio (km)
        </h2>
        <p className="small" style={{ marginBottom: 16 }}>
          Localize a concentração de público por macrorregião, estado, município
          (código IBGE) e raio geodésico em linha reta (Haversine · WGS84).
          Métricas de plataformas diferentes possuem unidades distintas e nunca
          são somadas como se fossem pessoas únicas.
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
              <select
                value={metric}
                onChange={e => setMetric(e.target.value)}
              >
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
                <option value="all">Todos os estados</option>
                {availableUfs.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cidade de referência (IBGE)
              <select
                id="centerMunicipalitySelect"
                value={centerMunicipalityId}
                onChange={e => setCenterMunicipalityId(e.target.value)}
              >
                {municipalities.map(m => (
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
              Buscar município na lista
              <input
                type="search"
                placeholder="Nome, UF ou código IBGE…"
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
              onClick={() => handleCsvUpload(SAMPLE_AUDIENCE_CSV)}
            >
              Carregar exemplo piloto (Natiruts · Raio Curitiba/SP/POA)
            </button>
            <button
              type="button"
              onClick={() => {
                setTalentName('');
                setRegion('all');
                setUf('all');
                setRadiusMode('none');
                setCitySearch('');
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
            <span>municípios da base no recorte geográfico</span>
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
            'Distância geodésica em linha reta (fórmula de Haversine, WGS84). Ausência de relatório oficial aparece como Indisponível, nunca como zero.'}
        </p>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 1.4fr)',
          gap: '22px',
          alignItems: 'start',
        }}
      >
        <section className="panel">
          <h3>Mapa de concentração e raio geodésico</h3>
          <p className="small">
            {geoFiltered.center && effectiveRadiusKm !== null
              ? `Círculo de ${effectiveRadiusKm} km centrado em ${geoFiltered.center.name} (${geoFiltered.center.uf}).`
              : 'Visão nacional dos municípios cadastrados na base IBGE.'}
          </p>
          <svg
            viewBox="0 0 440 430"
            style={{
              width: '100%',
              height: 'auto',
              background: '#f0f6fb',
              borderRadius: '14px',
              border: '1px solid #c8dbea',
            }}
            role="img"
            aria-label="Mapa geográfico de municípios e raio de atuação"
          >
            {centerCoords && effectiveRadiusKm !== null && (
              <circle
                cx={centerCoords.x}
                cy={centerCoords.y}
                r={Math.max(6, (effectiveRadiusKm / 4000) * 380)}
                fill="#00b58b22"
                stroke="#008773"
                strokeWidth="1.8"
                strokeDasharray="4 3"
              />
            )}
            {geoFiltered.municipalities.map(m => {
              const pt = projectToSvg(m.latitude, m.longitude);
              const audItem = displayedAudienceItems.find(
                a => a.ibgeCode === m.ibge_code
              );
              const isCenter =
                geoFiltered.center &&
                m.ibge_code === geoFiltered.center.ibge_code;
              const radius = audItem
                ? 5 + (audItem.value / maxVal) * 14
                : isCenter
                  ? 6
                  : 3.5;
              const fill = audItem
                ? '#008773'
                : isCenter
                  ? '#102d4c'
                  : '#94a3b8';
              return (
                <g
                  key={m.ibge_code}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setCenterMunicipalityId(m.ibge_code)}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={radius}
                    fill={fill}
                    opacity={audItem ? 0.85 : 0.65}
                    stroke="#fff"
                    strokeWidth="1"
                  >
                    <title>
                      {`${m.name} (${m.uf}) · IBGE ${m.ibge_code}${
                        m.distanceKm !== null ? ` · ${m.distanceKm} km` : ''
                      }${
                        audItem
                          ? ` · ${platform} (${metric}): ${formatNumber(audItem.value)}`
                          : ' · Sem relatório de audiência'
                      }`}
                    </title>
                  </circle>
                  {(isCenter || audItem) && (
                    <text
                      x={pt.x}
                      y={pt.y - radius - 4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#102d4c"
                    >
                      {m.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="small" style={{ marginTop: 10 }}>
            Clique em qualquer município no mapa para defini-lo como cidade de
            referência do raio em km. Cinza indica município sem relatório de
            audiência carregado; verde indica audiência verificada/estimada.
          </p>
        </section>

        <section className="panel">
          <h3>
            Ranking de municípios no recorte ({geoFiltered.municipalities.length}{' '}
            cidades)
          </h3>
          <p className="small">
            Desambiguação oficial pelo código IBGE de 7 dígitos e UF. População
            e PIB per capita segundo o Censo IBGE 2022.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="discovery-report">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Município (UF) · IBGE</th>
                  <th>Distância</th>
                  <th>População (IBGE)</th>
                  <th>
                    {platform} · {metric}
                  </th>
                  <th>Por 100 mil hab.</th>
                  <th>Participação / Fonte</th>
                </tr>
              </thead>
              <tbody>
                {geoFiltered.municipalities.map((m, idx) => {
                  const aud = displayedAudienceItems.find(
                    a => a.ibgeCode === m.ibge_code
                  );
                  return (
                    <tr key={m.ibge_code}>
                      <td>{idx + 1}</td>
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
                        {m.population ? formatNumber(m.population) : '—'}
                      </td>
                      <td>
                        {aud ? (
                          <strong>{formatNumber(aud.value)}</strong>
                        ) : (
                          <span className="small">Indisponível</span>
                        )}
                      </td>
                      <td>
                        {aud?.per100kInhabitants != null
                          ? formatNumber(aud.per100kInhabitants)
                          : '—'}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
