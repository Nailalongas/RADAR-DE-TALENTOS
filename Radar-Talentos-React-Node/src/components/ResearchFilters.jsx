import {
  categories as defaultCategories,
  categoryDisplayLabels,
  talentTaxonomy as defaultTaxonomy,
  talentTopicKeys,
} from '../domain/taxonomy.js';
import {
  FOLLOWER_BAND_OPTIONS,
  PERIOD_OPTIONS,
  RESULT_LIMIT_OPTIONS,
  MONITORING_COHORTS,
  comparisonNetworks,
  networkSelected,
  peopleGroups,
  formatNumber,
} from '../domain/research.js';

const NETWORK_CHECKBOXES = [
  { value: 'Instagram', subtitle: 'Seguidores' },
  { value: 'YouTube', subtitle: 'Inscritos' },
  { value: 'Spotify', subtitle: 'Ouvintes mensais' },
];

export default function ResearchFilters({
  categoriesList = defaultCategories,
  taxonomy = defaultTaxonomy,
  rows = [],
  chosenCategories,
  onToggleCategory,
  onToggleAllCategories,
  comparisonMode,
  onChangeComparisonMode,
  network,
  onToggleNetworkCheckbox,
  resultLimit,
  onChangeResultLimit,
  resultMode,
  onChangeResultMode,
  period,
  onChangePeriod,
  start,
  end,
  onChangeStart,
  onChangeEnd,
  subcategory,
  onChangeSubcategory,
  followerBand,
  onChangeFollowerBand,
  calculation,
  onChangeCalculation,
  rankingSort,
  onChangeRankingSort,
  monitoringBand,
  onChangeMonitoringBand,
  includeOrganizations,
  onChangeIncludeOrganizations,
  onBroadenSearch,
  adjustmentStatus,
  coverage,
  onSearch,
  searchBusy,
  availableMode,
}) {
  const required = comparisonNetworks(resultMode, comparisonMode);
  const allGroups = peopleGroups(rows);
  const topicParentCategories = chosenCategories.size
    ? categoriesList.filter(c => chosenCategories.has(c))
    : categoriesList;

  const chosenSummary =
    chosenCategories.size === 0
      ? 'Selecionar categorias ⌄'
      : chosenCategories.size === categoriesList.length
        ? 'Todas as categorias selecionadas ⌄'
        : `${chosenCategories.size} categoria(s) selecionada(s) ⌄`;

  return (
    <>
      <section className="research-panel" aria-label="Pesquisa de talentos">
        <h2 className="research-panel-title">Pesquisa de talentos</h2>
        <div className="filters research-filters">
          <fieldset className="network-picker">
            <legend>Escolha as redes</legend>
            <label className="comparison-mode">
              Comparação de audiência
              <select
                id="comparisonMode"
                aria-describedby="comparisonHelp"
                value={comparisonMode}
                disabled={resultMode !== 'discover'}
                onChange={e => onChangeComparisonMode(e.target.value)}
              >
                <option value="all">Redes disponíveis</option>
                <option value="three">
                  Três redes · Instagram, YouTube e Spotify
                </option>
                <option value="two">Duas redes · Instagram e YouTube</option>
              </select>
            </label>
            <small className="network-help" id="comparisonHelp">
              Em Redes disponíveis, basta ter dados de uma das redes
              selecionadas no período. Nos modos Duas redes e Três redes, o
              talento precisa ter uma contagem em cada rede exigida nos últimos
              7 dias do período.
            </small>
            <div className="network-options" aria-label="Selecionar redes">
              {NETWORK_CHECKBOXES.map(item => {
                const isChecked = required.length
                  ? required.includes(item.value)
                  : networkSelected(item.value, network);
                return (
                  <label key={item.value} className="network-option">
                    <input
                      type="checkbox"
                      value={item.value}
                      checked={isChecked}
                      disabled={required.length > 0}
                      onChange={() => onToggleNetworkCheckbox(item.value)}
                    />
                    <span>
                      {item.value}
                      <small>{item.subtitle}</small>
                    </span>
                  </label>
                );
              })}
            </div>
            {!required.length && (
              <small className="network-help" id="networkSelectionHelp">
                Em Redes disponíveis, você pode marcar uma, duas ou as três
                redes.
              </small>
            )}
          </fieldset>

          <details className="category-picker">
            <summary>
              Categoria <span>{chosenSummary}</span>
            </summary>
            <fieldset className="category-filter">
              <legend>Categorias</legend>
              <div className="chips" id="categories">
                <button
                  type="button"
                  id="allCategories"
                  aria-pressed={chosenCategories.size === categoriesList.length}
                  className={
                    chosenCategories.size === categoriesList.length
                      ? 'active'
                      : ''
                  }
                  onClick={onToggleAllCategories}
                >
                  Todas
                </button>
                {categoriesList.map(c => (
                  <button
                    key={c}
                    type="button"
                    data-cat={c}
                    aria-pressed={chosenCategories.has(c)}
                    className={chosenCategories.has(c) ? 'active' : ''}
                    onClick={() => onToggleCategory(c)}
                  >
                    {categoryDisplayLabels[c] || c}
                  </button>
                ))}
              </div>
            </fieldset>
          </details>

          <label>
            Exibir
            <select
              id="resultLimit"
              value={resultLimit}
              onChange={e => onChangeResultLimit(e.target.value)}
            >
              {RESULT_LIMIT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="persistent-filters" aria-label="Filtros da pesquisa">
          <div className="filters">
            <label>
              Ver
              <select
                id="resultMode"
                value={resultMode}
                onChange={e => onChangeResultMode(e.target.value)}
              >
                <option value="discover">Descobrir talentos</option>
                <option value="growth">Quem mais cresceu</option>
              </select>
            </label>

            <label>
              Período
              <select
                id="period"
                value={period}
                onChange={e => onChangePeriod(e.target.value)}
              >
                {PERIOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {period === 'custom' && (
              <div id="dates">
                <label>
                  De
                  <input
                    id="start"
                    type="date"
                    value={start}
                    onChange={e => onChangeStart(e.target.value)}
                  />
                </label>
                <label>
                  Até
                  <input
                    id="end"
                    type="date"
                    value={end}
                    onChange={e => onChangeEnd(e.target.value)}
                  />
                </label>
              </div>
            )}

            <label>
              Subcategoria / tema
              <select
                id="subcategory"
                value={subcategory}
                onChange={e => onChangeSubcategory(e.target.value)}
              >
                <option value="all">Todos os temas</option>
                <option value="undefined">Sem subcategoria definida</option>
                {topicParentCategories.map(cat => (
                  <optgroup key={cat} label={cat}>
                    {(taxonomy[cat] || []).map(theme => {
                      const key = `${cat}|${theme}`;
                      const count = allGroups.filter(g =>
                        talentTopicKeys(g.rows).includes(key)
                      ).length;
                      return (
                        <option key={key} value={key}>
                          {theme} ({count})
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </label>

            <label>
              <span id="followerBandLabel">
                Faixa de público nas redes selecionadas
              </span>
              <select
                id="followerBand"
                value={followerBand}
                onChange={e => onChangeFollowerBand(e.target.value)}
              >
                {FOLLOWER_BAND_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="research-submit">
          <button
            type="button"
            className={`primary${searchBusy ? ' is-loading' : ''}`}
            id="search"
            disabled={searchBusy}
            onClick={onSearch}
          >
            {searchBusy ? 'Pesquisando…' : 'Pesquisar'}
          </button>
        </div>
      </section>

      {resultMode === 'growth' && (
        <div id="analysisControls" className="filters" style={{ marginBottom: 16 }}>
          <label>
            Análise
            <select
              id="calculation"
              value={calculation}
              onChange={e => onChangeCalculation(e.target.value)}
            >
              <option value="full">Período completo</option>
              <option value="available">Histórico disponível no período</option>
            </select>
          </label>
          <label>
            Ordenar por
            <select
              id="rankingSort"
              value={rankingSort}
              onChange={e => onChangeRankingSort(e.target.value)}
            >
              <option value="gain">Mais novos seguidores</option>
              <option value="percent">Maior crescimento percentual</option>
            </select>
          </label>
          {availableMode && (
            <label id="monitoringControl">
              Tempo acompanhado
              <select
                id="monitoringBand"
                value={monitoringBand}
                onChange={e => onChangeMonitoringBand(e.target.value)}
              >
                <option value="all">Todas as faixas, separadas</option>
                {MONITORING_COHORTS.slice()
                  .reverse()
                  .map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      )}

      <details id="researchSettings" className="panel" style={{ margin: '12px 0' }}>
        <summary>Ajustes da pesquisa</summary>
        <p className="small">
          Consulte a cobertura da base, amplie os filtros ou confira a
          classificação de um talento.
        </p>
        <section>
          <h3>Ampliar resultados</h3>
          <p className="small">
            Inclui todas as categorias, Instagram e YouTube e todas as faixas a
            partir de 100 mil seguidores. Mantém o nome pesquisado, o período e
            a análise de crescimento. Usa somente os perfis já cadastrados.
          </p>
          <button id="broadenSearch" type="button" onClick={onBroadenSearch}>
            Usar todas as categorias e redes
          </button>
          {adjustmentStatus && (
            <p id="adjustmentStatus" className="small" role="status" aria-live="polite">
              {adjustmentStatus}
            </p>
          )}
        </section>

        <details style={{ margin: '16px 0' }}>
          <summary>Revisar classificação de talentos</summary>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
            }}
          >
            <input
              id="includeOrganizations"
              type="checkbox"
              checked={includeOrganizations}
              onChange={e => onChangeIncludeOrganizations(e.target.checked)}
            />
            Mostrar também organizações para conferência
          </label>
          <p className="small">
            Inclui produtoras, programas e páginas nos resultados. Bandas e
            duplas devem ser classificadas como talentos artísticos.
          </p>
        </details>

        <details id="coverageDetails" style={{ margin: '16px 0' }}>
          <summary>Perfis disponíveis por categoria e rede</summary>
          <div
            id="coverageTable"
            role="region"
            aria-label="Cobertura da base"
            style={{ overflowX: 'auto' }}
          >
            {coverage.totalTalents === 0 ? (
              <p className="small">
                Nenhum talento carregado para calcular a cobertura. Clique em
                Pesquisar para carregar a base.
              </p>
            ) : (
              <>
                <p className="small">
                  {formatNumber(coverage.totalTalents)} talentos na base
                  carregada
                  {includeOrganizations
                    ? ', incluindo organizações'
                    : ' · organizações excluídas'}
                  . Contagem antes dos filtros de nome, seguidores, rede e
                  período. Um talento pode estar em várias categorias;
                  “Instagram e YouTube” já está incluído nas duas colunas.
                  Spotify conta artistas com ouvintes mensais salvos. Perfil
                  ausente pode ainda não ter sido identificado ou coletado.
                </p>
                <table>
                  <caption style={{ textAlign: 'left', padding: '12px' }}>
                    Cobertura dos dados carregados
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Categoria</th>
                      <th scope="col">Talentos</th>
                      <th scope="col">Instagram</th>
                      <th scope="col">YouTube</th>
                      <th scope="col">Spotify</th>
                      <th scope="col">Instagram e YouTube</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.byCategory.map(row => (
                      <tr key={row.category}>
                        <th scope="row">{row.category}</th>
                        <td>{formatNumber(row.talents)}</td>
                        <td>{formatNumber(row.Instagram)}</td>
                        <td>{formatNumber(row.YouTube)}</td>
                        <td>{formatNumber(row.Spotify)}</td>
                        <td>{formatNumber(row.both)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </details>
      </details>
    </>
  );
}
