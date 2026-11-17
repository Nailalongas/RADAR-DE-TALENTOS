import { topicLabels } from '../domain/taxonomy.js';
import {
  MONITORING_COHORTS,
  RESULT_PAGE_SIZE,
  audienceTotal,
  collectionLabel,
  formatDateBR,
  formatNumber,
  formatPct,
  growthDisplayNetworks,
  growthPendingReason,
  latestProfiles,
  pageResults,
  profileKey,
  profileURL,
} from '../domain/research.js';

function NetworkBadgeLink({ network, allRows }) {
  const rede = network.rede || network.end?.rede || '';
  const row = network.end || network;
  const url = profileURL({ ...network, rede, end: row, start: network.start || row }, allRows);
  const icon = rede === 'Instagram' ? '◎' : rede === 'Spotify' ? '♫' : '▶';
  const classes = `network-pill ${
    rede === 'Instagram'
      ? 'ig is-instagram'
      : rede === 'Spotify'
        ? 'sp is-spotify'
        : 'yt is-youtube'
  }`;

  if (url) {
    return (
      <a
        className={classes}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir ${rede} de ${row.nome || 'talento'} em nova aba`}
      >
        <span aria-hidden="true">{icon}</span> {rede} ↗
      </a>
    );
  }
  return (
    <span className={classes}>
      <span aria-hidden="true">{icon}</span> {rede}
    </span>
  );
}

function getInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(v => v[0])
    .join('');
}

function GrowthSectionTable({
  items,
  allRank,
  range,
  allRows,
  onSelectTalent,
  onOpenEvolution,
}) {
  return (
    <>
      <table className="discovery-report period-growth-report">
        <thead>
          <tr>
            <th>#</th>
            <th>Talento</th>
            <th>Categoria</th>
            <th>Rede</th>
            <th>Público no início</th>
            <th>Público no fim</th>
            <th>Público atual</th>
            <th>Variação no período</th>
            <th>Crescimento no período (%)</th>
            <th>Datas e dias</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((person, i) => {
            const networks = growthDisplayNetworks(person);
            const rankIdx = allRank.indexOf(person);
            const initials = getInitials(person.nome);
            return networks.map((n, j) => {
              const current =
                latestProfiles(person.rows).find(
                  p => profileKey(p) === profileKey(n.end)
                ) || n.end;
              return (
                <tr
                  key={`${person.key}-${profileKey(n.end || n)}-${j}`}
                  className={`talent-group-${i % 2}${j === 0 ? ' talent-group-start' : ''}`}
                  data-growth={rankIdx}
                  onClick={() => onSelectTalent(person)}
                >
                  {j === 0 && (
                    <>
                      <td rowSpan={networks.length}>{i + 1}</td>
                      <td rowSpan={networks.length}>
                        <div className="talent-identity">
                          <span className="talent-avatar" aria-hidden="true">
                            {initials}
                          </span>
                          <button
                            type="button"
                            className="name"
                            onClick={e => {
                              e.stopPropagation();
                              onSelectTalent(person);
                            }}
                          >
                            {person.nome}
                          </button>
                        </div>
                        <p className="small">
                          Perfis comparáveis: +{formatNumber(person.gain)} ·{' '}
                          {formatPct(person.score)}
                        </p>
                      </td>
                      <td rowSpan={networks.length}>{person.categoria}</td>
                    </>
                  )}
                  <td>
                    <NetworkBadgeLink network={n} allRows={allRows} />
                    {n.end?.contentLanguage === 'unknown' &&
                      !n.end?.languageExempt && (
                        <>
                          <br />
                          <small>Idioma em verificação</small>
                        </>
                      )}
                  </td>
                  {n.pending ? (
                    <>
                      <td>—</td>
                      <td>—</td>
                      <td>
                        {current.collectionPending
                          ? collectionLabel(current)
                          : formatNumber(current.seguidores)}
                        <br />
                        <small>
                          {current.collectionPending
                            ? 'Link encontrado no YouTube'
                            : `Coleta: ${current.data}`}
                        </small>
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td>{growthPendingReason(person, n, range)}</td>
                    </>
                  ) : (
                    <>
                      <td>{formatNumber(n.start.seguidores)}</td>
                      <td>{formatNumber(n.end.seguidores)}</td>
                      <td>
                        {current.collectionPending
                          ? collectionLabel(current)
                          : formatNumber(current.seguidores)}
                        <br />
                        <small>
                          {current.collectionPending
                            ? 'Link encontrado no YouTube'
                            : `Coleta: ${current.data}`}
                        </small>
                      </td>
                      <td>
                        {n.gain > 0 ? '+' : ''}
                        {formatNumber(n.gain)}
                      </td>
                      <td>{formatPct(n.pct)}</td>
                      <td>
                        {n.start.data} → {n.end.data}
                        <br />
                        {n.days} dias
                      </td>
                    </>
                  )}
                  {j === 0 && (
                    <td rowSpan={networks.length} className="person-actions">
                      <button
                        type="button"
                        data-period-evolution={rankIdx}
                        onClick={e => {
                          e.stopPropagation();
                          onOpenEvolution(person);
                        }}
                      >
                        ▥ Ver evolução
                      </button>
                    </td>
                  )}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
      <p className="small">
        Variação = público no fim menos público no início. No Spotify, o público
        é de ouvintes mensais. Crescimento (%) = novos seguidores ÷ total no
        início × 100. Redes com histórico em formação mostram os seguidores
        atuais, mas não entram no ganho nem no percentual do período. Não há
        projeção para os dias sem coleta. As informações estão organizadas na
        largura da página.
      </p>
    </>
  );
}

export default function ResearchTable({
  resultMode,
  availableMode,
  resultLimit,
  resultPage,
  onPreviousPage,
  onNextPage,
  discoveryPeople,
  rank,
  stats,
  range,
  allRows,
  talentName,
  onChangeTalentName,
  onSubmitNameSearch,
  onExportCSV,
  hasSelection,
  view,
  onShowAvailableHistory,
  onShowCurrentProfiles,
  onSelectTalent,
  onOpenEvolution,
  searchBusy,
}) {
  const items = resultMode === 'discover' ? discoveryPeople : rank;
  const total = items.length;
  const pagedItems = pageResults(items, resultLimit, resultPage, RESULT_PAGE_SIZE);
  const shown = pagedItems.length;
  const totalPages = Math.max(1, Math.ceil(total / RESULT_PAGE_SIZE));

  const rankingTitle =
    resultMode === 'discover'
      ? 'Descobrir talentos'
      : availableMode
        ? 'Crescimento por tempo acompanhado'
        : `${resultLimit === 'all' ? 'Todos os disponíveis' : `Top ${resultLimit}`} · período completo`;

  const countText = hasSelection
    ? `Exibindo ${shown} de ${stats.eligible} talentos disponíveis` +
      (resultLimit === 'all' && total
        ? ` · resultados ${resultPage * RESULT_PAGE_SIZE + 1}–${Math.min(
            (resultPage + 1) * RESULT_PAGE_SIZE,
            total
          )}`
        : '')
    : '';

  return (
    <>
      <div className="report-toolbar">
        <div className="report-toolbar-heading">
          <span className="report-mark" aria-hidden="true">
            ▥
          </span>
          <div>
            <h2>
              {resultMode === 'discover'
                ? 'Panorama dos talentos'
                : 'Quem está crescendo'}
            </h2>
            <p>
              {resultMode === 'discover'
                ? 'Total = seguidores do Instagram + inscritos do YouTube + ouvintes mensais do Spotify das redes exibidas. A soma reúne métricas diferentes e não representa pessoas únicas.'
                : 'Comparação do público e crescimento por rede. Confira as datas de cada coleta.'}
            </p>
          </div>
        </div>
        <label>
          Nome do talento
          <input
            id="talentName"
            type="search"
            placeholder="Buscar por nome…"
            autoComplete="off"
            value={talentName}
            onChange={e => onChangeTalentName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmitNameSearch();
              }
            }}
          />
        </label>
        <button id="export" type="button" onClick={onExportCSV}>
          Exportar relatório
        </button>
      </div>

      <div className="layout">
        <section>
          <div className="sectionhead">
            <h2 id="rankingTitle">{rankingTitle}</h2>
            <span id="count" className="small">
              {countText}
            </span>
          </div>

          <div
            className={`tablebox${searchBusy ? ' is-updating' : ''}`}
            id="table"
            aria-busy={searchBusy ? 'true' : 'false'}
          >
            {!hasSelection ? (
              <div className="empty">Selecione pelo menos uma categoria.</div>
            ) : resultMode === 'discover' ? (
              pagedItems.length === 0 ? (
                <div className="empty">
                  {view === 'favorites'
                    ? 'Nenhum favorito disponível para estes filtros.'
                    : 'Nenhum talento disponível para estes filtros.'}
                </div>
              ) : (
                <>
                  <div className="discovery-intro">
                    <b>Panorama dos talentos</b>
                    <p>
                      Total = seguidores do Instagram + inscritos do YouTube +
                      ouvintes mensais do Spotify das redes exibidas. A soma
                      reúne métricas diferentes e não representa pessoas únicas.
                    </p>
                  </div>
                  <table className="discovery-report">
                    <colgroup>
                      <col style={{ width: '3%' }} />
                      <col style={{ width: '19%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '14%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Talento</th>
                        <th>Categoria e tema</th>
                        <th>Rede</th>
                        <th>Público da rede</th>
                        <th>Coleta</th>
                        <th>Total das redes</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedItems.map((person, i) => {
                        const totalAud = audienceTotal(person.latest);
                        const initials = getInitials(person.nome);
                        const idx = discoveryPeople.indexOf(person);
                        const position =
                          (resultLimit === 'all'
                            ? resultPage * RESULT_PAGE_SIZE
                            : 0) +
                          i +
                          1;

                        return person.latest.map((x, j) => (
                          <tr
                            key={`${person.key}-${profileKey(x)}-${j}`}
                            className={`talent-group-${i % 2}${j === 0 ? ' talent-group-start' : ''}`}
                            data-person={idx}
                            onClick={() => onSelectTalent(person)}
                          >
                            {j === 0 && (
                              <>
                                <td
                                  rowSpan={person.latest.length}
                                  className="position-cell"
                                >
                                  {position}
                                </td>
                                <td rowSpan={person.latest.length}>
                                  <div className="talent-identity">
                                    <span
                                      className="talent-avatar"
                                      aria-hidden="true"
                                    >
                                      {initials}
                                    </span>
                                    <button
                                      type="button"
                                      className="name"
                                      onClick={e => {
                                        e.stopPropagation();
                                        onSelectTalent(person);
                                      }}
                                    >
                                      {person.nome}
                                    </button>
                                  </div>
                                </td>
                                <td rowSpan={person.latest.length}>
                                  <span className="category-label">
                                    {person.categorias.join(', ')}
                                  </span>
                                  <p className="topic-label">
                                    {topicLabels(person.rows) ||
                                      'Sem tema definido'}
                                  </p>
                                </td>
                              </>
                            )}
                            <td>
                              <NetworkBadgeLink network={x} allRows={allRows} />
                            </td>
                            <td className="network-audience">
                              {x.collectionPending
                                ? collectionLabel(x)
                                : formatNumber(x.seguidores)}
                              {x.rede === 'Spotify' && (
                                <>
                                  <br />
                                  <small>ouvintes mensais</small>
                                </>
                              )}
                            </td>
                            <td>
                              <span className="collection-date">
                                {formatDateBR(x.data)}
                              </span>
                            </td>
                            {j === 0 && (
                              <>
                                <td
                                  rowSpan={person.latest.length}
                                  className="audience-total"
                                >
                                  <strong>
                                    {totalAud.value === null
                                      ? 'Aguardando coleta'
                                      : formatNumber(totalAud.value)}
                                  </strong>
                                  {totalAud.partial && (
                                    <small>Total parcial</small>
                                  )}
                                </td>
                                <td
                                  rowSpan={person.latest.length}
                                  className="person-actions"
                                >
                                  <button
                                    type="button"
                                    data-evolution={idx}
                                    onClick={e => {
                                      e.stopPropagation();
                                      onOpenEvolution(person);
                                    }}
                                  >
                                    ▥ Ver evolução
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </>
              )
            ) : pagedItems.length === 0 ? (
              <div className="empty">
                Nenhum perfil tem comparação válida para estes filtros. No
                período completo, precisamos de uma coleta em cada uma das duas
                datas. Isso não bloqueia a consulta aos seguidores atuais.
                <p>
                  <button
                    type="button"
                    id="showAvailableHistory"
                    onClick={onShowAvailableHistory}
                  >
                    Usar histórico disponível
                  </button>{' '}
                  <button
                    type="button"
                    id="showCurrentProfiles"
                    onClick={onShowCurrentProfiles}
                  >
                    Mostrar perfis encontrados
                  </button>
                </p>
                <p className="small">
                  Os filtros de categoria, rede e seguidores serão mantidos.
                  Público atual não serão apresentados como crescimento.
                </p>
              </div>
            ) : availableMode ? (
              <>
                {MONITORING_COHORTS.filter(c =>
                  pagedItems.some(x => x.cohort === c)
                ).map(cohort => (
                  <div key={cohort}>
                    <h3 style={{ padding: '12px' }}>{cohort}</h3>
                    <GrowthSectionTable
                      items={pagedItems.filter(x => x.cohort === cohort)}
                      allRank={rank}
                      range={range}
                      allRows={allRows}
                      onSelectTalent={onSelectTalent}
                      onOpenEvolution={onOpenEvolution}
                    />
                  </div>
                ))}
                <p className="small">
                  Faixas de acompanhamento não tornam as datas idênticas.
                  Confira as datas de cada comparação; não há uma classificação
                  geral entre faixas.
                </p>
              </>
            ) : (
              <GrowthSectionTable
                items={pagedItems}
                allRank={rank}
                range={range}
                allRows={allRows}
                onSelectTalent={onSelectTalent}
                onOpenEvolution={onOpenEvolution}
              />
            )}
          </div>

          {resultLimit === 'all' && total > RESULT_PAGE_SIZE && (
            <div id="resultPagination" className="tools">
              <button
                id="resultPrevious"
                type="button"
                disabled={resultPage === 0}
                onClick={onPreviousPage}
              >
                ← Anterior
              </button>
              <span id="resultPageInfo" role="status">
                Página {resultPage + 1} de {totalPages}
              </span>
              <button
                id="resultNext"
                type="button"
                disabled={(resultPage + 1) * RESULT_PAGE_SIZE >= total}
                onClick={onNextPage}
              >
                Próxima →
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
