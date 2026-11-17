import { useEffect, useMemo, useState } from 'react';
import {
  getEvolution,
  getHealth,
  getHistory,
  getResearch,
  getTaxonomy,
} from './services/api.js';
import {
  categories as defaultCategories,
  talentTaxonomy as defaultTaxonomy,
} from './domain/taxonomy.js';
import {
  analysisRange,
  analysisSnapshot,
  brazilToday,
  buildAnalysis,
  comparisonNetworks,
  computeCoverage,
  followerBounds,
  formatDateBR,
  formatNumber,
  growthDashboardData,
  growthPct,
  networkSelected,
  peopleGroups,
  personKey,
  profileURL,
  reportCSV,
  shiftDate,
} from './domain/research.js';
import ResearchFilters from './components/ResearchFilters.jsx';
import ResultSummary from './components/ResultSummary.jsx';
import ResearchTable from './components/ResearchTable.jsx';
import TalentDetailModal from './components/TalentDetailModal.jsx';
import GeoAudienceRadar from './components/GeoAudienceRadar.jsx';
import EventTrendsAndOpportunities from './components/EventTrendsAndOpportunities.jsx';
import Radar from './Radar.jsx';
import EventTrends from './EventTrends.jsx';
import AudienceStatus from './AudienceStatus.jsx';
import Opportunities from './Opportunities.jsx';
import OpportunitiesRadar from './OpportunitiesRadar.jsx';

function loadSavedSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function loadSavedArchives() {
  try {
    const raw = localStorage.getItem('radar-archives');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const today = useMemo(() => brazilToday(), []);
  const [status, setStatus] = useState('Verificando conexão…');
  const [categoriesList, setCategoriesList] = useState(defaultCategories);
  const [taxonomy, setTaxonomy] = useState(defaultTaxonomy);

  // Loaded data state
  const [rows, setRows] = useState([]);
  const [researchSummaryOnly, setResearchSummaryOnly] = useState(false);
  const [researchOldestDate, setResearchOldestDate] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState(null);
  const [resultNotice, setResultNotice] = useState('');
  const [adjustmentStatus, setAdjustmentStatus] = useState('');

  // Navigation / view state
  const [activeNav, setActiveNav] = useState('fases123'); // 'fases123' | 'discover' | 'geoRadar' | 'eventTrends' | 'growthDashboard' | 'favorites' | 'archives'
  const [view, setView] = useState('all'); // 'all' | 'favorites'

  // Research filter state
  const [chosenCategories, setChosenCategories] = useState(
    () => new Set(defaultCategories)
  );
  const [comparisonMode, setComparisonMode] = useState('all');
  const [network, setNetwork] = useState('all');
  const [resultLimit, setResultLimit] = useState('20');
  const [resultPage, setResultPage] = useState(0);
  const [resultMode, setResultMode] = useState('discover');
  const [period, setPeriod] = useState('30');
  const [start, setStart] = useState(() => shiftDate(today, -30));
  const [end, setEnd] = useState(() => today);
  const [subcategory, setSubcategory] = useState('all');
  const [followerBand, setFollowerBand] = useState('100000:0');
  const [calculation, setCalculation] = useState('full');
  const [rankingSort, setRankingSort] = useState('gain');
  const [monitoringBand, setMonitoringBand] = useState('all');
  const [includeOrganizations, setIncludeOrganizations] = useState(false);
  const [talentName, setTalentName] = useState('');

  // Growth dashboard independent filter state
  const [growthCategory, setGrowthCategory] = useState('all');
  const [growthNetwork, setGrowthNetwork] = useState('all');
  const [growthFollowerBand, setGrowthFollowerBand] = useState('100000:0');
  const [growthLimit, setGrowthLimit] = useState('20');

  // Favorites & Archives
  const [favorites, setFavorites] = useState(() =>
    loadSavedSet('radar-favorites')
  );
  const [archives, setArchives] = useState(() => loadSavedArchives());
  const [selectedArchiveId, setSelectedArchiveId] = useState(null);

  // Selected talent & evolution modal
  const [selectedTalentName, setSelectedTalentName] = useState(null);
  const [evolutionPerson, setEvolutionPerson] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(data =>
        setStatus(data.ok ? 'Servidor conectado' : 'Servidor indisponível')
      )
      .catch(error => {
        if (error.name !== 'AbortError') setStatus('Servidor indisponível');
      });

    getTaxonomy(controller.signal)
      .then(data => {
        if (Array.isArray(data?.categories) && data.categories.length) {
          setCategoriesList(data.categories);
        }
        if (data?.taxonomy && typeof data.taxonomy === 'object') {
          setTaxonomy(data.taxonomy);
        }
      })
      .catch(() => {});

    const initialRange = analysisRange({
      period: '30',
      start: shiftDate(today, -30),
      end: today,
      today,
    });
    getResearch({
      start: initialRange.start,
      end: initialRange.end,
      signal: controller.signal,
    })
      .then(result => {
        if (Array.isArray(result?.rows)) {
          setRows(result.rows);
          setResearchSummaryOnly(Boolean(result.summaryOnly));
          setResearchOldestDate(result.historyStart || '');
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [today]);

  const hasSelection =
    chosenCategories.size > 0 || talentName.trim().length > 0;

  const analysis = useMemo(
    () =>
      buildAnalysis(rows, {
        talentName,
        chosenCategories,
        subcategory,
        network,
        comparisonMode,
        resultMode,
        period,
        start,
        end,
        calculation,
        rankingSort,
        monitoringBandFilter: monitoringBand,
        followerBand,
        resultLimit,
        includeOrganizations,
        view,
        favorites,
        today,
        researchOldestDate,
      }),
    [
      rows,
      talentName,
      chosenCategories,
      subcategory,
      network,
      comparisonMode,
      resultMode,
      period,
      start,
      end,
      calculation,
      rankingSort,
      monitoringBand,
      followerBand,
      resultLimit,
      includeOrganizations,
      view,
      favorites,
      today,
      researchOldestDate,
    ]
  );

  const coverage = useMemo(
    () =>
      computeCoverage(rows, {
        includeOrganizations,
        categoriesList,
      }),
    [rows, includeOrganizations, categoriesList]
  );

  const activeItems =
    resultMode === 'discover' ? analysis.people : analysis.rank;

  const selectedPerson = useMemo(() => {
    const combined = [...analysis.rank, ...analysis.people];
    if (!combined.length) return null;
    return (
      combined.find(p => p.nome === selectedTalentName) || combined[0] || null
    );
  }, [analysis.rank, analysis.people, selectedTalentName]);

  const growthDashboard = useMemo(
    () =>
      growthDashboardData(
        rows,
        0,
        growthNetwork,
        growthCategory,
        'gain',
        today,
        growthFollowerBand
      ),
    [rows, growthNetwork, growthCategory, today, growthFollowerBand]
  );

  function saveArchiveSnapshot(nextRows, summaryMessage) {
    const currentAnalysis = buildAnalysis(nextRows, {
      talentName,
      chosenCategories,
      subcategory,
      network,
      comparisonMode,
      resultMode,
      period,
      start,
      end,
      calculation,
      rankingSort,
      monitoringBandFilter: monitoringBand,
      followerBand,
      resultLimit,
      includeOrganizations,
      view,
      favorites,
      today,
      researchOldestDate,
    });
    const snap = {
      id:
        typeof crypto?.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      filters: {
        ...currentAnalysis.range,
        resultLimit,
        calculation,
        resultMode,
        rankingCriterion: rankingSort,
        followerBand,
        monitoringBand,
        minFollowers: followerBounds(followerBand).min,
        name: talentName.trim(),
        categories: [...chosenCategories],
        subcategory,
        network: currentAnalysis.effectiveNetwork,
        view,
      },
      source: 'real',
      results: analysisSnapshot(
        resultMode,
        currentAnalysis.people,
        currentAnalysis.rank
      ),
      summary: summaryMessage,
    };
    try {
      const updated = [snap, ...archives];
      localStorage.setItem('radar-archives', JSON.stringify(updated));
      setArchives(updated);
      return { ok: true, count: (resultMode === 'discover' ? currentAnalysis.people : currentAnalysis.rank).length };
    } catch {
      return { ok: false, count: (resultMode === 'discover' ? currentAnalysis.people : currentAnalysis.rank).length };
    }
  }

  async function executeSearch({ modeOverride } = {}) {
    if (searchBusy) return;
    const effectiveMode = modeOverride || resultMode;
    if (!chosenCategories.size && !talentName.trim()) {
      return;
    }
    const r = analysisRange({
      period,
      start,
      end,
      today,
      researchOldestDate,
      rows,
    });
    if (!r.start || !r.end || r.start > r.end) {
      setSearchFeedback({
        message: 'Confira as datas do período.',
        busy: false,
        error: true,
      });
      return;
    }

    setSearchBusy(true);
    setSearchFeedback({
      message: 'Consultando os dados salvos da base…',
      busy: true,
      error: false,
    });
    try {
      const result =
        effectiveMode === 'discover'
          ? await getResearch({ start: r.start, end: r.end })
          : await getHistory();
      const loadedRows = Array.isArray(result?.rows) ? result.rows : [];
      setRows(loadedRows);
      setResearchSummaryOnly(Boolean(result?.summaryOnly));
      setResearchOldestDate(result?.historyStart || '');
      setResultNotice(
        'Novos perfis e atualizações continuam nas rodadas automáticas.'
      );
      setResultPage(0);

      const saved = saveArchiveSnapshot(
        loadedRows,
        `Período ${r.start} a ${r.end}`
      );
      setSearchFeedback({
        message:
          `Pesquisa concluída · ${saved.count} talento${saved.count === 1 ? ' encontrado' : 's encontrados'}` +
          (saved.count ? '' : '. Tente ampliar os filtros.') +
          (saved.ok
            ? ''
            : ' · Pesquisa não salva: armazenamento do navegador cheio.'),
        busy: false,
        error: false,
      });
    } catch (error) {
      setSearchFeedback({
        message: `Não foi possível concluir a pesquisa. ${error.message}. Os resultados anteriores foram preservados.`,
        busy: false,
        error: true,
      });
    } finally {
      setSearchBusy(false);
    }
  }

  function handleToggleCategory(cat) {
    const next = new Set(chosenCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setChosenCategories(next);
    setResultPage(0);
    if (
      subcategory !== 'all' &&
      subcategory !== 'undefined' &&
      next.size > 0 &&
      !next.has(subcategory.split('|')[0])
    ) {
      setSubcategory('all');
    }
  }

  function handleToggleAllCategories() {
    const next =
      chosenCategories.size === categoriesList.length
        ? new Set()
        : new Set(categoriesList);
    setChosenCategories(next);
    setResultPage(0);
  }

  function handleToggleNetworkCheckbox(changedNetwork) {
    const allThree = ['Instagram', 'YouTube', 'Spotify'];
    const currentSelected = allThree.filter(n => networkSelected(n, network));
    let nextSelected;
    if (currentSelected.includes(changedNetwork)) {
      nextSelected = currentSelected.filter(n => n !== changedNetwork);
      if (nextSelected.length === 0) nextSelected = [changedNetwork];
    } else {
      nextSelected = allThree.filter(
        n => currentSelected.includes(n) || n === changedNetwork
      );
    }
    setNetwork(nextSelected.length === 3 ? 'all' : nextSelected.join('|'));
    setResultPage(0);
  }

  function handleComparisonModeChange(nextMode) {
    setComparisonMode(nextMode);
    const req = comparisonNetworks(resultMode, nextMode);
    if (req.length) {
      setNetwork(req.length === 3 ? 'all' : req.join('|'));
    }
    setResultPage(0);
  }

  function handleBroadenSearch() {
    setComparisonMode('all');
    setNetwork('all');
    setSubcategory('all');
    setFollowerBand('100000:0');
    setChosenCategories(new Set(categoriesList));
    setResultPage(0);
    setAdjustmentStatus(
      'Filtros ampliados: todas as categorias e redes, a partir de 100 mil seguidores. Nome, período, tipo de análise e seleção de favoritos foram mantidos.'
    );
  }

  function handleToggleFavorite(nome) {
    const next = new Set(favorites);
    if (next.has(nome)) next.delete(nome);
    else next.add(nome);
    setFavorites(next);
    try {
      localStorage.setItem('radar-favorites', JSON.stringify([...next]));
    } catch {}
  }

  async function handleOpenEvolution(person) {
    if (!person) return;
    setSelectedTalentName(person.nome);
    if (researchSummaryOnly && person.rows?.some(r => r.rede !== 'Spotify')) {
      try {
        const fullHistory = await getEvolution({
          personId: person.rows[0]?.personId || '',
          name: person.nome,
        });
        const fullGroup = peopleGroups(fullHistory.rows || []).find(
          g => g.key === person.key || g.nome === person.nome
        );
        if (fullGroup) {
          setEvolutionPerson({
            ...person,
            rows: fullGroup.rows,
            categoria:
              person.categoria || (person.categorias || []).join(', '),
          });
          return;
        }
      } catch {}
    }
    const allPersonRows = rows.filter(
      r => (r.personId ? `id:${r.personId}` : personKey(r.nome)) === person.key
    );
    setEvolutionPerson(
      allPersonRows.length ? { ...person, rows: allPersonRows } : person
    );
  }

  function handleExportCSV() {
    const csv = reportCSV(
      {
        createdAt: new Date().toISOString(),
        source: 'real',
        filters: {
          name: talentName,
          start: analysis.range.start,
          end: analysis.range.end,
          minFollowers: followerBounds(followerBand).min,
          followerBand,
          resultMode,
          calculation,
          rankingCriterion: rankingSort,
          network: analysis.effectiveNetwork,
          categories: [...chosenCategories],
          subcategory,
        },
        results: analysisSnapshot(resultMode, analysis.people, analysis.rank),
        summary: `Exibindo ${activeItems.length} de ${analysis.stats.eligible} talentos disponíveis`,
      },
      today
    );
    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-talentos-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openDiscoverNav() {
    setActiveNav('discover');
    setView('all');
    setResultMode('discover');
    if (chosenCategories.size === 0 && !talentName.trim()) {
      setChosenCategories(new Set(categoriesList));
    }
    setResultPage(0);
  }

  function openFavoritesNav() {
    setActiveNav('favorites');
    setView('favorites');
    setComparisonMode('all');
    setResultMode('discover');
    setTalentName('');
    setChosenCategories(new Set(categoriesList));
    setSubcategory('all');
    setNetwork('all');
    setFollowerBand('0:0');
    setResultLimit('all');
    setIncludeOrganizations(true);
    setResultPage(0);
  }

  async function openGrowthDashboardNav() {
    setActiveNav('growthDashboard');
    if (researchSummaryOnly) {
      try {
        const full = await getHistory();
        if (Array.isArray(full?.rows)) {
          setRows(full.rows);
          setResearchSummaryOnly(false);
        }
      } catch {}
    }
  }

  const growthLimitNum =
    growthLimit === 'all' ? Infinity : Number(growthLimit) || 20;
  const growthItems = growthDashboard.ranked.slice(0, growthLimitNum);

  return (
    <>
      <header>
        <div className="brand">
          <h1>
            <span>◉</span> Radar de Talentos
          </h1>
          <p role="status" className="connection-badge">
            {status}
          </p>
        </div>
        <nav className="nav" aria-label="Navegação principal">
          <button
            type="button"
            id="discover"
            className={activeNav === 'discover' ? 'active' : ''}
            onClick={openDiscoverNav}
          >
            Descobrir talentos
          </button>
          <button
            type="button"
            id="fases123Open"
            className={activeNav === 'fases123' ? 'active' : ''}
            onClick={() => setActiveNav('fases123')}
          >
            Painel Completo (Fases 1–5)
          </button>
          <button
            type="button"
            id="geoRadarOpen"
            className={activeNav === 'geoRadar' ? 'active' : ''}
            onClick={() => setActiveNav('geoRadar')}
          >
            Radar Geográfico (Raio km)
          </button>
          <button
            type="button"
            id="eventTrendsOpen"
            className={activeNav === 'eventTrends' ? 'active' : ''}
            onClick={() => setActiveNav('eventTrends')}
          >
            Tendências e Oportunidades
          </button>
          <button
            type="button"
            id="growthDashboardOpen"
            className={activeNav === 'growthDashboard' ? 'active' : ''}
            onClick={openGrowthDashboardNav}
          >
            Quem está crescendo
          </button>
          <button
            type="button"
            id="favorites"
            className={activeNav === 'favorites' ? 'active' : ''}
            onClick={openFavoritesNav}
          >
            ♡ Favoritos ({favorites.size})
          </button>
          <button
            type="button"
            id="archives"
            className={activeNav === 'archives' ? 'active' : ''}
            onClick={() => setActiveNav('archives')}
          >
            Arquivos de pesquisa ({archives.length})
          </button>
        </nav>
      </header>

      <main>
        {activeNav === 'fases123' ? (
          <>
            <Radar />
            <AudienceStatus />
            <EventTrends />
            <Opportunities />
            <OpportunitiesRadar />
          </>
        ) : activeNav === 'geoRadar' ? (
          <>
            <AudienceStatus />
            <Radar />
            <GeoAudienceRadar />
          </>
        ) : activeNav === 'eventTrends' ? (
          <>
            <EventTrends />
            <Opportunities />
            <OpportunitiesRadar />
            <EventTrendsAndOpportunities />
          </>
        ) : activeNav === 'growthDashboard' ? (
          <section id="growthDashboard">
            <div className="sectionhead">
              <div>
                <h2>Quem está crescendo</h2>
                <p>
                  Crescimento desde a primeira coleta de cada rede. Confira as
                  datas e os dias acompanhados.
                </p>
              </div>
              <button
                type="button"
                id="growthDashboardClose"
                onClick={openDiscoverNav}
              >
                Voltar à pesquisa
              </button>
            </div>

            <div className="filters">
              <label>
                Categoria
                <select
                  id="growthCategory"
                  value={growthCategory}
                  onChange={e => setGrowthCategory(e.target.value)}
                >
                  <option value="all">Todas as categorias</option>
                  {categoriesList.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rede
                <select
                  id="growthNetwork"
                  value={growthNetwork}
                  onChange={e => setGrowthNetwork(e.target.value)}
                >
                  <option value="all">Todas as redes</option>
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Spotify">Spotify</option>
                </select>
              </label>
              <label>
                <span id="growthFollowerBandLabel">
                  Faixa de público nas redes selecionadas
                </span>
                <select
                  id="growthFollowerBand"
                  value={growthFollowerBand}
                  onChange={e => setGrowthFollowerBand(e.target.value)}
                >
                  <option value="0:0">Todas as faixas</option>
                  <option value="100000:0">Todas · a partir de 100 mil</option>
                  <option value="100000:300000">100 mil a 300 mil</option>
                  <option value="300000:500000">300 mil a 500 mil</option>
                  <option value="500000:700000">500 mil a 700 mil</option>
                  <option value="700000:900000">700 mil a 900 mil</option>
                  <option value="900000:1000001">900 mil a 1 milhão</option>
                  <option value="1000001:0">Acima de 1 milhão</option>
                </select>
              </label>
              <label>
                Mostrar
                <select
                  id="growthLimit"
                  value={growthLimit}
                  onChange={e => setGrowthLimit(e.target.value)}
                >
                  <option value="20">Top 20</option>
                  <option value="30">Top 30</option>
                  <option value="40">Top 40</option>
                  <option value="50">Top 50</option>
                  <option value="all">Todos</option>
                </select>
              </label>
              <button
                type="button"
                id="growthRefresh"
                className="primary"
                onClick={openGrowthDashboardNav}
              >
                Atualizar análise
              </button>
            </div>

            <p id="growthMessage" role="status" aria-live="polite">
              Desde a primeira coleta de cada rede ·{' '}
              {growthDashboard.ranked.length} perfis comparáveis ·{' '}
              {growthDashboard.fresh.length} novos ·{' '}
              {growthDashboard.pending.length} com histórico insuficiente.
            </p>

            <div
              className="tablebox"
              id="growthRanking"
              style={{ marginTop: 24 }}
            >
              {growthItems.length === 0 ? (
                <div className="empty">
                  Ainda sem dados suficientes para este período. Os novos perfis
                  continuam em acompanhamento abaixo.
                </div>
              ) : (
                <>
                  <div className="report-heading">
                    <span className="report-eyebrow">
                      RADAR · EVOLUÇÃO DOS TALENTOS
                    </span>
                    <h2>Crescimento desde o início</h2>
                    <div className="report-chips">
                      <span>{growthItems.length} talentos exibidos</span>
                      <span>
                        {growthNetwork === 'all'
                          ? 'Instagram + YouTube'
                          : growthNetwork}
                      </span>
                      <span>Dados reais coletados</span>
                    </div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Talento</th>
                        <th>Categoria</th>
                        <th>Rede</th>
                        <th>Público inicial</th>
                        <th>Público atual</th>
                        <th>Ganho no período</th>
                        <th>Crescimento</th>
                        <th>Primeira coleta → última coleta / Dias</th>
                        <th>Última coleta</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {growthItems.map((p, i) =>
                        p.networks.map((n, j) => (
                          <tr
                            key={`${p.key}-${n.key}-${j}`}
                            className={`${j === 0 ? 'talent-first ' : ''}${i % 2 ? 'talent-even' : 'talent-odd'}`}
                          >
                            {j === 0 && (
                              <>
                                <td
                                  className="report-position"
                                  rowSpan={p.networks.length}
                                >
                                  <span>{String(i + 1).padStart(2, '0')}</span>
                                </td>
                                <td rowSpan={p.networks.length}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEvolution(p)}
                                  >
                                    {p.nome}
                                  </button>
                                  {growthNetwork === 'all' && (
                                    <p className="small">
                                      Total comparável Instagram e YouTube:{' '}
                                      {p.gain > 0 ? '+' : ''}
                                      {formatNumber(p.gain)} ·{' '}
                                      {growthPct(p.score)}
                                    </p>
                                  )}
                                </td>
                                <td rowSpan={p.networks.length}>
                                  {p.categoria}
                                </td>
                              </>
                            )}
                            <td>{n.rede}</td>
                            <td>
                              {n.first
                                ? formatNumber(n.first.seguidores)
                                : 'Aguardando coleta'}
                            </td>
                            <td>
                              {formatNumber(n.latest?.seguidores)}
                              {n.rede === 'Spotify' && (
                                <>
                                  <br />
                                  <small>ouvintes mensais</small>
                                </>
                              )}
                            </td>
                            <td className="report-gain">
                              {n.pending
                                ? '—'
                                : `${n.gain > 0 ? '+' : ''}${formatNumber(n.gain)}`}
                            </td>
                            <td>
                              <span
                                className={`change-pill${n.gain < 0 ? ' is-negative' : ''}`}
                              >
                                {n.pending ? '—' : growthPct(n.pct)}
                              </span>
                            </td>
                            <td>
                              {n.first?.data || '—'} → {n.latest?.data || '—'}
                              <br />
                              {n.first
                                ? Math.round(
                                    (Date.parse(today) -
                                      Date.parse(n.first.data)) /
                                      86400000
                                  )
                                : 0}{' '}
                              dias desde o início
                            </td>
                            <td>{n.latest?.data || 'Aguardando coleta'}</td>
                            {j === 0 && (
                              <td rowSpan={p.networks.length}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEvolution(p)}
                                >
                                  Ver evolução ↗
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </section>
        ) : activeNav === 'archives' ? (
          <section className="panel" id="archivesView">
            <div className="sectionhead">
              <h2>Arquivos de pesquisa</h2>
              <button type="button" onClick={openDiscoverNav}>
                Voltar à pesquisa
              </button>
            </div>
            <p>
              Pesquisas salvas neste navegador, com os filtros e resultados do
              momento da consulta.
            </p>
            {archives.length === 0 ? (
              <p className="empty">
                Nenhuma pesquisa salva ainda. Clique em “Pesquisar” para criar
                seu primeiro arquivo.
              </p>
            ) : (
              <div className="chips" style={{ marginBottom: 16 }}>
                {archives.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={selectedArchiveId === a.id ? 'active' : ''}
                    onClick={() => setSelectedArchiveId(a.id)}
                  >
                    {formatDateBR(a.createdAt.slice(0, 10))} ·{' '}
                    {a.filters.name ||
                      (a.filters.categories || []).join(', ') ||
                      'Sem categorias'}{' '}
                    · {a.results.length} resultados
                  </button>
                ))}
              </div>
            )}
            {selectedArchiveId &&
              (() => {
                const a = archives.find(item => item.id === selectedArchiveId);
                if (!a) return null;
                return (
                  <div style={{ marginTop: 16 }}>
                    <h3>
                      Resultado salvo ·{' '}
                      {new Date(a.createdAt).toLocaleString('pt-BR')}
                    </h3>
                    <p>
                      <b>Nome pesquisado:</b>{' '}
                      {a.filters.name || 'Todos os talentos'} · <b>Período:</b>{' '}
                      {a.filters.start} a {a.filters.end} · <b>Resultados:</b>{' '}
                      {a.results.length}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = archives.filter(
                          item => item.id !== a.id
                        );
                        setArchives(updated);
                        setSelectedArchiveId(null);
                        try {
                          localStorage.setItem(
                            'radar-archives',
                            JSON.stringify(updated)
                          );
                        } catch {}
                      }}
                    >
                      Excluir esta pesquisa salva
                    </button>
                  </div>
                );
              })()}
          </section>
        ) : (
          <div id="researchView">
            <ResearchFilters
              categoriesList={categoriesList}
              taxonomy={taxonomy}
              rows={rows}
              chosenCategories={chosenCategories}
              onToggleCategory={handleToggleCategory}
              onToggleAllCategories={handleToggleAllCategories}
              comparisonMode={comparisonMode}
              onChangeComparisonMode={handleComparisonModeChange}
              network={network}
              onToggleNetworkCheckbox={handleToggleNetworkCheckbox}
              resultLimit={resultLimit}
              onChangeResultLimit={val => {
                setResultLimit(val);
                setResultPage(0);
              }}
              resultMode={resultMode}
              onChangeResultMode={val => {
                setResultMode(val);
                setResultPage(0);
                if (val === 'growth' && researchSummaryOnly) {
                  executeSearch({ modeOverride: 'growth' });
                }
              }}
              period={period}
              onChangePeriod={val => {
                setPeriod(val);
                if (val === 'available') setCalculation('available');
                setResultPage(0);
              }}
              start={start}
              end={end}
              onChangeStart={val => {
                setStart(val);
                setResultPage(0);
              }}
              onChangeEnd={val => {
                setEnd(val);
                setResultPage(0);
              }}
              subcategory={subcategory}
              onChangeSubcategory={val => {
                setSubcategory(val);
                setResultPage(0);
              }}
              followerBand={followerBand}
              onChangeFollowerBand={val => {
                setFollowerBand(val);
                setResultPage(0);
              }}
              calculation={calculation}
              onChangeCalculation={val => {
                setCalculation(val);
                setResultPage(0);
              }}
              rankingSort={rankingSort}
              onChangeRankingSort={val => {
                setRankingSort(val);
                setResultPage(0);
              }}
              monitoringBand={monitoringBand}
              onChangeMonitoringBand={val => {
                setMonitoringBand(val);
                setResultPage(0);
              }}
              includeOrganizations={includeOrganizations}
              onChangeIncludeOrganizations={val => {
                setIncludeOrganizations(val);
                setResultPage(0);
              }}
              onBroadenSearch={handleBroadenSearch}
              adjustmentStatus={adjustmentStatus}
              coverage={coverage}
              onSearch={() => executeSearch()}
              searchBusy={searchBusy}
              availableMode={analysis.available}
            />

            {searchFeedback && (
              <div
                id="searchFeedback"
                className={`search-feedback${searchFeedback.busy ? ' is-loading' : ''}${searchFeedback.error ? ' is-error' : ''}`}
                role="status"
                aria-live="polite"
              >
                {searchFeedback.message}
              </div>
            )}

            <ResultSummary
              stats={analysis.stats}
              items={activeItems}
              range={analysis.range}
              resultMode={resultMode}
              comparisonMode={comparisonMode}
              availableMode={analysis.available}
              talentName={talentName}
              resultNotice={resultNotice}
              hasSelection={hasSelection}
              onUseAvailableNetworks={() => handleComparisonModeChange('all')}
            />

            <ResearchTable
              resultMode={resultMode}
              availableMode={analysis.available}
              resultLimit={resultLimit}
              resultPage={resultPage}
              onPreviousPage={() => setResultPage(p => Math.max(0, p - 1))}
              onNextPage={() => setResultPage(p => p + 1)}
              discoveryPeople={analysis.people}
              rank={analysis.rank}
              stats={analysis.stats}
              range={analysis.range}
              allRows={rows}
              talentName={talentName}
              onChangeTalentName={val => {
                setTalentName(val);
                setResultPage(0);
              }}
              onSubmitNameSearch={() => executeSearch()}
              onExportCSV={handleExportCSV}
              hasSelection={hasSelection}
              view={view}
              onShowAvailableHistory={() => {
                setCalculation('available');
                setMonitoringBand('all');
                setResultPage(0);
              }}
              onShowCurrentProfiles={() => {
                setResultMode('discover');
                setResultPage(0);
              }}
              onSelectTalent={person => setSelectedTalentName(person.nome)}
              onOpenEvolution={handleOpenEvolution}
              searchBusy={searchBusy}
            />

            {selectedPerson && !evolutionPerson && (
              <div style={{ marginTop: 24 }}>
                <TalentDetailModal
                  person={selectedPerson}
                  open={false}
                  onClose={() => {}}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                  selectedNetwork={analysis.effectiveNetwork}
                  allRows={rows}
                  today={today}
                />
              </div>
            )}
          </div>
        )}

        {evolutionPerson && (
          <TalentDetailModal
            person={evolutionPerson}
            open={true}
            onClose={() => setEvolutionPerson(null)}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            selectedNetwork={analysis.effectiveNetwork}
            allRows={rows}
            today={today}
          />
        )}
      </main>

      <footer>
        Radar de Talentos · Crescimento social é um sinal para pesquisa; não
        garante venda de ingressos.
      </footer>
    </>
  );
}
