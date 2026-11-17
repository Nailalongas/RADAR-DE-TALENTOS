import { useEffect, useState } from 'react';
import GeoMap from './GeoMap.jsx';

const initialFilters = {
  network: 'YouTube',
  metric: 'views',
  modality: '',
  region: '',
  uf: '',
  center: '',
  radius: '',
};

const fmt = n => (n == null ? '—' : n.toLocaleString('pt-BR'));

export default function OpportunitiesRadar() {
  const [f, setF] = useState(initialFilters);
  const [mods, setMods] = useState([]);
  const [geo, setGeo] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) =>
    setF(prev => ({
      ...prev,
      [k]: v,
      ...(k === 'network'
        ? {
            metric:
              { YouTube: 'views', Instagram: 'followers', Spotify: 'listeners' }[
                v
              ] || 'views',
          }
        : {}),
    }));

  async function queryOpportunities(customFilters = f) {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams(
        Object.entries(customFilters).filter(([, v]) => v !== '')
      );
      const res = await fetch('/api/opportunities/intelligence?' + params);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na consulta');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/radar/modalities').then(r => r.json()),
      fetch('/api/radar/geography').then(r => r.json()),
    ])
      .then(([m, g]) => {
        if (Array.isArray(m)) setMods(m);
        if (g) setGeo(g);
      })
      .catch(() => {});
    queryOpportunities(initialFilters);
  }, []);

  function exportProducerReportCSV() {
    if (!result?.promisingCities?.length) return;
    const header = [
      'Posicao',
      'Cidade',
      'UF',
      'Regiao',
      'Score_Oportunidade',
      'Audiencia_Conhecida',
      'Eventos_Observados',
      'Relacao_Audiencia_Por_Evento',
      'Classificacao_Comercial',
    ].join(';');
    const lines = result.promisingCities.map((c, idx) =>
      [
        idx + 1,
        `"${c.name}"`,
        c.uf,
        c.region,
        c.opportunity_score,
        c.audience,
        c.events_count,
        c.demand_per_event,
        `"${c.classification}"`,
      ].join(';')
    );
    const blob = new Blob(['\ufeff' + [header, ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-estrategico-produtoras-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section>
      <div className="sectionhead">
        <div>
          <h2>Radar de Oportunidades — Inteligência Comercial Integrada (Fase 5)</h2>
          <p>
            Cruzamento entre audiência municipal verificada (Fase 4), malha geográfica (Fase 2) e oferta observada nas 10 plataformas de ingressos (Fase 3).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="primary"
            onClick={() => {
              const cwb = { ...f, center: '4106902', radius: '150', uf: '' };
              setF(cwb);
              queryOpportunities(cwb);
            }}
          >
            Raio 150 km · Curitiba (PR/SC)
          </button>
          <button type="button" onClick={exportProducerReportCSV}>
            Exportar Relatório para Produtoras (CSV)
          </button>
        </div>
      </div>

      <fieldset disabled={busy}>
        <legend>Filtros de Inteligência Comercial</legend>
        <div className="filters">
          <label>
            Rede de audiência
            <select
              value={f.network}
              onChange={e => set('network', e.target.value)}
            >
              <option value="YouTube">YouTube</option>
              <option value="Instagram">Instagram</option>
              <option value="Spotify">Spotify</option>
            </select>
          </label>
          <label>
            Métrica regional
            <select
              value={f.metric}
              onChange={e => set('metric', e.target.value)}
            >
              {(
                {
                  YouTube: ['views', 'subscribers'],
                  Instagram: ['followers', 'reach', 'views'],
                  Spotify: ['listeners', 'streams'],
                }[f.network] || ['views']
              ).map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modalidade de evento
            <select
              value={f.modality}
              onChange={e => set('modality', e.target.value)}
            >
              <option value="">Todas as modalidades</option>
              {mods.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Região
            <select
              value={f.region}
              onChange={e => set('region', e.target.value)}
            >
              <option value="">Brasil (Todas)</option>
              {['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'].map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado (UF)
            <select value={f.uf} onChange={e => set('uf', e.target.value)}>
              <option value="">Todos</option>
              {'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'
                .split(' ')
                .map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Centro do raio (código municipal)
            <input
              value={f.center}
              placeholder="Ex.: 4106902 (Curitiba)"
              onChange={e => set('center', e.target.value)}
            />
          </label>
          <label>
            Raio de atuação (km)
            <input
              type="number"
              min="0"
              max="10000"
              placeholder="Ex.: 150"
              value={f.radius}
              onChange={e => set('radius', e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" onClick={() => queryOpportunities(f)}>
            {busy ? 'Calculando oportunidades…' : 'Cruzar Audiência × Oferta'}
          </button>
          <button
            type="button"
            onClick={() => {
              setF(initialFilters);
              queryOpportunities(initialFilters);
            }}
          >
            Limpar recorte
          </button>
        </div>
      </fieldset>

      {error && <p role="alert">{error}</p>}

      {result && (
        <>
          <div className="summary-grid" style={{ marginTop: 18 }}>
            <div className="summary-card">
              <strong>{result.promisingCities.length}</strong>
              <span>Praças comerciais avaliadas</span>
            </div>
            <div className="summary-card">
              <strong>{result.highDemandLowSupply.length}</strong>
              <span>Cidades com muita audiência e baixa oferta</span>
            </div>
            <div className="summary-card">
              <strong>
                {result.promisingCities[0]
                  ? `${result.promisingCities[0].name}/${result.promisingCities[0].uf}`
                  : '—'}
              </strong>
              <span>Praça #1 mais promissora no recorte</span>
            </div>
            <div className="summary-card">
              <strong>
                {result.modalityPotential[0]?.name || 'Shows e música'}
              </strong>
              <span>Modalidade líder em potencial regional</span>
            </div>
          </div>

          <p className="note" style={{ marginTop: 14 }}>
            {result.notice}
          </p>

          <h3>Mapa de oportunidades por raio de atuação</h3>
          <GeoMap
            geo={geo}
            result={result}
            onState={ufVal => {
              const next = { ...f, uf: ufVal };
              setF(next);
              queryOpportunities(next);
            }}
            onCity={codeVal => {
              const next = {
                ...f,
                center: codeVal,
                radius: f.radius || '150',
              };
              setF(next);
              queryOpportunities(next);
            }}
            label="Potencial de audiência comercial"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
              gap: 22,
              marginTop: 22,
            }}
          >
            <div
              style={{
                border: '1px solid #d6e3ea',
                borderRadius: 12,
                padding: 18,
                background: '#f8fbfd',
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                1. Ranking das cidades mais promissoras (Score 0–100)
              </h3>
              {result.promisingCities.slice(0, 10).map((c, idx) => (
                <div className="bar-row" key={c.code}>
                  <span>
                    <strong>#{idx + 1}</strong> {c.name}/{c.uf}
                  </span>
                  <progress max={100} value={c.opportunity_score} />
                  <span>
                    <strong>{c.opportunity_score} pts</strong>
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                border: '1px solid #d6e3ea',
                borderRadius: 12,
                padding: 18,
                background: '#f8fbfd',
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                2. Modalidades por potencial regional (Audiência / Oferta)
              </h3>
              {result.modalityPotential.map(m => (
                <div className="bar-row" key={m.id}>
                  <span>
                    {m.name} <small>({m.events} ev.)</small>
                  </span>
                  <progress
                    max={Math.max(
                      1,
                      ...result.modalityPotential.map(x => x.value)
                    )}
                    value={m.value}
                  />
                  <span>{fmt(m.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <h3 style={{ marginTop: 26 }}>
            3. Regiões com muita audiência e pouca oferta (Oportunidades prioritárias)
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
              marginBottom: 22,
            }}
          >
            {result.highDemandLowSupply.slice(0, 8).map(c => (
              <div
                key={c.code}
                style={{
                  border: '1px solid #86efac',
                  background: '#f0fdf4',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <strong style={{ color: '#14532d', fontSize: 16 }}>
                  {c.name} ({c.uf})
                </strong>
                <div style={{ fontSize: 13, color: '#166534', marginTop: 6 }}>
                  Audiência conhecida: <strong>{fmt(c.audience)}</strong>
                </div>
                <div style={{ fontSize: 13, color: '#166534' }}>
                  Eventos publicados: <strong>{c.events_count}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#15803d', marginTop: 6 }}>
                  Score comercial: <strong>{c.opportunity_score}/100</strong>
                </div>
              </div>
            ))}
          </div>

          <h3>4. Comparativo de praças comerciais</h3>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Praça / Município</th>
                  <th>Região</th>
                  <th>Distância do centro</th>
                  <th>Audiência conhecida ({result.metric})</th>
                  <th>Eventos observados</th>
                  <th>Relação Audiência / Evento</th>
                  <th>Score</th>
                  <th>Diagnóstico para Produtoras</th>
                </tr>
              </thead>
              <tbody>
                {result.promisingCities.map((c, idx) => (
                  <tr key={c.code}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong>
                        {c.name}/{c.uf}
                      </strong>
                    </td>
                    <td>{c.region}</td>
                    <td>
                      {c.distance_km != null ? `${c.distance_km} km` : '—'}
                    </td>
                    <td>{fmt(c.audience)}</td>
                    <td>{c.events_count}</td>
                    <td>{fmt(c.demand_per_event)}</td>
                    <td>
                      <strong>{c.opportunity_score}/100</strong>
                    </td>
                    <td>{c.classification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 26 }}>
            5. Índice de oportunidades por artista (Alocação de Turnês e Shows)
          </h3>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Artista / Talento</th>
                  <th>Praça recomendada</th>
                  <th>Região</th>
                  <th>Audiência na cidade</th>
                  <th>Eventos concorrentes</th>
                  <th>Índice de Oportunidade</th>
                  <th>Recomendação Estratégica</th>
                </tr>
              </thead>
              <tbody>
                {result.artistOpportunities.slice(0, 18).map((row, idx) => (
                  <tr key={`${row.talent_id}-${row.municipality_code}-${idx}`}>
                    <td>
                      <strong>{row.talent_name}</strong>
                    </td>
                    <td>
                      {row.city_name}/{row.uf}
                    </td>
                    <td>{row.region}</td>
                    <td>{fmt(row.audience)}</td>
                    <td>{row.events_in_city}</td>
                    <td>
                      <strong>{row.opportunity_index}/100</strong>
                    </td>
                    <td>{row.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
