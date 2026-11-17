import { useEffect, useState } from 'react';

const NETWORK_COLORS = {
  YouTube: { border: '#ed252a', bg: '#fff5f5', badge: '#fee2e2', text: '#991b1b', icon: '▶' },
  Instagram: { border: '#b436b5', bg: '#fdf4ff', badge: '#fae8ff', text: '#86198f', icon: '◎' },
  Spotify: { border: '#1db954', bg: '#f0fdf4', badge: '#dcfce7', text: '#166534', icon: '♫' },
};

const STATUS_LABELS = {
  success: 'Completa declarada',
  partial: 'Parcial',
  empty: 'Sem linhas',
  failed: 'Falhou',
};

export default function AudienceStatus() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    fetch('/api/audience/status', { signal: c.signal })
      .then(r => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setData)
      .catch(e => {
        if (e.name !== 'AbortError') setError(true);
      });
    return () => c.abort();
  }, []);

  const maxRecords = data ? Math.max(1, ...data.map(r => r.records || 0)) : 1;

  return (
    <section>
      <div className="sectionhead">
        <div>
          <h2>Central de Audiência — Integrações Regionais (Fase 4)</h2>
          <p>
            Relatórios autorizados (YouTube Analytics, Instagram Insights e Spotify for Artists) ou estimativas identificadas. Ausência de informação não significa ausência de público.
          </p>
        </div>
        <span className="badge">Fase 4 · 3 redes monitoradas</span>
      </div>

      {error ? (
        <p role="alert">Não foi possível consultar a cobertura.</p>
      ) : !data ? (
        <p>Consultando cobertura…</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 16,
              margin: '18px 0',
            }}
          >
            {data.map(r => {
              const theme = NETWORK_COLORS[r.network] || NETWORK_COLORS.YouTube;
              const hasData = r.records > 0;
              return (
                <div
                  key={r.network}
                  style={{
                    border: `1px solid ${theme.border}44`,
                    borderTop: `4px solid ${theme.border}`,
                    borderRadius: 14,
                    padding: 18,
                    background: '#fff',
                    boxShadow: '0 4px 12px rgba(16,43,76,0.05)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <strong style={{ fontSize: 18, color: '#102b4c' }}>
                      <span style={{ color: theme.border, marginRight: 8 }}>
                        {theme.icon}
                      </span>
                      {r.source}
                    </strong>
                    <span
                      style={{
                        background: hasData ? '#dcfce7' : '#f1f5f9',
                        color: hasData ? '#166534' : '#475569',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {hasData ? 'Dados importados' : 'Aguardando dados'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 10,
                      textAlign: 'center',
                      background: theme.bg,
                      padding: 12,
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <small style={{ color: '#64748b', display: 'block' }}>
                        Contas
                      </small>
                      <strong style={{ fontSize: 20, color: '#102b4c' }}>
                        {r.confirmed_accounts > 0
                          ? r.confirmed_accounts.toLocaleString('pt-BR')
                          : '—'}
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: '#64748b', display: 'block' }}>
                        Municípios
                      </small>
                      <strong style={{ fontSize: 20, color: '#102b4c' }}>
                        {r.cities > 0 ? r.cities.toLocaleString('pt-BR') : '—'}
                      </strong>
                    </div>
                    <div>
                      <small style={{ color: '#64748b', display: 'block' }}>
                        Registros
                      </small>
                      <strong style={{ fontSize: 20, color: '#102b4c' }}>
                        {r.records > 0 ? r.records.toLocaleString('pt-BR') : '—'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="bar-row" style={{ gridTemplateColumns: '90px 1fr 60px' }}>
                      <span style={{ fontSize: 12, color: '#475569' }}>Volume</span>
                      <progress max={maxRecords} value={r.records || 0} />
                      <span style={{ fontSize: 12, textAlign: 'right' }}>
                        {(r.records || 0).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <small style={{ color: '#64748b', display: 'block', marginTop: 6 }}>
                      Última execução:{' '}
                      {r.last
                        ? `${r.last.created_at.slice(0, 10)} · ${STATUS_LABELS[r.last.status] || r.last.status} (${r.last.unresolved} não resolvidas)`
                        : 'Via carga piloto verificada'}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Fonte</th>
                  <th>Rede</th>
                  <th>Contas confirmadas</th>
                  <th>Municípios com dados</th>
                  <th>Registros</th>
                  <th>Última importação</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.network}>
                    <td>
                      <strong>{r.source}</strong>
                    </td>
                    <td>{r.network}</td>
                    <td>{r.confirmed_accounts.toLocaleString('pt-BR')}</td>
                    <td>{r.cities.toLocaleString('pt-BR')}</td>
                    <td>{r.records.toLocaleString('pt-BR')}</td>
                    <td>
                      {r.last
                        ? `${r.last.created_at.slice(0, 10)} — ${STATUS_LABELS[r.last.status]} (${r.last.unresolved} cidades não resolvidas)`
                        : 'Não realizada'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="small" style={{ marginTop: 12 }}>
        YouTube: coleta autorizada via CLI (<code>npm run audience:import -- youtube youtube.json</code>). Instagram e Spotify: importação de relatórios (<code>npm run audience:import -- report report.json</code>). Consulte <code>docs/fase-4-audiencia.md</code>.
      </p>
    </section>
  );
}
