import { categories, talentTaxonomy, talentTopicKeys } from './taxonomy.js';

export const MONITORING_COHORTS = [
  '30 dias ou mais',
  '15–29 dias',
  '7–14 dias',
  '1–6 dias',
];

export const FOLLOWER_BAND_OPTIONS = [
  { value: '0:0', label: 'Todas as faixas' },
  { value: '100000:0', label: 'Todas · a partir de 100 mil' },
  { value: '100000:300000', label: '100 mil a 300 mil' },
  { value: '300000:500000', label: '300 mil a 500 mil' },
  { value: '500000:700000', label: '500 mil a 700 mil' },
  { value: '700000:900000', label: '700 mil a 900 mil' },
  { value: '900000:1000001', label: '900 mil a 1 milhão' },
  { value: '1000001:0', label: 'Acima de 1 milhão' },
];

export const RESULT_LIMIT_OPTIONS = [
  { value: '20', label: 'Top 20' },
  { value: '30', label: 'Top 30' },
  { value: '40', label: 'Top 40' },
  { value: '50', label: 'Top 50' },
  { value: 'all', label: 'Todos os disponíveis' },
];

export const PERIOD_OPTIONS = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '7', label: 'Últimos 7 dias' },
  { value: '15', label: 'Últimos 15 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'available', label: 'Desde o início do acompanhamento' },
  { value: 'custom', label: 'Datas personalizadas' },
];

export const RESULT_PAGE_SIZE = 50;
export const DAILY_PAGE_SIZE = 7;

export function brazilToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatNumber(n) {
  return Number.isFinite(n)
    ? new Intl.NumberFormat('pt-BR').format(n)
    : 'Aguardando coleta';
}

export function formatPct(n) {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`;
}

export function growthPct(v) {
  if (!Number.isFinite(v)) return '—';
  if (v !== 0 && Math.abs(v) < 0.005) {
    return v < 0 ? '− menos de 0,01%' : '+ menos de 0,01%';
  }
  return `${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`;
}

export function formatDateBR(dateStr) {
  if (!dateStr) return '—';
  return String(dateStr).split('-').reverse().join('/');
}

export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function identityName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:banda|dupla|canal|oficial|official)\s+)+/, '')
    .replace(/(?:\s*(?:vevo|oficial|official))+$/, '')
    .trim();
}

export const searchIdentity = identityName;

export function sameTalentIdentity(a, b) {
  const blocked =
    /\b(fa|fas|fan|fans|cover|covers|tributo|tribute|homenagem|cortes|clips|clipes|noticias)\b/i;
  const normA = String(a || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normB = String(b || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (blocked.test(normA) || blocked.test(normB)) return false;
  const x = identityName(a);
  const y = identityName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const duo = s =>
    s
      .split(' e ')
      .map(part => part.trim())
      .sort();
  const u = duo(x);
  const v = duo(y);
  return u.length === 2 && v.length === 2 && u.every((p, i) => p && p === v[i]);
}

export function matchesTalent(name, query) {
  const qNorm = normalizeName(query);
  if (!qNorm) return true;
  const nNorm = normalizeName(name);
  if (nNorm.includes(qNorm)) return true;
  const q = searchIdentity(query);
  const n = searchIdentity(name);
  if (!q) return false;
  if (n.includes(q)) return true;
  if (n.includes(' e ') && q.includes(' e ')) {
    return (
      n.split(' e ').sort().join('|') === q.split(' e ').sort().join('|')
    );
  }
  return false;
}

export function personKey(name) {
  return normalizeName(String(name ?? '').normalize('NFKD'))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^(?:canal|oficial|official)\s+(?=\S+\s+\S+)/, '')
    .replace(/\s+(?:oficial|official)$/, '')
    .trim();
}

export function profileKey(row) {
  try {
    const u = new URL(row.url);
    return (
      row.rede +
      '|' +
      u.hostname.toLowerCase() +
      u.pathname.replace(/\/$/, '').replace(/\/+/g, '/')
    );
  } catch {
    return row.rede + '|' + (row.channelId || personKey(row.nome));
  }
}

export function peopleGroups(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = row.personId ? `id:${row.personId}` : personKey(row.nome);
    if (!groups.has(key)) {
      groups.set(key, { key, nome: row.nome, rows: [] });
    }
    const group = groups.get(key);
    group.rows.push(row);
    if (row.rede === 'Instagram' && !/oficial|official/i.test(row.nome)) {
      group.nome = row.nome;
    }
  }
  return [...groups.values()];
}

const NETWORK_ORDER = ['Instagram', 'YouTube', 'Spotify', 'Facebook', 'LinkedIn'];

export function networkOrder(rede) {
  const idx = NETWORK_ORDER.indexOf(rede);
  return idx === -1 ? NETWORK_ORDER.length : idx;
}

export function orderedNetworks(rows) {
  return [...(rows || [])].sort(
    (a, b) => networkOrder(a.rede) - networkOrder(b.rede)
  );
}

export function networkSelected(rede, selection = 'all') {
  return selection === 'all' || String(selection).split('|').includes(rede);
}

export function comparisonNetworks(resultMode = 'discover', comparisonMode = 'all') {
  if (resultMode !== 'discover') return [];
  if (comparisonMode === 'three') return ['Instagram', 'YouTube', 'Spotify'];
  if (comparisonMode === 'two') return ['Instagram', 'YouTube'];
  return [];
}

export function comparisonLatest(rows, networks, end) {
  const minDate = shiftDate(end, -6);
  const recent = (rows || []).filter(
    r =>
      r.data >= minDate &&
      r.data <= end &&
      !r.collectionPending &&
      Number.isFinite(r.seguidores)
  );
  return networks
    .map(
      rede =>
        recent
          .filter(r => r.rede === rede)
          .sort(
            (a, b) =>
              b.data.localeCompare(a.data) ||
              b.seguidores - a.seguidores ||
              profileKey(a).localeCompare(profileKey(b))
          )[0]
    )
    .filter(Boolean);
}

export function followerBounds(followerBand = '100000:0') {
  const [min, max] = String(followerBand || '0:0')
    .split(':')
    .map(Number);
  return { min: Number.isFinite(min) ? min : 0, max: max || Infinity };
}

export function matchesFollowerReference(latest, network, min, max = Infinity) {
  return (latest || []).some(
    r =>
      networkSelected(r.rede, network) &&
      Number.isFinite(r.seguidores) &&
      !r.collectionPending &&
      r.seguidores >= min &&
      r.seguidores < max
  );
}

export function matchesTopics(rows, subcategory = 'all', chosenCategories = []) {
  const value = subcategory || 'all';
  if (value === 'all') return true;
  const parents =
    chosenCategories && chosenCategories.length
      ? [...chosenCategories]
      : Object.keys(talentTaxonomy);
  const keys = talentTopicKeys(rows).filter(t =>
    parents.includes(t.split('|')[0])
  );
  return value === 'undefined' ? !keys.length : keys.includes(value);
}

export function analysisRange({
  period = '30',
  start = '',
  end = '',
  today = brazilToday(),
  researchOldestDate = '',
  rows = [],
} = {}) {
  const resolvedEnd = period === 'custom' ? end : today;
  const resolvedStart =
    period === 'available'
      ? researchOldestDate ||
        (rows || [])
          .map(x => x.data)
          .filter(Boolean)
          .sort()[0] ||
        shiftDate(resolvedEnd, -90)
      : period === 'custom'
        ? start
        : shiftDate(resolvedEnd, -Number(period));
  return { start: resolvedStart, end: resolvedEnd };
}

export function latestProfiles(rows) {
  const latest = new Map();
  for (const row of [...(rows || [])].sort((a, b) =>
    String(a.data || '').localeCompare(String(b.data || ''))
  )) {
    latest.set(profileKey(row), row);
  }
  return orderedNetworks([...latest.values()]);
}

export function monitoringBand(days) {
  return days < 7
    ? '1–6 dias'
    : days < 15
      ? '7–14 dias'
      : days < 30
        ? '15–29 dias'
        : '30 dias ou mais';
}

export function audienceTotal(rows) {
  const profiles = latestProfiles(rows).filter(r =>
    ['Instagram', 'YouTube', 'Spotify'].includes(r.rede)
  );
  const valid = profiles.filter(
    r => Number.isFinite(r.seguidores) && !r.collectionPending
  );
  return {
    value: valid.length ? valid.reduce((sum, r) => sum + r.seguidores, 0) : null,
    partial: valid.length < profiles.length,
    networks: [...new Set(valid.map(r => r.rede))],
  };
}

export function socialRanking(network) {
  return (
    networkSelected('Instagram', network) || networkSelected('YouTube', network)
  );
}

export function comparableMetrics(networks, selection) {
  return (networks || []).filter(
    n => !socialRanking(selection) || n.rede !== 'Spotify'
  );
}

export function discoverySortValue(person, network = 'all') {
  const social = audienceTotal(person.rows).value;
  return socialRanking(network)
    ? social || 0
    : Math.max(
        0,
        ...(person.latest || [])
          .filter(r => r.rede === 'Spotify')
          .map(r => r.seguidores)
      );
}

export function selectedResultLimit(resultLimit = '20') {
  return resultLimit === 'all' ? Infinity : Number(resultLimit) || 20;
}

export function pageResults(items, resultLimit = '20', resultPage = 0, pageSize = RESULT_PAGE_SIZE) {
  return resultLimit === 'all'
    ? (items || []).slice(resultPage * pageSize, (resultPage + 1) * pageSize)
    : items || [];
}

export function buildAnalysis(rows = [], filters = {}) {
  const {
    talentName = '',
    chosenCategories = categories,
    subcategory = 'all',
    network = 'all',
    comparisonMode = 'all',
    resultMode = 'discover',
    period = '30',
    start = '',
    end = '',
    calculation = 'full',
    rankingSort = 'gain',
    monitoringBandFilter = 'all',
    followerBand = '100000:0',
    resultLimit = '20',
    includeOrganizations = false,
    view = 'all',
    favorites = new Set(),
    today = brazilToday(),
    researchOldestDate = '',
  } = filters;

  const chosenSet =
    chosenCategories instanceof Set
      ? chosenCategories
      : new Set(chosenCategories || []);
  const favSet =
    favorites instanceof Set ? favorites : new Set(favorites || []);

  const required = comparisonNetworks(resultMode, comparisonMode);
  const effectiveNetwork = required.length
    ? required.length === 3
      ? 'all'
      : required.join('|')
    : network;
  const r = analysisRange({
    period,
    start,
    end,
    today,
    researchOldestDate,
    rows,
  });
  const available = calculation === 'available' || period === 'available';
  const mode = resultMode;
  const allGroups = peopleGroups(rows);

  const stats = {
    total: allGroups.length,
    found: 0,
    category: 0,
    network: 0,
    entity: 0,
    followers: 0,
    favorites: 0,
    history: 0,
    noGain: 0,
    cohort: 0,
    eligible: 0,
  };

  const groups = allGroups.filter(g =>
    g.rows.some(
      x =>
        matchesTalent(x.nome, talentName) ||
        matchesTalent(x.originalName || '', talentName)
    )
  );
  stats.found = groups.length;

  const bounds = followerBounds(followerBand);
  const accepted = [];

  for (const g of groups) {
    if (
      chosenSet.size &&
      !g.rows.some(x =>
        (x.categorias || [x.categoria]).some(c => chosenSet.has(c))
      )
    ) {
      stats.category++;
      continue;
    }
    if (!matchesTopics(g.rows, subcategory, [...chosenSet])) {
      stats.category++;
      continue;
    }

    let groupRows = g.rows.filter(
      x =>
        (required.length
          ? required.includes(x.rede)
          : networkSelected(x.rede, effectiveNetwork)) &&
        (mode !== 'discover' ||
          (x.collectionPending && !x.data) ||
          (x.data >= r.start && x.data <= r.end))
    );
    if (required.length) {
      groupRows = comparisonLatest(groupRows, required, r.end);
    }
    if (
      !groupRows.length ||
      (required.length && groupRows.length !== required.length)
    ) {
      stats.network++;
      continue;
    }
    if (
      !includeOrganizations &&
      groupRows.every(x => x.entityType === 'organization')
    ) {
      stats.entity++;
      continue;
    }

    const latest = latestProfiles(groupRows);
    if (
      !matchesFollowerReference(
        latest,
        effectiveNetwork,
        bounds.min,
        bounds.max
      )
    ) {
      stats.followers++;
      continue;
    }
    if (
      view === 'favorites' &&
      !g.rows.some(x => favSet.has(x.nome) || favSet.has(x.originalName))
    ) {
      stats.favorites++;
      continue;
    }

    const person = {
      ...g,
      rows: groupRows,
      categorias: [
        ...new Set(
          groupRows.flatMap(x => x.categorias || [x.categoria]).filter(Boolean)
        ),
      ],
      latest,
      largest: Math.max(...latest.map(x => x.seguidores)),
    };

    if (mode === 'discover') {
      accepted.push(person);
      continue;
    }

    const histories = [...new Set(groupRows.map(profileKey))]
      .map(k =>
        groupRows
          .filter(
            x =>
              profileKey(x) === k &&
              Number.isFinite(x.seguidores) &&
              x.data >= r.start &&
              x.data <= r.end
          )
          .sort((a, b) => a.data.localeCompare(b.data))
      )
      .filter(h => h.length >= 2);

    const networks = [];
    for (const hist of histories) {
      const startRow = available
        ? hist[0]
        : hist.find(x => x.data === r.start);
      const endRow = available
        ? hist.at(-1)
        : hist.find(x => x.data === r.end);
      if (
        !startRow ||
        !endRow ||
        startRow.data >= endRow.data ||
        startRow.seguidores <= 0
      ) {
        continue;
      }
      const days = Math.round(
        (Date.parse(endRow.data) - Date.parse(startRow.data)) / 86400000
      );
      const gain = endRow.seguidores - startRow.seguidores;
      networks.push({
        rede: endRow.rede,
        start: startRow,
        end: endRow,
        days,
        gain,
        pct: (gain / startRow.seguidores) * 100,
        hist: hist.filter(
          x => x.data >= startRow.data && x.data <= endRow.data
        ),
      });
    }

    const scoring = comparableMetrics(networks, effectiveNetwork);
    if (!scoring.length) {
      stats.history++;
      continue;
    }
    const gain = scoring.reduce((n, x) => n + x.gain, 0);
    const totalStart = scoring.reduce((n, x) => n + x.start.seguidores, 0);
    const score = (gain / totalStart) * 100;
    const days = scoring[0].days;
    const cohort = monitoringBand(days);

    if (gain <= 0) {
      stats.noGain++;
      continue;
    }
    if (
      available &&
      monitoringBandFilter !== 'all' &&
      monitoringBandFilter !== cohort
    ) {
      stats.cohort++;
      continue;
    }

    accepted.push({
      ...person,
      categoria: person.categorias.join(', '),
      networks: orderedNetworks(networks),
      gain,
      score,
      days,
      cohort,
      aliases: [
        ...new Set(
          groupRows.flatMap(x => [x.nome, x.originalName].filter(Boolean))
        ),
      ],
    });
  }

  accepted.sort((a, b) =>
    mode === 'discover'
      ? discoverySortValue(b, effectiveNetwork) -
          discoverySortValue(a, effectiveNetwork) ||
        a.nome.localeCompare(b.nome)
      : rankingSort === 'percent'
        ? b.score - a.score ||
          b.gain - a.gain ||
          a.nome.localeCompare(b.nome)
        : b.gain - a.gain ||
          b.score - a.score ||
          a.nome.localeCompare(b.nome)
  );
  stats.eligible = accepted.length;

  const limit = selectedResultLimit(resultLimit);
  if (mode === 'discover') {
    return {
      stats,
      people: accepted.slice(0, limit),
      rank: [],
      available,
      range: r,
      effectiveNetwork,
    };
  }
  if (!available) {
    return {
      stats,
      people: [],
      rank: accepted.slice(0, limit),
      available,
      range: r,
      effectiveNetwork,
    };
  }
  return {
    stats,
    people: [],
    rank: MONITORING_COHORTS.flatMap(c =>
      accepted.filter(p => p.cohort === c)
    ).slice(0, limit),
    available,
    range: r,
    effectiveNetwork,
  };
}

export function growthDisplayNetworks(person) {
  return orderedNetworks(
    latestProfiles(person.rows).map(
      end =>
        (person.networks || []).find(
          n => profileKey(n.end) === profileKey(end)
        ) || {
          pending: true,
          rede: end.rede,
          end,
        }
    )
  );
}

export function growthPendingReason(person, network, range) {
  const dates = [
    ...new Set(
      (person.rows || [])
        .filter(
          row =>
            profileKey(row) === profileKey(network.end) &&
            Number.isFinite(row.seguidores) &&
            !row.collectionPending &&
            row.data >= range.start &&
            row.data <= range.end
        )
        .map(row => row.data)
    ),
  ].sort();
  if (dates.length === 1) {
    return `Somente uma coleta · ${dates[0]} · aguardando outra data`;
  }
  if (dates.length > 1) {
    return 'Sem comparação nas datas exatas do período';
  }
  return 'Sem coleta válida neste período';
}

export function computeCoverage(
  rows = [],
  { includeOrganizations = false, categoriesList = categories } = {}
) {
  const groups = peopleGroups(rows).filter(
    g =>
      includeOrganizations ||
      g.rows.some(r => r.entityType !== 'organization')
  );
  const has = (g, n) => g.rows.some(r => r.rede === n);
  const byCategory = categoriesList.map(category => {
    const people = groups.filter(g =>
      g.rows.some(r => (r.categorias || [r.categoria]).includes(category))
    );
    return {
      category,
      talents: people.length,
      Instagram: people.filter(g => has(g, 'Instagram')).length,
      YouTube: people.filter(g => has(g, 'YouTube')).length,
      Spotify: people.filter(g => has(g, 'Spotify')).length,
      both: people.filter(g => has(g, 'Instagram') && has(g, 'YouTube')).length,
    };
  });
  return {
    totalTalents: groups.length,
    includeOrganizations,
    byCategory,
  };
}

export function collectionLabel(row) {
  if (row?.collectionState === 'language-pending') {
    return 'Idioma em verificação · contagem não incluída';
  }
  if (row?.collectionState === 'unavailable' || row?.collectionState === 'error') {
    return 'Consulta indisponível';
  }
  if (row?.collectionState === 'paused') {
    return 'Aguardando próxima rodada';
  }
  return 'Aguardando coleta · na fila';
}

export function profileURL(network, allRows = []) {
  const valid = row => {
    try {
      const url = new URL(row?.url);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };
  for (const row of [network?.end, network?.start, network]) {
    const url = valid(row);
    if (url) return url;
  }
  const reference = network?.end || network?.start || network;
  if (!reference || !Array.isArray(allRows) || !allRows.length) return '';
  for (const row of allRows
    .filter(
      r =>
        r.nome === reference.nome &&
        r.rede === (network?.rede || reference.rede)
    )
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))) {
    const url = valid(row);
    if (url) return url;
  }
  return '';
}

export function growthNetworkStatus(rows, rede, start, end) {
  const found = (rows || []).filter(r => r.rede === rede);
  if (!found.length) {
    return { label: 'Perfil não identificado nesta consulta', rows: [], hist: [] };
  }
  const profile = latestProfiles(found).sort(
    (a, b) => (b.seguidores || 0) - (a.seguidores || 0)
  )[0];
  const same = found.filter(r => profileKey(r) === profileKey(profile));
  const hist = [
    ...new Map(
      same
        .filter(
          r =>
            Number.isFinite(r.seguidores) &&
            !r.collectionPending &&
            r.data >= start &&
            r.data <= end
        )
        .sort((a, b) => a.data.localeCompare(b.data))
        .map(r => [r.data, r])
    ).values(),
  ];
  const first = hist[0];
  const last = hist.at(-1);
  const latest = [...same]
    .filter(
      r => Number.isFinite(r.seguidores) && !r.collectionPending && r.data <= end
    )
    .sort((a, b) => a.data.localeCompare(b.data))
    .at(-1);

  const label = !latest
    ? 'Aguardando coleta'
    : hist.length < 2
      ? 'Acompanhamento iniciado · aguardando outra data'
      : first.seguidores <= 0
        ? 'Público inicial insuficiente para percentual'
        : 'Comparação completa';

  return { label, profile, latest, first, last, hist, rows: same };
}

export function discoveryEvolutionModel(person, end = brazilToday(), selectedNetwork = 'all') {
  const rows = person?.rows || [];
  const start =
    rows
      .map(r => r.data)
      .filter(Boolean)
      .sort()[0] || end;
  const networkFilter = person?.evolutionNetwork || selectedNetwork;

  const networks = ['Instagram', 'YouTube']
    .filter(rede => networkSelected(rede, networkFilter))
    .map(rede => {
      const n = growthNetworkStatus(rows, rede, start, end);
      const valid = Boolean(
        n.first && n.last && n.first.data < n.last.data && n.first.seguidores > 0
      );
      return {
        ...n,
        rede,
        valid,
        gain: valid ? n.last.seguidores - n.first.seguidores : null,
        pct: valid
          ? ((n.last.seguidores - n.first.seguidores) / n.first.seguidores) * 100
          : null,
      };
    });

  const spotifyHist = rows
    .filter(
      r =>
        r.rede === 'Spotify' &&
        Number.isFinite(r.seguidores) &&
        !r.collectionPending &&
        r.data <= end
    )
    .sort((a, b) => a.data.localeCompare(b.data));
  const spotifyFirst = spotifyHist[0];
  const spotifyLatest = spotifyHist.at(-1);
  const spotifyValid = Boolean(
    spotifyFirst &&
      spotifyLatest &&
      spotifyFirst.data < spotifyLatest.data &&
      spotifyFirst.seguidores > 0
  );

  const total = networks.reduce((v, n) => v + (n.latest?.seguidores || 0), 0);
  const gain = networks
    .filter(n => n.valid)
    .reduce((v, n) => v + n.gain, 0);
  const comparable = networks.filter(n => n.valid).length;

  if (networkSelected('Spotify', networkFilter)) {
    networks.push({
      rede: 'Spotify',
      hist: spotifyHist,
      first: spotifyFirst,
      last: spotifyLatest,
      latest: spotifyLatest,
      profile: spotifyLatest || rows.find(r => r.rede === 'Spotify'),
      valid: spotifyValid,
      gain: spotifyValid
        ? spotifyLatest.seguidores - spotifyFirst.seguidores
        : null,
      pct: spotifyValid
        ? ((spotifyLatest.seguidores - spotifyFirst.seguidores) /
            spotifyFirst.seguidores) *
          100
        : null,
      label: 'Sem coleta do Spotify para este talento',
    });
  }

  return { start, end, networks, total, gain, comparable };
}

export function dailyEvolutionData(networks) {
  const series = (networks || []).map(n => {
    const hist = [
      ...new Map(
        (n.hist || [])
          .filter(r => Number.isFinite(r.seguidores) && !r.collectionPending)
          .sort((a, b) => a.data.localeCompare(b.data))
          .map(r => [r.data, r])
      ).values(),
    ];
    return {
      rede: n.rede,
      hist,
      byDate: new Map(
        hist.map((r, i) => [
          r.data,
          {
            ...r,
            percent:
              hist[0].seguidores > 0
                ? ((r.seguidores - hist[0].seguidores) / hist[0].seguidores) * 100
                : null,
            gain: i ? r.seguidores - hist[i - 1].seguidores : null,
            previous: i ? hist[i - 1].data : null,
          },
        ])
      ),
    };
  });
  const observed = series.flatMap(n => n.hist.map(r => r.data)).sort();
  const dates = [];
  if (observed.length) {
    for (let d = observed[0]; d <= observed.at(-1); d = shiftDate(d, 1)) {
      dates.push(d);
    }
  }
  return { series, dates };
}

export function dailyEvolutionPage(model, page = null, size = DAILY_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(model.dates.length / size));
  const current =
    page === null ? pages - 1 : Math.max(0, Math.min(page, pages - 1));
  const leading = model.dates.length - (pages - 1) * size;
  const start = current === 0 ? 0 : leading + (current - 1) * size;
  const end = current === 0 ? leading : start + size;
  return { pages, current, dates: model.dates.slice(start, end) };
}

export function dailyEvolutionWindow(networks, options = {}) {
  const model = dailyEvolutionData(networks);
  const last = model.dates.at(-1);
  const period = options.period || '7';
  const end = period === 'custom' ? options.end : last;
  const start =
    period === 'custom'
      ? options.start
      : last
        ? shiftDate(last, 1 - Number(period))
        : null;
  return {
    ...model,
    dates: model.dates.filter(d => (!start || d >= start) && (!end || d <= end)),
    start,
    end,
    period,
  };
}

export function dailyChangeLabel(row, date) {
  return row && row.previous === shiftDate(date, -1)
    ? row.gain === 0
      ? 'Sem mudança'
      : `${row.gain > 0 ? '+' : ''}${formatNumber(row.gain)} no dia`
    : 'Sem comparação diária';
}

export function growthDashboardData(
  rows = [],
  days = 0,
  network = 'all',
  category = 'all',
  sort = 'gain',
  end = brazilToday(),
  band = '0:0'
) {
  const [minFollowers, maxFollowers] = String(band || '0:0')
    .split(':')
    .map(Number);
  const since = days === 0;
  const start = since
    ? (rows || [])
        .map(r => r.data)
        .filter(Boolean)
        .sort()[0] || end
    : shiftDate(end, -days);
  const groups = peopleGroups(rows).filter(
    g =>
      category === 'all' ||
      g.rows.some(r => (r.categorias || [r.categoria]).includes(category))
  );
  const ranked = [];
  const fresh = [];
  const pending = [];

  for (const g of groups) {
    if (g.rows.every(r => r.entityType === 'organization')) continue;
    const profiles = new Map();
    for (const row of g.rows.filter(
      r =>
        ['Instagram', 'YouTube', 'Spotify'].includes(r.rede) &&
        networkSelected(r.rede, network)
    )) {
      const k = profileKey(row);
      if (!profiles.has(k)) profiles.set(k, []);
      profiles.get(k).push(row);
    }
    const entries = [];
    for (const [key, rs] of profiles) {
      const hist = [
        ...new Map(
          rs
            .filter(
              r =>
                Number.isFinite(r.seguidores) &&
                !r.collectionPending &&
                r.data <= end
            )
            .sort((a, b) => a.data.localeCompare(b.data))
            .map(r => [r.data, r])
        ).values(),
      ];
      const latest = hist.at(-1);
      const first = hist[0];
      const a = since ? first : hist.find(r => r.data === start);
      const b = since ? latest : hist.find(r => r.data === end);
      const valid = Boolean(a && b && a.data < b.data && a.seguidores > 0);
      entries.push({
        key,
        rede: rs[0].rede,
        latest,
        first,
        hist,
        start: a || null,
        end: b || latest || rs.at(-1),
        current: latest,
        days:
          a && b
            ? Math.round((Date.parse(b.data) - Date.parse(a.data)) / 86400000)
            : 0,
        pending: !valid,
        gain: valid ? b.seguidores - a.seguidores : null,
        pct: valid ? ((b.seguidores - a.seguidores) / a.seguidores) * 100 : null,
      });
    }
    if (
      !entries.length ||
      !matchesFollowerReference(
        entries.map(n => n.latest).filter(Boolean),
        network,
        minFollowers,
        maxFollowers || Infinity
      ) ||
      (network === 'Spotify' &&
        !entries.some(
          n =>
            n.latest &&
            n.latest.seguidores >= minFollowers &&
            n.latest.seguidores < (maxFollowers || Infinity)
        ))
    ) {
      continue;
    }

    const networks = orderedNetworks(entries);
    const valid = comparableMetrics(
      networks.filter(n => !n.pending),
      network
    );
    const first = networks
      .map(n => n.first)
      .filter(Boolean)
      .sort((a, b) => a.data.localeCompare(b.data))[0];
    const latest = networks
      .map(n => n.latest)
      .filter(Boolean)
      .sort((a, b) => a.data.localeCompare(b.data))
      .at(-1);
    const item = {
      key: network === 'all' ? g.key : entries[0].key,
      nome: g.nome,
      rows: g.rows,
      network,
      networks,
      first,
      latest,
      categoria: [
        ...new Set(
          g.rows.flatMap(r => r.categorias || [r.categoria]).filter(Boolean)
        ),
      ].join(', '),
    };
    if (valid.length) {
      const gain = valid.reduce((v, n) => v + n.gain, 0);
      const initial = valid.reduce((v, n) => v + n.start.seguidores, 0);
      ranked.push({ ...item, gain, score: (gain / initial) * 100 });
    } else if (first && (since || first.data > start)) {
      fresh.push(item);
    } else {
      pending.push(item);
    }
  }

  ranked.sort((a, b) =>
    sort === 'percent'
      ? b.score - a.score || b.gain - a.gain || a.nome.localeCompare(b.nome)
      : b.gain - a.gain || b.score - a.score || a.nome.localeCompare(b.nome)
  );
  fresh.sort((a, b) => b.first.data.localeCompare(a.first.data));
  return { ranked, fresh, pending, start, end };
}

export function analysisSnapshot(resultMode, discoveryPeople, rank) {
  return resultMode === 'discover'
    ? (discoveryPeople || []).map(p => ({
        nome: p.nome,
        categoria: (p.categorias || []).join(', '),
        gain: null,
        score: null,
        networks: (p.latest || []).map(end => ({
          rede: end.rede,
          end,
          start: end,
        })),
      }))
    : (rank || []).map(p => ({
        ...p,
        networks: (p.networks || []).map(n => ({
          ...n,
          current:
            latestProfiles(p.rows).find(
              r => profileKey(r) === profileKey(n.end)
            ) || n.end,
        })),
      }));
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function reportCSV(snapshot, today = brazilToday()) {
  const f = snapshot?.filters || {};
  const rows = [
    ['Radar de Talentos'],
    [
      'Data',
      new Date(snapshot?.createdAt || Date.now()).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      }),
    ],
    [
      'Lista',
      f.resultMode === 'discover'
        ? 'Descoberta por seguidores atuais'
        : 'Crescimento',
    ],
    ['Análise', f.calculation || 'full'],
    [
      'Referência',
      f.calculation === 'since-first'
        ? 'Primeira coleta válida de cada rede'
        : 'Período selecionado',
    ],
    ['Período', f.start, f.end],
    ['Faixa de seguidores', f.followerBand || f.minFollowers],
    ['Faixa de ouvintes Spotify', f.spotifyBand || 'Todas'],
    [
      'Rede de referência da faixa',
      f.network === 'YouTube' ? 'YouTube' : 'Instagram',
    ],
    ['Ordem', f.rankingCriterion || 'gain'],
    ['Categorias', (f.categories || []).join(', ')],
    ['Redes', f.network === 'all' ? 'Todas as redes' : f.network || ''],
    [
      'Comparação',
      f.resultMode === 'discover'
        ? 'Total soma seguidores, inscritos e ouvintes mensais das redes exibidas; não representa pessoas únicas.'
        : 'Crescimento usa redes com histórico comparável; não representa pessoas únicas.',
    ],
    ['Resumo', snapshot?.summary || ''],
    [],
    [
      'Posição na faixa',
      'Talento',
      'Categoria',
      'Tempo acompanhado',
      'Rede',
      'Público anterior',
      'Público atual',
      'Data da coleta',
      'Data inicial',
      'Data final',
      'Dias desde a primeira coleta',
      'Novos seguidores',
      'Crescimento percentual',
      'Link',
      'Total das redes',
    ],
  ];

  const positions = {};
  for (const x of snapshot?.results || []) {
    const band = x.cohort || 'Período';
    positions[band] = (positions[band] || 0) + 1;
    for (const n of x.networks || []) {
      rows.push([
        positions[band],
        x.nome,
        x.categoria,
        x.cohort || '',
        n.rede === 'Spotify' ? 'Spotify · ouvintes mensais' : n.rede,
        n.pending ? '' : n.start?.seguidores,
        n.current?.seguidores ?? n.end?.seguidores,
        n.current?.data ?? n.end?.data,
        n.start?.data,
        n.end?.data,
        n.start?.data
          ? Math.round((Date.parse(today) - Date.parse(n.start.data)) / 86400000)
          : '',
        n.gain ?? '',
        Number.isFinite(n.pct) ? n.pct.toFixed(2) : '',
        profileURL(n),
        f.resultMode === 'discover'
          ? audienceTotal(
              (x.networks || []).map(v => v.current || v.end).filter(Boolean)
            ).value ?? ''
          : '',
      ]);
    }
  }
  return rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}
