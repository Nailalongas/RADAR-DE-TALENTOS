const COLLECTION_CHECK_PREFIX = 'collection-check/';
const COLLECTION_CHECK_LABELS = ['YouTube', 'Instagram', 'Spotify'];

async function collectionCheckRead(bucket, key) {
  const object = await bucket.get(key);
  return object ? object.json() : null;
}

function collectionCheckReasons(items) {
  const counts = new Map();
  for (const item of items) {
    const error = String(item.error || item.reason || '');
    let label = 'Outra falha na consulta';
    if (/bloqueado pela curadoria/i.test(error)) label = 'Perfil bloqueado pela curadoria';
    else if (/cota|limite|temporariamente/i.test(error)) label = 'Limite de consultas';
    else if (/identificador|ambíguo|nome do artista não confere/i.test(error)) label = 'Link oficial não confirmado ou nome ambíguo';
    else if (/autorização|reconect/i.test(error)) label = 'Conexão precisa de revisão';
    else if (/indisponível|não encontrado|recusou a consulta/i.test(error)) label = 'Conta ou contagem indisponível';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts].map(([label, count]) => ({label, count})).sort((a, b) => b.count - a.count);
}

async function collectionCheckNetworks(bucket, date, now) {
  const [youtube, instagram, spotify, attempts, metaLimit] = await Promise.all([
    collectionCheckRead(bucket, 'runs/latest.json'),
    collectionCheckRead(bucket, 'ig-runs/latest.json'),
    collectionCheckRead(bucket, 'spotify/public/status.json'),
    collectionCheckRead(bucket, 'spotify/public/days/' + date + '.json'),
    collectionCheckRead(bucket, 'ig-budget/control.json')
  ]);
  const spotifyDay = spotifyPublicDailySummary(date, attempts || []);
  return [youtube, instagram, spotify].map((run, i) => {
    const isSpotify = i === 2;
    const collected = isSpotify ? spotifyDay.collected : run?.date === date ? run.collected || 0 : 0;
    const failureCount = Array.isArray(run?.failed) ? run.failed.length : null;
    const youtubeQuota = i === 0 && run?.date === date &&
      (Array.isArray(run.failed) ? run.failed : []).some(item => /cota do YouTube/i.test(item.error || ''));
    const paused = youtubeQuota || i === 1 && metaLimit?.resumeAt > now || isSpotify && Date.parse(run?.retryAfter) > now;
    const recent = run?.date === date && (isSpotify || Date.parse(run?.completedAt) >= now - 2 * 60 * 60 * 1000);
    const pending = isSpotify ? spotifyDay.pending : run?.date === date ? run.remaining ?? null : null;
    const ready = isSpotify ? spotifyDay.readyProfiles?.[0] : null;
    const canWorkOnQueue = isSpotify ? !!ready : pending > 0 && (i === 0 || run.queuedForNextRound > 0);
    const failures = isSpotify ? spotifyDay.pendingProfiles || [] :
      run?.date === date && Array.isArray(run.failed) ? run.failed : [];
    const message = paused ? 'Limite temporário da rede em vigor.' :
      !recent ? 'Sem rodada recente registrada.' :
      !collected ? 'Nenhuma contagem salva hoje.' : '';
    return {
      network: COLLECTION_CHECK_LABELS[i],
      lastRunAt: run?.completedAt || null,
      collected,
      total: !isSpotify && run?.date === date ? run.total ?? null : null,
      pending,
      readyForCollection: isSpotify ? spotifyDay.readyForCollection ?? 0 : null,
      queued: i === 1 && run?.date === date ? run.queuedForNextRound ?? null : null,
      waitingRetry: i === 1 && run?.date === date ? run.waitingRetry ?? null : null,
      reasons: collectionCheckReasons(failures),
      failures: isSpotify ? spotifyDay.failedAttempts : run?.date === date ? failureCount : null,
      paused: !!paused,
      needsRetry: !paused && (!recent || !collected || canWorkOnQueue),
      message
    };
  });
}

async function collectionCheckApi(request, env) {
  const date = igDate(), bucket = env.BUCKET;
  const key = COLLECTION_CHECK_PREFIX + date + '.json';
  if (request.method === 'GET') return json({date, report: await collectionCheckRead(bucket, key)});
  if (request.method !== 'POST') return json({error:'Método não permitido.'}, 405);
  const body = await request.json().catch(() => ({}));
  const automatic = body?.recover === true;
  const existing = await collectionCheckRead(bucket, key);
  if (existing && (!automatic || existing.automatic)) return json({date, report:existing});
  const leaseKey = COLLECTION_CHECK_PREFIX + date + '.lock';
  const lease = await bucket.get(leaseKey);
  const now = Date.now();
  if (lease && (await lease.json()).expiresAt > now) return json({date, running:true}, 202);
  const onlyIf = new Headers(lease ? {'If-Match':lease.httpEtag || lease.etag} : {'If-None-Match':'*'});
  if (!await bucket.put(leaseKey, JSON.stringify({expiresAt:now + 5 * 60 * 1000}), {onlyIf})) {
    return json({date, running:true}, 202);
  }
  try {
    const saved = await collectionCheckRead(bucket, key);
    if (saved && (!automatic || saved.automatic)) return json({date, report:saved});
    const before = await collectionCheckNetworks(bucket, date, now);
    const actions = {};
    if (automatic) {
      for (const network of before.filter(item => item.needsRetry)) {
        const name = network.network;
        try {
          if (name === 'YouTube') {
            if (!await youtubeKey(env)) {
              actions[name] = 'Aguardando configuração do YouTube.';
              continue;
            }
            await runDaily(env, {recovery:true});
          } else if (name === 'Instagram') {
            const connection = await igRead(env, 'connection');
            if (!connection || connection.expiresAt && connection.expiresAt <= Date.now()) {
              actions[name] = 'Aguardando reconexão com a Meta.';
              continue;
            }
            await collectInstagram(env, {limit:5});
          } else {
            const attempts = await collectionCheckRead(bucket, 'spotify/public/days/' + date + '.json');
            const {readyProfiles = []} = spotifyPublicDailySummary(date, attempts || []);
            const ready = readyProfiles[0];
            const input = ready ? {name:ready.name, url:ready.url, limit:1} : {mode:'refresh', limit:1};
            const response = await spotifyPublicApi(new Request(request.url, {
              method:'POST', body:JSON.stringify(input)
            }), env);
            const result = await response.json();
            if (!response.ok || result.paused || result.error || !result.collected) {
              actions[name] = 'Nova tentativa sem contagem salva.';
              continue;
            }
          }
          actions[name] = 'Nova tentativa executada.';
        } catch {
          actions[name] = 'Nova tentativa falhou. Confira a conexão da rede.';
        }
      }
    }
    const networks = await collectionCheckNetworks(bucket, date, Date.now());
    const report = {date, automatic, checkedAt:new Date().toISOString(), networks:networks.map(item => ({
      ...item, action:actions[item.network] || ''
    }))};
    await bucket.put(key, JSON.stringify(report));
    return json({date, report});
  } finally {
    await bucket.delete(leaseKey);
  }
}

