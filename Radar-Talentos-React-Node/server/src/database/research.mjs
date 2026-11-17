import { categories as defaultCategories, talentTaxonomy } from '../../../src/domain/taxonomy.js';
import { matchesTalent } from '../../../src/domain/research.js';

function historyKey(row) {
  return `${row.rede}|${row.url || row.channelId || row.nome}`;
}

export function queryTaxonomy(db) {
  if (!db) {
    return { categories: defaultCategories, taxonomy: talentTaxonomy };
  }
  const catRows = db
    .prepare('SELECT id, name FROM categories ORDER BY id')
    .all();
  const topicRows = db
    .prepare(
      `SELECT c.name AS category_name, t.name AS topic_name
       FROM topics t
       JOIN categories c ON c.id = t.category_id
       ORDER BY t.id`
    )
    .all();

  const taxonomy = {};
  for (const c of catRows) {
    taxonomy[c.name] = [];
  }
  for (const t of topicRows) {
    if (!taxonomy[t.category_name]) taxonomy[t.category_name] = [];
    taxonomy[t.category_name].push(t.topic_name);
  }
  const orderedCategories = defaultCategories.filter(c => c in taxonomy);
  for (const c of catRows) {
    if (!orderedCategories.includes(c.name)) orderedCategories.push(c.name);
  }
  return { categories: orderedCategories, taxonomy };
}

export function queryHistoryRows(db) {
  if (!db) {
    return { rows: [], historyStart: '', summaryOnly: false };
  }

  const talents = db
    .prepare(
      `SELECT id, name, entity_type
       FROM talents
       WHERE blocked = 0
       ORDER BY name ASC, id ASC`
    )
    .all();

  if (!talents.length) {
    return { rows: [], historyStart: '', summaryOnly: false };
  }

  const categoryRows = db
    .prepare(
      `SELECT tc.talent_id, c.name
       FROM talent_categories tc
       JOIN categories c ON c.id = tc.category_id
       JOIN talents t ON t.id = tc.talent_id
       WHERE t.blocked = 0
       ORDER BY c.id ASC`
    )
    .all();

  const topicRows = db
    .prepare(
      `SELECT tt.talent_id, c.name AS category_name, tp.name AS topic_name
       FROM talent_topics tt
       JOIN categories c ON c.id = tt.category_id
       JOIN topics tp ON tp.id = tt.topic_id AND tp.category_id = tt.category_id
       JOIN talents t ON t.id = tt.talent_id
       WHERE t.blocked = 0
       ORDER BY tp.id ASC`
    )
    .all();

  const accounts = db
    .prepare(
      `SELECT sa.id, sa.talent_id, sa.network, sa.external_id, sa.url,
              sa.identity_confirmed, sa.identity_source, sa.identity_evidence,
              sa.content_language, sa.collection_state, sa.retry_at, sa.last_error
       FROM social_accounts sa
       JOIN talents t ON t.id = sa.talent_id
       WHERE t.blocked = 0
         AND sa.blocked = 0
         AND NOT EXISTS (
           SELECT 1 FROM blocked_profiles bp
           WHERE bp.network = sa.network AND bp.url = sa.url
         )
       ORDER BY sa.created_at ASC, sa.id ASC`
    )
    .all();

  const snapshots = db
    .prepare(
      `SELECT ms.account_id, ms.network, ms.metric, ms.observed_on, ms.value,
              ms.is_rounded, ms.source, ms.collected_at
       FROM metric_snapshots ms
       JOIN social_accounts sa ON sa.id = ms.account_id
       JOIN talents t ON t.id = sa.talent_id
       WHERE t.blocked = 0 AND sa.blocked = 0
       ORDER BY ms.observed_on ASC, ms.id ASC`
    )
    .all();

  const categoriesByTalent = new Map();
  for (const row of categoryRows) {
    if (!categoriesByTalent.has(row.talent_id)) {
      categoriesByTalent.set(row.talent_id, []);
    }
    categoriesByTalent.get(row.talent_id).push(row.name);
  }

  const topicsByTalent = new Map();
  for (const row of topicRows) {
    if (!topicsByTalent.has(row.talent_id)) {
      topicsByTalent.set(row.talent_id, []);
    }
    topicsByTalent
      .get(row.talent_id)
      .push(`${row.category_name}|${row.topic_name}`);
  }

  const snapshotsByAccount = new Map();
  for (const snap of snapshots) {
    if (!snapshotsByAccount.has(snap.account_id)) {
      snapshotsByAccount.set(snap.account_id, []);
    }
    snapshotsByAccount.get(snap.account_id).push(snap);
  }

  const accountsByTalent = new Map();
  for (const acc of accounts) {
    if (!accountsByTalent.has(acc.talent_id)) {
      accountsByTalent.set(acc.talent_id, []);
    }
    accountsByTalent.get(acc.talent_id).push(acc);
  }

  const rows = [];
  let historyStart = '';

  for (const talent of talents) {
    const talentAccounts = accountsByTalent.get(talent.id) || [];
    if (!talentAccounts.length) continue;

    const cats = categoriesByTalent.get(talent.id) || [];
    const subcategorias = topicsByTalent.get(talent.id) || [];

    const hasPortugueseAnchor = talentAccounts.some(
      a =>
        ['Instagram', 'YouTube'].includes(a.network) &&
        (a.content_language === 'pt' || a.content_language === null)
    );

    for (const acc of talentAccounts) {
      const rawLang = acc.content_language;
      if (rawLang === 'en' || rawLang === 'es') {
        continue;
      }

      let contentLanguage = rawLang || (acc.network === 'Spotify' ? 'unknown' : 'pt');
      let languageExempt = false;

      if (['Instagram', 'YouTube'].includes(acc.network)) {
        if (contentLanguage !== 'pt') {
          if (
            contentLanguage === 'unknown' &&
            acc.identity_confirmed === 1 &&
            hasPortugueseAnchor
          ) {
            languageExempt = true;
          } else {
            continue;
          }
        }
      }

      const accSnapshots = snapshotsByAccount.get(acc.id) || [];
      const baseRow = {
        personId: talent.id,
        nome: talent.name,
        originalName: talent.name,
        entityType: talent.entity_type,
        categoria: cats[0] || '',
        categorias: cats,
        subcategorias,
        categoryReviewed: true,
        rede: acc.network,
        url: acc.url,
        ...(acc.network === 'YouTube' && acc.external_id
          ? { channelId: acc.external_id }
          : {}),
        ...(acc.network === 'Spotify' && acc.external_id
          ? { artistId: acc.external_id }
          : {}),
        identityConfirmed: Boolean(acc.identity_confirmed),
        ...(acc.identity_source ? { identitySource: acc.identity_source } : {}),
        ...(acc.identity_evidence
          ? { identityEvidence: acc.identity_evidence }
          : {}),
        ...(acc.retry_at ? { retryAt: acc.retry_at } : {}),
        ...(acc.last_error ? { collectionError: acc.last_error } : {}),
        contentLanguage,
        ...(languageExempt ? { languageExempt: true } : {}),
      };

      if (!accSnapshots.length) {
        rows.push({
          ...baseRow,
          data: '',
          seguidores: null,
          collectionPending: true,
          collectionState: acc.collection_state || 'queued',
        });
        continue;
      }

      for (const snap of accSnapshots) {
        if (!historyStart || snap.observed_on < historyStart) {
          historyStart = snap.observed_on;
        }
        rows.push({
          ...baseRow,
          data: snap.observed_on,
          seguidores: snap.value,
          rounded: Boolean(snap.is_rounded),
          metric: snap.metric,
          source: snap.source,
          collectedAt: snap.collected_at,
          collectionPending: false,
          collectionState:
            acc.collection_state === 'queued'
              ? 'collected'
              : acc.collection_state,
        });
      }
    }
  }

  return { rows, historyStart, summaryOnly: false };
}

export function summarizeResearchHistory(history, { start, end } = {}) {
  const profiles = new Map();
  for (const row of history.rows || []) {
    if (row.data && ((start && row.data < start) || (end && row.data > end))) {
      continue;
    }
    const key = historyKey(row);
    const pair = profiles.get(key);
    if (!pair) {
      profiles.set(key, { first: row, last: row });
    } else {
      if (row.data < pair.first.data) pair.first = row;
      if (row.data > pair.last.data) pair.last = row;
    }
  }
  return {
    ...history,
    historyStart:
      history.historyStart ||
      (history.rows || [])
        .map(r => r.data)
        .filter(Boolean)
        .sort()[0] ||
      '',
    summaryOnly: true,
    rows: [...profiles.values()].flatMap(p =>
      p.first === p.last ? [p.last] : [p.first, p.last]
    ),
  };
}

export function queryResearchSummary(db, { start, end } = {}) {
  const history = queryHistoryRows(db);
  return summarizeResearchHistory(history, { start, end });
}

export function queryEvolution(db, { personId, name } = {}) {
  const history = queryHistoryRows(db);
  return {
    ...history,
    rows: history.rows.filter(row =>
      personId ? row.personId === personId : matchesTalent(row.nome, name)
    ),
  };
}
