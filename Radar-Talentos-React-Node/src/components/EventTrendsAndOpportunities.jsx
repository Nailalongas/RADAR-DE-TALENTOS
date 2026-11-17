import { useEffect, useMemo, useState } from 'react';
import {
  BRAZIL_REGIONS,
  DEFAULT_MUNICIPALITIES,
  EVENT_MODALITIES,
  RADIUS_PRESETS_KM,
  TICKETING_SOURCES,
} from '../domain/geo-intelligence.js';
import { formatDateBR, formatNumber } from '../domain/research.js';
import {
  getEventTrends,
  getGeoMunicipalities,
  getModalities,
  getOpportunities,
  getSourcesStatus,
  postAdminEventsImport,
} from '../services/api.js';

const SAMPLE_EVENTS_CSV = [
  'sourceId;externalId;url;title;originalCategory;attractionName;venueName;municipalityCode;eventDateStart;publishedAt;detectedAt;priceMin;priceMax;status',
  'diskingressos;dsk-101;https://www.diskingressos.com.br/evento/101;Natiruts Turnê Leve com Você;Show Nacional;Natiruts;Pedreira Paulo Leminski;4106902;2026-11-28;2026-10-05;2026-11-01;140;380;published',
  'eventim;evt-901;https://www.eventim.com.br/event/natiruts-101;Turnê Natiruts Leve com Você;Shows;Natiruts;Pedreira Paulo Leminski;4106902;2026-11-28;2026-10-05;2026-11-02;140;380;published',
  'diskingressos;dsk-102;https://www.diskingressos.com.br/evento/102;Noite de Stand-up Comedy Curitiba;Humor;Afonso Padilha;Teatro Positivo;4106902;2026-12-05;2026-10-20;2026-11-05;70;140;published',
  'ticketsports;tsp-301;https://www.ticketsports.com.br/e/maratona-curitiba-301;Maratona Internacional de Curitiba 42km;Corrida de Rua;Maratona de Curitiba;Praça Nossa Senhora de Salete;4106902;2026-11-22;2026-09-10;2026-11-01;180;290;published',
  'sympla;sym-401;https://www.sympla.com.br/evento/401;Congresso Sul-Brasileiro de Liderança e Vendas;Palestra e Congresso;Andrea Vermont;Expotrade Pinhais;4119152;2026-12-10;2026-10-15;2026-11-06;250;690;published',
  'uhuu;uhu-501;https://uhuu.com/evento/musical-familia-501;O Rei Leão · O Musical Infantil;Teatro e Musical;Companhia Musical;Teatro Guaíra;4106902;2026-12-14;2026-10-25;2026-11-08;90;220;published',
  'blueticket;blu-601;https://www.blueticket.com.br/e/601;Festival Sertanejo Joinville;Shows e Música;Luan Santana;Expoville;4209102;2026-12-19;2026-10-18;2026-11-09;120;350;published',
  'ticketmaster;tkm-701;https://www.ticketmaster.com.br/event/701;Natiruts Leve com Você São Paulo;Shows;Natiruts;Allianz Parque;3550308;2026-12-12;2026-09-15;2026-11-01;180;490;sold_out',
].join('\n');

export default function EventTrendsAndOpportunities() {
  const [modalities, setModalities] = useState(EVENT_MODALITIES);
  const [municipalities, setMunicipalities] = useState(DEFAULT_MUNICIPALITIES);
  const [sources, setSources] = useState(TICKETING_SOURCES);

  const [modalityId, setModalityId] = useState('all');
  const [submodalityId, setSubmodalityId] = useState('all');
  const [sourceId, setSourceId] = useState('all');
  const [region, setRegion] = useState('all');
  const [uf, setUf] = useState('all');
  const [centerMunicipalityId, setCenterMunicipalityId] = useState('4106902');
  const [radiusMode, setRadiusMode] = useState('300');
  const [dateBasis, setDateBasis] = useState('realization');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [opportunityTalent, setOpportunityTalent] = useState('Natiruts');

  const [trends, setTrends] = useState({
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
  });
  const [opportunities, setOpportunities] = useState({
    thresholds: { audienceMedian: 0, eventsMedian: 0 },
    evaluatedCount: 0,
    insufficientCount: 0,
    items: [],
  });
  const [importStatus, setImportStatus] = useState('');

  const effectiveRadiusKm = useMemo(() => {
    if (radiusMode === 'none') return null;
    const n = Number(radiusMode);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [radiusMode]);

  useEffect(() => {
    const controller = new AbortController();
    getModalities(controller.signal)
      .then(d => {
        if (Array.isArray(d?.modalities) && d.modalities.length) {
          setModalities(d.modalities);
        }
      })
      .catch(() => {});
    getGeoMunicipalities({ signal: controller.signal })
      .then(d => {
        if (Array.isArray(d?.municipalities) && d.municipalities.length) {
          setMunicipalities(d.municipalities);
        }
      })
      .catch(() => {});
    getSourcesStatus(controller.signal)
      .then(d => {
        if (Array.isArray(d?.sources) && d.sources.length) {
          setSources(d.sources);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const selectedModalityObj = useMemo(
    () => modalities.find(m => m.id === modalityId),
    [modalities, modalityId]
  );

  async function refreshAll() {
    const commonGeo = {
      modalityId,
      submodalityId,
      sourceId,
      region: region === 'all' ? '' : region,
      uf: uf === 'all' ? '' : uf,
      centerMunicipalityId:
        effectiveRadiusKm !== null ? centerMunicipalityId : '',
      radiusKm: effectiveRadiusKm ?? '',
      dateBasis,
      dateFrom,
      dateTo,
    };
    const [trendsData, oppData, srcStatus] = await Promise.all([
      getEventTrends(commonGeo),
      getOpportunities({
        talentName: opportunityTalent,
        platform: 'YouTube',
        metric: 'visualizacoes',
        modalityId,
        region: region === 'all' ? '' : region,
        uf: uf === 'all' ? '' : uf,
        centerMunicipalityId:
          effectiveRadiusKm !== null ? centerMunicipalityId : '',
        radiusKm: effectiveRadiusKm ?? '',
      }),
      getSourcesStatus(),
    ]);
    setTrends(trendsData);
    setOpportunities(oppData);
    if (Array.isArray(srcStatus?.sources)) setSources(srcStatus.sources);
  }

  useEffect(() => {
    refreshAll();
  }, [
    modalityId,
    submodalityId,
    sourceId,
    region,
    uf,
    centerMunicipalityId,
    effectiveRadiusKm,
    dateBasis,
    dateFrom,
    dateTo,
    opportunityTalent,
  ]);

  async function handleImportEventsCsv(text) {
    const lines = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split(/\r?\n/)
      .filter(l => l.trim());
    if (lines.length < 2) return;
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines
      .shift()
      .split(sep)
      .map(h => h.trim());
    const rows = lines.map(line => {
      const cols = line.split(sep).map(c => c.trim());
      return Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
    });

    try {
      const res = await postAdminEventsImport(rows);
      setImportStatus(
        `Eventos processados: ${res.createdEvents} eventos únicos criados, ${res.mergedDuplicates} anúncios mesclados por deduplicação entre plataformas, ${res.updatedListings} atualizados.`
      );
      await refreshAll();
    } catch (err) {
      setImportStatus(`Não foi possível importar no servidor: ${err.message}`);
    }
  }

  function downloadSampleEventsCsv() {
    const blob = new Blob(['\ufeff' + SAMPLE_EVENTS_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-eventos-plataformas.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section
      id="eventTrendsAndOpportunities"
      aria-label="Radar de Tendências de Eventos e Oportunidades"
    >
      <div className="research-panel">
        <h2 className="research-panel-title">
          Radar de Tendências de Eventos, Modalidades e Oportunidades Comerciais
        </h2>
        <p className="small" style={{ marginBottom: 16 }}>
          Monitoramento da oferta publicada nas 10 plataformas de ingressos
          (Sympla, Eventim, Ticketmaster, Ingresse, Ticket Sports, Ticket360,
          Blueticket, Disk Ingressos, Bilheteria Digital e Uhuu).{' '}
          <strong>Importante:</strong> quantidade de eventos publicados mede a
          oferta das categorias por região/raio e não equivale a vendas efetivas
          de ingressos.
        </p>

        <div className="persistent-filters">
          <div className="filters">
            <label>
              Modalidade de evento
              <select
                id="eventModalitySelect"
                value={modalityId}
                onChange={e => {
                  setModalityId(e.target.value);
                  setSubmodalityId('all');
                }}
              >
                <option value="all">Todas as modalidades (12)</option>
                {modalities.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Submodalidade
              <select
                value={submodalityId}
                onChange={e => setSubmodalityId(e.target.value)}
                disabled={!selectedModalityObj}
              >
                <option value="all">Todas as submodalidades</option>
                {(selectedModalityObj?.submodalities || []).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Plataforma de ingressos
              <select
                value={sourceId}
                onChange={e => setSourceId(e.target.value)}
              >
                <option value="all">Todas as 10 plataformas</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.segment})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Critério de data
              <select
                value={dateBasis}
                onChange={e => setDateBasis(e.target.value)}
              >
                <option value="realization">Data de realização do evento</option>
                <option value="publication">
                  Data de publicação / 1ª detecção
                </option>
              </select>
            </label>

            <label>
              Região
              <select
                value={region}
                onChange={e => {
                  setRegion(e.target.value);
                  setUf('all');
                }}
              >
                <option value="all">Brasil inteiro</option>
                {BRAZIL_REGIONS.map(r => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cidade de referência
              <select
                value={centerMunicipalityId}
                onChange={e => setCenterMunicipalityId(e.target.value)}
              >
                {municipalities.map(m => (
                  <option key={m.municipality_code} value={m.municipality_code}>
                    {m.name} ({m.uf})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Raio em km
              <select
                value={radiusMode}
                onChange={e => setRadiusMode(e.target.value)}
              >
                <option value="none">País inteiro (sem raio)</option>
                {RADIUS_PRESETS_KM.map(km => (
                  <option key={km} value={String(km)}>
                    Até {km} km
                  </option>
                ))}
              </select>
            </label>

            <label>
              Talento para cruzar Oportunidades
              <input
                type="search"
                value={opportunityTalent}
                onChange={e => setOpportunityTalent(e.target.value)}
                placeholder="Ex.: Natiruts"
              />
            </label>
          </div>
        </div>

        <div className="tools">
          <button
            type="button"
            className="primary"
            onClick={() => handleImportEventsCsv(SAMPLE_EVENTS_CSV)}
          >
            Carregar amostra de eventos publicados (Shows, Humor, Corridas,
            Palestras e Teatro)
          </button>
          <button type="button" onClick={downloadSampleEventsCsv}>
            Baixar modelo CSV de eventos
          </button>
        </div>
        {importStatus && (
          <p className="note" role="status" style={{ marginTop: 12 }}>
            {importStatus}
          </p>
        )}
      </div>

      <section className="result-summary" aria-label="Indicadores de oferta">
        <div className="summary-grid">
          <div className="summary-card">
            <strong>{formatNumber(trends.summary.uniqueEvents)}</strong>
            <span>eventos únicos (deduplicados)</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(trends.summary.totalListings)}</strong>
            <span>anúncios nas plataformas</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(trends.summary.newlyDetected)}</strong>
            <span>novos eventos detectados</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(trends.summary.activeModalities)}</strong>
            <span>modalidades com oferta</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(trends.summary.coveredMunicipalities)}</strong>
            <span>municípios com eventos</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(trends.summary.activeSources)}</strong>
            <span>plataformas com anúncios</span>
          </div>
        </div>
        <p className="summary-note">
          Um mesmo evento anunciado em duas plataformas (ex.: Disk Ingressos e
          Eventim) conta como <b>1 evento único</b> no ranking geral e preserva
          as duas origens.
        </p>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '22px',
        }}
      >
        <section className="panel">
          <h3>Ranking de Modalidades mais publicadas</h3>
          <p className="small">
            Participação sobre o total de eventos únicos no recorte selecionado.
          </p>
          {trends.byModality.length === 0 ? (
            <p className="empty">
              Nenhum evento publicado encontrado para estes filtros. Clique em
              “Carregar amostra de eventos publicados” acima ou importe um CSV.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Modalidade</th>
                  <th>Eventos únicos</th>
                  <th>Anúncios</th>
                  <th>Participação</th>
                </tr>
              </thead>
              <tbody>
                {trends.byModality.map(m => (
                  <tr key={m.modalityId}>
                    <td>
                      <b>{m.modalityName}</b>
                    </td>
                    <td>{formatNumber(m.uniqueEvents)}</td>
                    <td>{formatNumber(m.listingsCount)}</td>
                    <td>
                      <span className="badge">{m.sharePct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h3>Oferta por Plataforma de Ingressos e Cidades</h3>
          {trends.byPlatform.length > 0 && (
            <>
              <h4>Plataformas com eventos no recorte</h4>
              <div className="chips" style={{ marginBottom: 16 }}>
                {trends.byPlatform.map(p => (
                  <span key={p.sourceId} className="badge">
                    {p.sourceName}: <b>{p.uniqueEventsOnPlatform}</b> evento(s)
                  </span>
                ))}
              </div>
            </>
          )}
          <h4>Ranking de cidades por oferta publicada</h4>
          {trends.byCity.length === 0 ? (
            <p className="small">Sem eventos georreferenciados no recorte.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Município (UF)</th>
                  <th>Distância</th>
                  <th>Eventos únicos</th>
                  <th>Por 100 mil hab.</th>
                </tr>
              </thead>
              <tbody>
                {trends.byCity.map(c => (
                  <tr key={c.municipalityCode}>
                    <td>
                      <b>
                        {c.cityName} ({c.uf})
                      </b>
                    </td>
                    <td>
                      {c.distanceKm != null ? `${c.distanceKm} km` : '—'}
                    </td>
                    <td>{formatNumber(c.uniqueEvents)}</td>
                    <td>{c.eventsPer100k ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 22 }}>
        <h3>Eventos únicos monitorados e origens deduplicadas</h3>
        {trends.events.length === 0 ? (
          <p className="small">Nenhum evento listado neste recorte.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="discovery-report">
              <thead>
                <tr>
                  <th>Data realização</th>
                  <th>Evento / Atração</th>
                  <th>Modalidade / Submodalidade</th>
                  <th>Município / Local</th>
                  <th>Faixa de preço</th>
                  <th>Plataformas (Anúncios vinculados)</th>
                </tr>
              </thead>
              <tbody>
                {trends.events.map(ev => (
                  <tr key={ev.id}>
                    <td>{formatDateBR(ev.event_date_start)}</td>
                    <td>
                      <b>{ev.title}</b>
                      {ev.attraction_name && (
                        <>
                          <br />
                          <small>Atração: {ev.attraction_name}</small>
                        </>
                      )}
                    </td>
                    <td>
                      <span className="category-label">{ev.modality_name}</span>
                      <p className="topic-label">
                        {ev.submodality_name || 'Geral'} · Confiança:{' '}
                        {ev.classification_confidence}
                      </p>
                    </td>
                    <td>
                      {ev.city_name ? `${ev.city_name} (${ev.uf})` : 'Online'}
                      {ev.venue_name && (
                        <>
                          <br />
                          <small>{ev.venue_name}</small>
                        </>
                      )}
                    </td>
                    <td>
                      {ev.is_free
                        ? 'Gratuito'
                        : ev.price_min != null
                          ? `R$ ${ev.price_min} – R$ ${ev.price_max ?? ev.price_min}`
                          : 'Não informado'}
                    </td>
                    <td>
                      {(ev.listings || []).map(l => (
                        <div key={l.id}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {l.source_name} ↗
                          </a>
                          {l.original_category && (
                            <small> ({l.original_category})</small>
                          )}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 22 }}>
        <h3>
          Radar de Oportunidades Comerciais (Cruzamento Audiência × Oferta de
          Eventos)
        </h3>
        <p className="small">
          Matriz conceitual por município do recorte para{' '}
          <b>{opportunityTalent || 'Todos os talentos'}</b>. Municípios sem
          cobertura de uma das fontes permanecem identificados como{' '}
          <i>Cobertura insuficiente para cruzamento</i> (ausência de dado nunca
          é tratada como baixa audiência ou zero).
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="discovery-report">
            <thead>
              <tr>
                <th>Município (UF)</th>
                <th>Distância</th>
                <th>Audiência conhecida</th>
                <th>Eventos publicados</th>
                <th>Classificação na Matriz de Oportunidades</th>
                <th>Justificativa e Limitações</th>
              </tr>
            </thead>
            <tbody>
              {(opportunities.items || []).slice(0, 15).map(item => (
                <tr key={item.municipalityCode}>
                  <td>
                    <b>
                      {item.cityName} ({item.uf})
                    </b>
                    <br />
                    <small>Código {item.municipalityCode}</small>
                  </td>
                  <td>
                    {item.distanceKm != null ? `${item.distanceKm} km` : '—'}
                  </td>
                  <td>
                    {item.audience != null
                      ? formatNumber(item.audience)
                      : 'Indisponível'}
                  </td>
                  <td>
                    {item.eventsCount != null
                      ? formatNumber(item.eventsCount)
                      : 'Indisponível'}
                  </td>
                  <td>
                    <span className="badge">{item.classification}</span>
                  </td>
                  <td>
                    <small>{item.explanation}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <details className="panel" style={{ marginTop: 22 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Status das 10 Fontes de Ingressos Cadastradas
        </summary>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Plataforma</th>
                <th>Segmento de interesse</th>
                <th>Estado do adaptador</th>
                <th>Anúncios salvos</th>
                <th>Observação de cobertura</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => (
                <tr key={s.id}>
                  <td>
                    <a
                      href={s.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <b>{s.name}</b> ↗
                    </a>
                  </td>
                  <td>{s.segment}</td>
                  <td>
                    <span className="badge">{s.integrationState}</span>
                  </td>
                  <td>{formatNumber(s.listingsCount || 0)}</td>
                  <td>
                    <small>{s.coverageNote}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
