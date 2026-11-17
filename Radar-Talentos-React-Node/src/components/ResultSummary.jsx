import {
  comparisonNetworks,
  formatDateBR,
  formatNumber,
} from '../domain/research.js';

export default function ResultSummary({
  stats,
  items,
  range,
  resultMode,
  comparisonMode,
  availableMode,
  talentName,
  resultNotice = '',
  hasSelection = true,
  onUseAvailableNetworks,
}) {
  if (!hasSelection) {
    return (
      <details className="search-diagnostics" open>
        <summary>Detalhes da consulta</summary>
        <p id="filterSummary" className="note" role="status">
          Selecione uma categoria ou digite o nome do talento.
        </p>
        <p id="status" role="status" aria-live="polite">
          Escolha uma categoria para o ranking. Para consultar uma pessoa, basta
          digitar o nome.
        </p>
      </details>
    );
  }

  const excluded = Math.max(0, stats.found - stats.eligible);
  const nameExcluded = Math.max(0, stats.total - stats.found);
  const totalExcluded = excluded + nameExcluded;
  const required = comparisonNetworks(resultMode, comparisonMode);

  const reasons = [
    ['Nome pesquisado', nameExcluded],
    ['Categoria ou tema', stats.category],
    [
      required.length
        ? 'Sem contagem nos últimos 7 dias em pelo menos uma das redes exigidas'
        : 'Sem dados das redes selecionadas no período',
      stats.network,
    ],
    ['Organizações não incluídas', stats.entity],
    ['Faixa de público ou contagem indisponível', stats.followers],
    ['Fora dos favoritos', stats.favorites],
    ...(resultMode === 'growth'
      ? [
          ['Histórico insuficiente para comparação', stats.history],
          ['Sem crescimento positivo', stats.noGain],
          ['Tempo acompanhado', stats.cohort],
        ]
      : []),
  ].filter(([, count]) => count > 0);

  const filterSummaryText =
    `${stats.found}${talentName.trim() ? ' correspondem ao nome' : ' talentos na base consultada'}` +
    ` · ${stats.category} fora das categorias/temas` +
    ` · ${stats.network} fora da rede` +
    ` · ${stats.entity} organizações` +
    ` · ${stats.followers} fora da faixa de seguidores` +
    (stats.favorites ? ` · ${stats.favorites} fora dos favoritos` : '') +
    (resultMode === 'growth'
      ? ` · ${stats.history} sem histórico compatível · ${stats.noGain} sem ganho positivo` +
        (stats.cohort ? ` · ${stats.cohort} fora do tempo acompanhado` : '')
      : '') +
    '.';

  const statusText =
    (resultMode === 'discover'
      ? `Descoberta pelas coletas disponíveis de ${range.start} a ${range.end}. Exibe a última coleta de cada rede dentro do período; não representa crescimento.`
      : availableMode
        ? 'Crescimento entre as datas disponíveis, separado pelo tempo acompanhado. Faixas mais longas aparecem primeiro; a quantidade selecionada limita o total exibido. Para explorar uma faixa específica, use Tempo acompanhado. Janelas podem variar entre talentos.'
        : `Período completo: ${range.start} a ${range.end}. Só entram comparações nas duas datas exatas.`) +
    ' Spotify: ouvintes mensais em métrica separada, com coleta diária e prioridade para os cadastros do comparativo. Idioma e associação por nome podem precisar de revisão. Nas demais redes, somente perfis com conteúdo em português confirmado entram nos resultados. Perfis com idioma pendente continuam na base, fora do ranking. ' +
    resultNotice;

  return (
    <>
      <details className="search-diagnostics">
        <summary>Detalhes da consulta</summary>
        <p id="filterSummary" className="note" role="status">
          {filterSummaryText}
        </p>
        <p id="status" role="status" aria-live="polite">
          {statusText}
        </p>
      </details>

      <section
        id="resultSummary"
        className="result-summary"
        aria-label="Resumo da pesquisa"
      >
        <h3 tabIndex={-1}>Resumo da pesquisa</h3>
        <div className="summary-grid">
          <div className="summary-card">
            <strong>{formatNumber(stats.total)}</strong>
            <span>talentos nos dados carregados</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(stats.eligible)}</strong>
            <span>atendem aos filtros</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(items.length)}</strong>
            <span>selecionados para o relatório</span>
          </div>
          <div className="summary-card">
            <strong>{formatNumber(totalExcluded)}</strong>
            <span>fora dos filtros nesta consulta</span>
          </div>
        </div>

        {required.length > 0 && (
          <>
            <p className="summary-note">
              <strong>
                Comparação em{' '}
                {required.length === 3
                  ? 'três redes (Instagram, YouTube e Spotify)'
                  : 'duas redes (Instagram e YouTube)'}
              </strong>
              : exige uma contagem em cada uma delas para o mesmo talento nos
              últimos 7 dias do período. Para incluir quem tem dados em apenas
              parte das redes, use Redes disponíveis.
            </p>
            <button
              type="button"
              id="useAvailableNetworks"
              onClick={onUseAvailableNetworks}
            >
              Ver redes disponíveis
            </button>
          </>
        )}

        <p className="summary-note">
          Período: {formatDateBR(range.start)} a {formatDateBR(range.end)}.
          Talentos agrupam contas vinculadas; o total cadastrado por rede é uma
          contagem diferente.
        </p>
        <p className="summary-note">
          Os dados carregados já consideram o período e as regras de idioma.
          Contas sem histórico ou fora dessas regras podem não aparecer neste
          resumo de filtros.
        </p>

        <details className="summary-reasons">
          <summary>
            Por que alguns talentos ficaram fora? ({formatNumber(totalExcluded)}
            )
          </summary>
          {reasons.length > 0 ? (
            <>
              <ul>
                {reasons.map(([label, n]) => (
                  <li key={label}>
                    {label}: <b>{formatNumber(n)}</b>
                  </li>
                ))}
              </ul>
              <p className="summary-note">
                Cada talento é contado uma vez, pelo primeiro critério em que
                deixou de atender à pesquisa.
              </p>
            </>
          ) : (
            <p className="summary-note">
              Nenhum talento dos dados carregados foi excluído pelos filtros.
            </p>
          )}
        </details>
      </section>
    </>
  );
}
