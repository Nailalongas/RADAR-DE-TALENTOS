import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/src/database/index.mjs';
import { importRegistry, importNationalMetrics } from '../server/src/registry.mjs';
import { instagramMetrics, youtubeMetrics, spotifyMetrics, spotifyToken } from '../server/src/connectors.mjs';
import { runOperations, localDay } from '../server/src/operations.mjs';
import { commercialQuery } from '../server/src/commercial.mjs';

const day = localDay();
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

function seedAccounts(db) {
  importRegistry(db, {
    talents: [
      { id: 'claudio-duarte', name: 'Pastor Cláudio Duarte', categories: ['palestrantes', 'humoristas'], modalities: ['palestras', 'humor'] }
    ],
    accounts: [
      {
        id: 'ig-claudio',
        talent_id: 'claudio-duarte',
        network: 'Instagram',
        external_id: 'claudioduarte',
        url: 'https://www.instagram.com/claudioduarte',
        identity_confirmed: 1,
        identity_source: 'Perfil oficial verificado'
      },
      {
        id: 'yt-claudio',
        talent_id: 'claudio-duarte',
        network: 'YouTube',
        external_id: 'UCclaudioduarte123',
        url: 'https://www.youtube.com/@claudioduarte',
        identity_confirmed: 1,
        identity_source: 'Canal oficial verificado'
      },
      {
        id: 'sp-claudio',
        talent_id: 'claudio-duarte',
        network: 'Spotify',
        external_id: '4ClaudioSpotifyId12345',
        url: 'https://open.spotify.com/artist/4ClaudioSpotifyId12345',
        identity_confirmed: 1,
        identity_source: 'Artista oficial verificado'
      }
    ],
    snapshots: []
  });
}

test('conectores oficiais: Instagram (Business Discovery), YouTube Data API v3 e Spotify Web API (OAuth client_credentials)', async () => {
  const db = openDatabase(':memory:');
  try {
    seedAccounts(db);

    const igBatch = await instagramMetrics(
      db,
      { accountId: 'ig-claudio', businessAccountId: '17841400000000000', tokenEnv: 'IG_TOKEN', authorizationRef: 'meta-app-1' },
      {
        day,
        now: new Date(day + 'T06:00:00.000Z'),
        env: { IG_TOKEN: 'meta-secret-token' },
        fetcher: async (url, opts) => {
          assert.equal(url.hostname, 'graph.facebook.com');
          assert.equal(opts.headers.Authorization, 'Bearer meta-secret-token');
          assert.match(url.searchParams.get('fields'), /business_discovery\.username\(claudioduarte\)/);
          return response({
            business_discovery: {
              username: 'claudioduarte',
              followers_count: 4012,
              media_count: 850
            }
          });
        }
      }
    );
    assert.equal(igBatch.rows[0].value, 4012);
    assert.equal(igBatch.rows[0].metric, 'followers');

    const ytBatch = await youtubeMetrics(
      db,
      { accountId: 'yt-claudio', tokenEnv: 'YT_TOKEN', authorizationRef: 'google-cloud-1' },
      {
        day,
        now: new Date(day + 'T06:05:00.000Z'),
        env: { YT_TOKEN: 'yt-secret-token' },
        fetcher: async (url, opts) => {
          assert.equal(url.hostname, 'www.googleapis.com');
          assert.equal(url.searchParams.get('id'), 'UCclaudioduarte123');
          assert.equal(opts.headers.Authorization, 'Bearer yt-secret-token');
          return response({
            items: [
              {
                id: 'UCclaudioduarte123',
                statistics: { subscriberCount: '2540000', viewCount: '198000000', hiddenSubscriberCount: false }
              }
            ]
          });
        }
      }
    );
    assert.equal(ytBatch.rows[0].value, 2540000);
    assert.equal(ytBatch.rows[0].metric, 'subscribers');

    const spTok = await spotifyToken(
      { clientIdEnv: 'SP_ID', clientSecretEnv: 'SP_SECRET' },
      {
        env: { SP_ID: 'client123', SP_SECRET: 'secret456' },
        fetcher: async (url, opts) => {
          assert.equal(url.href, 'https://accounts.spotify.com/api/token');
          assert.equal(opts.method, 'POST');
          assert.match(opts.headers.Authorization, /^Basic /);
          return response({ access_token: 'spotify-bearer-token' });
        }
      }
    );
    assert.equal(spTok, 'spotify-bearer-token');

    const spBatch = await spotifyMetrics(
      db,
      { accountId: 'sp-claudio', tokenEnv: 'SP_TOKEN', authorizationRef: 'spotify-app-1' },
      {
        day,
        now: new Date(day + 'T06:10:00.000Z'),
        env: { SP_TOKEN: 'spotify-bearer-token' },
        fetcher: async (url, opts) => {
          assert.equal(url.pathname, '/v1/artists/4ClaudioSpotifyId12345');
          assert.equal(opts.headers.Authorization, 'Bearer spotify-bearer-token');
          return response({
            id: '4ClaudioSpotifyId12345',
            name: 'Pastor Cláudio Duarte',
            followers: { total: 89420 }
          });
        }
      }
    );
    assert.equal(spBatch.rows[0].value, 89420);
    assert.equal(spBatch.rows[0].metric, 'followers');
  } finally {
    db.close();
  }
});

test('registry.mjs: múltiplas coletas no mesmo dia (intraday), bloqueio de variação suspeita (4.012 -> 400.000 ou 40) e rastreabilidade de falha', async () => {
  const db = openDatabase(':memory:');
  try {
    seedAccounts(db);

    const jobIg = {
      id: 'ig-sync',
      kind: 'metrics',
      provider: 'Instagram',
      adapter: 'instagram',
      accountId: 'ig-claudio',
      businessAccountId: '17841400000000000',
      tokenEnv: 'IG_TOKEN',
      authorizationRef: 'meta-oficial',
      intraday: true,
      minIntervalMinutes: 30,
      enabled: true
    };
    const cfg = { allowedHosts: [], jobs: [jobIg] };

    // 1ª coleta do dia às 06:00 -> 4.012 seguidores
    const t1 = new Date(day + 'T09:00:00.000Z');
    const r1 = await runOperations(db, cfg, {
      now: t1,
      ignoreSchedule: true,
      env: { IG_TOKEN: 'tok' },
      fetcher: async () => response({ business_discovery: { username: 'claudioduarte', followers_count: 4012 } })
    });
    assert.equal(r1[0].state, 'success');
    assert.equal(db.prepare('SELECT value, collected_at FROM metric_snapshots WHERE account_id=?').get('ig-claudio').value, 4012);

    // 2ª coleta no mesmo dia às 12:00 -> atualiza para 4.180 seguidores e preserva novo collected_at
    const t2 = new Date(day + 'T12:00:00.000Z');
    const r2 = await runOperations(db, cfg, {
      now: t2,
      ignoreSchedule: true,
      env: { IG_TOKEN: 'tok' },
      fetcher: async () => response({ business_discovery: { username: 'claudioduarte', followers_count: 4180 } })
    });
    assert.equal(r2[0].state, 'success');
    const snap2 = db.prepare('SELECT value, collected_at FROM metric_snapshots WHERE account_id=?').get('ig-claudio');
    assert.equal(snap2.value, 4180);
    assert.equal(snap2.collected_at, t2.toISOString());

    const commOk = commercialQuery(db, new URLSearchParams({ network: 'Instagram', end: day }));
    assert.equal(commOk.items[0].value, 4180);
    assert.equal(commOk.items[0].collection_state, 'collected');
    assert.match(commOk.items[0].freshness_label, /Instagram Graph API \/ meta-oficial · atualizado em /);

    // 3ª coleta no mesmo dia às 15:00 com salto suspeito (400.000 seguidores) -> bloqueada para revisão!
    const t3 = new Date(day + 'T15:00:00.000Z');
    const r3 = await runOperations(db, cfg, {
      now: t3,
      ignoreSchedule: true,
      env: { IG_TOKEN: 'tok' },
      fetcher: async () => response({ business_discovery: { username: 'claudioduarte', followers_count: 400000 } })
    });
    assert.equal(r3[0].state, 'failed');
    // Valor anterior (4.180) permanece intacto, mas estado da conta sinaliza falha desde hoje
    assert.equal(db.prepare('SELECT value FROM metric_snapshots WHERE account_id=?').get('ig-claudio').value, 4180);

    const commErr = commercialQuery(db, new URLSearchParams({ network: 'Instagram', end: day }));
    assert.equal(commErr.items[0].collection_state, 'error');
    assert.match(commErr.items[0].freshness_label, /Indisponível desde /);

    // Queda suspeita para 40 também é bloqueada diretamente em importNationalMetrics
    assert.throws(
      () => importNationalMetrics(db, [{
        account_id: 'ig-claudio',
        network: 'Instagram',
        metric: 'followers',
        observed_on: day,
        value: 40,
        source: 'Instagram Graph API / meta-oficial',
        collected_at: new Date(day + 'T18:00:00.000Z').toISOString(),
        intraday: true
      }], { accountId: 'ig-claudio', network: 'Instagram', day, allowIntradayUpdate: true }),
      /Variação suspeita/
    );
  } finally {
    db.close();
  }
});
