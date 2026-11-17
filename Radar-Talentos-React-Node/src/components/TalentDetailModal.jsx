import { useState } from 'react';
import { topicLabels } from '../domain/taxonomy.js';
import {
  DAILY_PAGE_SIZE,
  brazilToday,
  dailyChangeLabel,
  dailyEvolutionData,
  dailyEvolutionPage,
  dailyEvolutionWindow,
  discoveryEvolutionModel,
  formatDateBR,
  formatNumber,
  growthPct,
  profileURL,
  shiftDate,
} from '../domain/research.js';

const NETWORK_COLORS = {
  Instagram: '#a855f7',
  YouTube: '#e64646',
  Spotify: '#1db954',
};

function ProfileExternalLink({ rede, profile, allRows }) {
  const url = profileURL({ rede, end: profile, start: profile }, allRows);
  if (!url) return <span className="small">Link não informado</span>;
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      href={url}
      aria-label={
        rede === 'YouTube'
          ? 'Abrir canal do YouTube'
          : rede
            ? `Abrir perfil no ${rede}`
            : 'Abrir perfil'
      }
    >
      {rede === 'YouTube' ? 'Abrir canal ↗' : 'Abrir perfil ↗'}
    </a>
  );
}

function AudienceComparisonSection({ networks }) {
  const entries = (networks || []).map(n => {
    const hist = [...(n.hist || [])]
      .filter(r => Number.isFinite(r.seguidores) && !r.collectionPending)
      .sort((a, b) => a.data.localeCompare(b.data));
    return { rede: n.rede, first: hist[0], last: hist.at(-1) };
  });
  const maximum = Math.max(
    1,
    ...entries.flatMap(n => [
      n.first?.seguidores || 0,
      n.last?.seguidores || 0,
    ])
  );
  const signed = v => `${v > 0 ? '+' : ''}${formatNumber(v)}`;
  let totalGain = 0;
  let compared = 0;

  return (
    <section className="discovery-card" id="discoveryEvolutionChart">
      <h3>Evolução das redes</h3>
      <p className="small">
        Público inicial → público atual · valores sempre visíveis. Mesma escala
        nas duas redes.
      </p>
      {entries.map(n => {
        const color = NETWORK_COLORS[n.rede] || '#64748b';
        const valid = Boolean(
          n.first && n.last && n.first.data < n.last.data
        );
        const gain = valid ? n.last.seguidores - n.first.seguidores : null;
        if (valid) {
          totalGain += gain;
          compared++;
        }
        return (
          <section key={n.rede} className="audience-comparison-network">
            <h4 style={{ color }}>{n.rede}</h4>
            {[
              ['Inicial', n.first, 0.3],
              ['Atual', n.last, 1],
            ].map(([label, row, opacity]) => (
              <div key={label} className="audience-comparison-row">
                <div>
                  <b>{label}</b>
                  <small>{row?.data ? formatDateBR(row.data) : 'Sem coleta'}</small>
                </div>
                <div className="audience-comparison-track">
                  <span
                    style={{
                      display: 'block',
                      width: `${row ? (Math.max(0, row.seguidores) / maximum) * 100 : 0}%`,
                      height: '18px',
                      background: color,
                      opacity,
                      borderRadius: '5px',
                    }}
                  />
                </div>
                <strong>
                  {row ? formatNumber(row.seguidores) : 'Aguardando coleta'}
                </strong>
              </div>
            ))}
            <p className="audience-comparison-change" style={{ color }}>
              {valid
                ? `${signed(gain)} ${n.rede === 'YouTube' ? 'inscritos' : 'seguidores'} · ${
                    n.first.seguidores > 0
                      ? growthPct((gain / n.first.seguidores) * 100)
                      : 'Percentual indisponível'
                  }`
                : 'Aguardando nova coleta para comparar'}
            </p>
          </section>
        );
      })}
      <p className="audience-comparison-total">
        Variação total das redes comparáveis:{' '}
        <b>{compared ? signed(totalGain) : '—'}</b>
      </p>
      <p className="small">
        Cada rede possui sua própria data inicial. Soma de contas, não de
        pessoas únicas. Redes sem duas coletas não entram na variação total.
      </p>
    </section>
  );
}

function PercentEvolutionSection({ networks, start, end }) {
  const series = (networks || [])
    .map(n => {
      const baseline = n.hist?.[0];
      return baseline && baseline.seguidores > 0
        ? {
            ...n,
            points: n.hist.map(r => ({
              data: r.data,
              value:
                ((r.seguidores - baseline.seguidores) / baseline.seguidores) *
                100,
              followers: r.seguidores,
            })),
          }
        : null;
    })
    .filter(Boolean);

  const excluded = (networks || []).length - series.length;
  if (!series.length) {
    return (
      <section className="discovery-card" id="discoveryPercentChart">
        <h3>Evolução em %</h3>
        <p>
          Ainda sem dados suficientes: falta uma coleta válida no início do
          período ({start}).
        </p>
      </section>
    );
  }

  const values = series.flatMap(n => n.points.map(p => p.value));
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const min = lo - (hi === lo ? 0.5 : span * 0.1);
  const max = hi + (hi === lo ? 0.5 : span * 0.1);
  const time = d => Date.parse(`${d}T12:00:00Z`);
  const px = d =>
    62 + ((time(d) - time(start)) / Math.max(1, time(end) - time(start))) * 350;
  const py = v => 170 - ((v - min) / (max - min)) * 140;
  const ticks = [min, (min + max) / 2, max, 0].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  return (
    <section className="discovery-card" id="discoveryPercentChart">
      <h3>Evolução em %</h3>
      <p className="small">
        Cada rede começa em 0% na sua primeira coleta válida. Datas iniciais
        podem ser diferentes.
      </p>
      <svg
        viewBox="0 0 440 205"
        style={{ height: 'auto' }}
        role="img"
        aria-label="Evolução percentual das redes"
      >
        <title>Crescimento percentual desde o início do período</title>
        {ticks.map(v => (
          <g key={v}>
            <line
              x1="62"
              x2="412"
              y1={py(v)}
              y2={py(v)}
              stroke={v === 0 ? '#94a3b8' : '#e3e9f0'}
            />
            <text
              x="55"
              y={py(v) + 4}
              textAnchor="end"
              fontSize="10"
              fill="#64748b"
            >
              {growthPct(v)}
            </text>
          </g>
        ))}
        {series.map(n => (
          <g key={n.rede}>
            <polyline
              points={n.points.map(p => `${px(p.data)},${py(p.value)}`).join(' ')}
              fill="none"
              stroke={NETWORK_COLORS[n.rede]}
              strokeWidth="2.5"
            />
            {n.points.map(p => (
              <circle
                key={`${n.rede}-${p.data}`}
                cx={px(p.data)}
                cy={py(p.value)}
                r="3.5"
                fill={NETWORK_COLORS[n.rede]}
              >
                <title>
                  {`${n.rede} · ${p.data} · ${growthPct(p.value)} · ${formatNumber(p.followers)}`}
                </title>
              </circle>
            ))}
          </g>
        ))}
        <text x="62" y="196" fill="#64748b" fontSize="10">
          {start}
        </text>
        <text x="412" y="196" textAnchor="end" fill="#64748b" fontSize="10">
          {end}
        </text>
      </svg>
      <div className="chips">
        {series.map(n => (
          <span
            key={n.rede}
            className="badge"
            style={{ color: NETWORK_COLORS[n.rede] }}
          >
            ● {n.rede} · desde {n.points[0].data} ·{' '}
            {growthPct(n.points[0].value)} → {growthPct(n.points.at(-1).value)}
          </span>
        ))}
      </div>
      {excluded > 0 && (
        <p className="small">
          {excluded} rede(s) sem coleta inicial não entram neste gráfico.
        </p>
      )}
    </section>
  );
}

function DailyEvolutionSection({ series, fallbackEnd }) {
  const baseData = dailyEvolutionData(series);
  const lastDate = baseData.dates.at(-1) || fallbackEnd;
  const [dailyPeriod, setDailyPeriod] = useState('7');
  const [dailyStart, setDailyStart] = useState(() => shiftDate(lastDate, -6));
  const [dailyEnd, setDailyEnd] = useState(() => lastDate);
  const [page, setPage] = useState(null);

  const invalidCustomDates =
    dailyPeriod === 'custom' &&
    (!dailyStart || !dailyEnd || dailyStart > dailyEnd);

  const windowModel = dailyEvolutionWindow(series, {
    period: dailyPeriod,
    start: dailyStart,
    end: dailyEnd,
  });
  const view = dailyEvolutionPage(windowModel, page, DAILY_PAGE_SIZE);
  const signed = v => `${v > 0 ? '+' : ''}${formatNumber(v)}`;

  return (
    <section className="discovery-card daily-wide" id="discoveryDailyChart">
      <div className="filters daily-period-controls">
        <label>
          Período da evolução diária
          <select
            id="dailyPeriod"
            value={dailyPeriod}
            onChange={e => {
              setDailyPeriod(e.target.value);
              setPage(null);
            }}
          >
            <option value="7">Últimos 7 dias</option>
            <option value="15">Últimos 15 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="custom">Datas personalizadas</option>
          </select>
        </label>
        {dailyPeriod === 'custom' && (
          <div id="dailyCustomDates" style={{ display: 'flex', gap: '12px' }}>
            <label>
              De
              <input
                type="date"
                id="dailyStart"
                value={dailyStart}
                onChange={e => {
                  setDailyStart(e.target.value);
                  setPage(null);
                }}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                id="dailyEnd"
                value={dailyEnd}
                onChange={e => {
                  setDailyEnd(e.target.value);
                  setPage(null);
                }}
              />
            </label>
          </div>
        )}
        <p className="small">
          Últimos dias com referência à coleta mais recente disponível.
        </p>
      </div>

      <div id="dailyChartBody">
        {invalidCustomDates ? (
          <p role="status">
            Informe uma data inicial igual ou anterior à data final.
          </p>
        ) : view.dates.length === 0 ? (
          <>
            <h3>Evolução diária</h3>
            <p role="status">
              Sem coletas disponíveis nas datas selecionadas.
            </p>
          </>
        ) : (
          <>
            <h3>Evolução diária</h3>
            <p className="small">
              Período exibido: {windowModel.start || '—'} a{' '}
              {windowModel.end || '—'}. Percentuais desde a primeira coleta de
              cada rede.
            </p>
            <p className="small">
              A variação diária compara a contagem com a do dia anterior. O
              YouTube publica inscritos arredondados: valores iguais podem
              esconder mudanças menores.
            </p>
            <div className="daily-coverage">
              {windowModel.series.map(n => {
                const collected = windowModel.dates.filter(d =>
                  n.byDate.has(d)
                ).length;
                const missing = windowModel.dates.length - collected;
                return (
                  <div
                    key={n.rede}
                    style={{ '--daily-color': NETWORK_COLORS[n.rede] }}
                  >
                    <b style={{ color: NETWORK_COLORS[n.rede] }}>{n.rede}</b>
                    <span>
                      {collected} de {windowModel.dates.length} datas com coleta
                    </span>
                    <small>
                      {missing
                        ? `${missing} data${missing === 1 ? '' : 's'} sem registro`
                        : 'Cobertura completa no período'}
                    </small>
                  </div>
                );
              })}
            </div>

            <div className="daily-data-table">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    {windowModel.series.map(n => (
                      <th
                        key={n.rede}
                        style={{ color: NETWORK_COLORS[n.rede] }}
                      >
                        {n.rede}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.dates.map(d => (
                    <tr key={d}>
                      <th scope="row">{formatDateBR(d)}</th>
                      {windowModel.series.map(n => {
                        const row = n.byDate.get(d);
                        if (!row) {
                          const known = n.hist.filter(r => r.data < d).at(-1);
                          return (
                            <td key={n.rede} className="daily-missing">
                              <b>Sem coleta</b>
                              <small>
                                {known
                                  ? `Último registro anterior: ${formatNumber(known.seguidores)} em ${formatDateBR(known.data)}`
                                  : 'Nenhum registro anterior'}
                              </small>
                            </td>
                          );
                        }
                        return (
                          <td key={n.rede}>
                            <b>{formatNumber(row.seguidores)}</b>
                            <small>
                              {row.gain === null
                                ? 'Primeira coleta · sem comparação'
                                : row.previous === shiftDate(d, -1)
                                  ? row.gain === 0
                                    ? 'Sem mudança na contagem publicada'
                                    : `${signed(row.gain)} ${
                                        n.rede === 'YouTube'
                                          ? 'inscritos'
                                          : 'seguidores'
                                      } no dia`
                                  : `${signed(row.gain)} desde ${formatDateBR(row.previous)} · intervalo entre coletas`}
                            </small>
                            <small>
                              {Number.isFinite(row.percent)
                                ? `${growthPct(row.percent)} desde a primeira coleta`
                                : 'Percentual indisponível'}
                            </small>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="tools">
              <button
                id="dailyPrevious"
                type="button"
                disabled={view.current === 0}
                onClick={() => setPage(Math.max(0, view.current - 1))}
              >
                ← Datas anteriores
              </button>
              <span>
                Página {view.current + 1} de {view.pages} · {view.dates.length}{' '}
                data{view.dates.length === 1 ? '' : 's'}
              </span>
              <button
                id="dailyNext"
                type="button"
                disabled={view.current + 1 >= view.pages}
                onClick={() =>
                  setPage(Math.min(Math.max(0, view.pages - 1), view.current + 1))
                }
              >
                Próximas datas →
              </button>
            </div>
            <p className="small">
              A tabela apresenta todas as datas desta página e informa a
              cobertura real de cada rede. O último registro anterior aparece
              apenas como referência quando não houve coleta no dia; ele não é
              usado como coleta nem para criar crescimento. Ganho calculado
              desde a coleta anterior disponível; se houver intervalo, não
              representa ganho de um único dia. Sem coleta não é zero. Não há
              estimativa.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default function TalentDetailModal({
  person,
  open,
  onClose,
  favorites,
  onToggleFavorite,
  selectedNetwork = 'all',
  allRows = [],
  today = brazilToday(),
}) {
  if (!person) {
    return (
      <aside className="panel" id="detail">
        <h2>Explore os talentos</h2>
        <p>
          Selecione um resultado para consultar redes, histórico e
          classificação.
        </p>
      </aside>
    );
  }

  const model = discoveryEvolutionModel(person, today, selectedNetwork);
  const series = model.networks.filter(
    n => n.hist?.length && n.rede !== 'Spotify'
  );
  const spotifyNet = model.networks.find(n => n.rede === 'Spotify');
  const signed = v => `${v > 0 ? '+' : ''}${formatNumber(v)}`;
  const isFav = favorites.has(person.nome);

  const content = (
    <aside className="panel discovery-focus" id="detail">
      <div className="discovery-heading">
        <div>
          <span className="badge">
            {person.categoria || (person.categorias || []).join(', ')}
          </span>
          <h2>{person.nome}</h2>
          <p className="small">
            {topicLabels(person.rows) || 'Sem subcategoria definida'}
          </p>
        </div>
        <div className="tools" style={{ marginTop: 0 }}>
          <button
            type="button"
            id="save"
            onClick={() => onToggleFavorite(person.nome)}
          >
            {isFav ? '♥ Salvo' : '♡ Salvar nos favoritos'}
          </button>
          {open && (
            <button
              type="button"
              id="discoveryReportClose"
              onClick={onClose}
            >
              Fechar ✕
            </button>
          )}
        </div>
      </div>

      {spotifyNet?.hist?.length > 0 && (
        <section className="discovery-card" style={{ marginTop: 16 }}>
          <h3>Spotify · histórico das coletas</h3>
          <p className="small">
            Ouvintes mensais. Datas sem coleta não são preenchidas.
          </p>
          <table>
            <thead>
              <tr>
                <th>Coleta</th>
                <th>Ouvintes mensais</th>
                <th>Variação desde a coleta anterior</th>
              </tr>
            </thead>
            <tbody>
              {spotifyNet.hist.map((r, i) => {
                const prev = spotifyNet.hist[i - 1];
                const delta = prev ? r.seguidores - prev.seguidores : null;
                return (
                  <tr key={r.data}>
                    <td>{r.data}</td>
                    <td>{formatNumber(r.seguidores)}</td>
                    <td>
                      {prev
                        ? `${signed(delta)} · ${
                            prev.seguidores > 0
                              ? growthPct((delta / prev.seguidores) * 100)
                              : 'Percentual indisponível'
                          }`
                        : 'Primeira coleta'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <div className="discovery-summary">
        <section className="discovery-card">
          <h3>Resumo total</h3>
          <div className="discovery-values">
            <div>
              <small>Público atual</small>
              <strong>{formatNumber(model.total)}</strong>
            </div>
            <div>
              <small>Ganho total</small>
              <strong>{model.comparable ? signed(model.gain) : '—'}</strong>
            </div>
          </div>
          <p className="small">
            Soma de Instagram e YouTube; não representa pessoas únicas. Ouvintes
            mensais do Spotify aparecem no cartão próprio e não entram nessa
            soma. Ganho considera {model.comparable} rede(s) com comparação
            válida.
          </p>
        </section>

        {model.networks.map(n => (
          <section
            key={n.rede}
            className="discovery-card"
            style={{
              borderTop: `5px solid ${NETWORK_COLORS[n.rede] || '#64748b'}`,
            }}
          >
            <h3>{n.rede}</h3>
            <div className="discovery-values">
              <div>
                <small>
                  {n.rede === 'Spotify'
                    ? 'Ouvintes mensais iniciais'
                    : 'Público inicial'}
                </small>
                <strong>
                  {n.first ? formatNumber(n.first.seguidores) : '—'}
                </strong>
                <small>{n.first?.data || 'Sem coleta'}</small>
              </div>
              <div>
                <small>
                  {n.rede === 'Spotify'
                    ? 'Ouvintes mensais atuais'
                    : 'Público atual'}
                </small>
                <strong>
                  {n.latest ? formatNumber(n.latest.seguidores) : '—'}
                </strong>
                <small>{n.latest?.data || 'Aguardando coleta'}</small>
              </div>
            </div>
            <p className="discovery-gain">
              {n.valid
                ? `${signed(n.gain)} · ${growthPct(n.pct)}`
                : n.rede === 'Instagram' && !n.profile
                  ? 'Conta ainda não vinculada'
                  : !n.latest
                    ? 'Aguardando primeira coleta'
                    : 'Aguardando nova coleta'}
            </p>
            <p className="small">
              {n.first
                ? `${Math.round((Date.parse(model.end) - Date.parse(n.first.data)) / 86400000)} dias desde o início`
                : n.label}
            </p>
            {n.profile ? (
              <ProfileExternalLink
                rede={n.rede}
                profile={n.profile}
                allRows={allRows}
              />
            ) : (
              <span className="small">Perfil não identificado</span>
            )}
          </section>
        ))}
      </div>

      <div className="discovery-charts">
        <AudienceComparisonSection networks={series} />
        <PercentEvolutionSection
          networks={series}
          start={model.start}
          end={model.end}
        />
        <DailyEvolutionSection series={series} fallbackEnd={model.end} />
      </div>

      <p className="small">
        Cada rede mantém sua própria data inicial. Linhas ligam apenas coletas
        disponíveis; dias sem coleta não são estimados. A evolução não altera a
        ordem do ranking de descoberta.
      </p>
    </aside>
  );

  if (open) {
    return (
      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Relatório de evolução do talento"
      >
        <div className="modal-container">{content}</div>
      </div>
    );
  }

  return content;
}
