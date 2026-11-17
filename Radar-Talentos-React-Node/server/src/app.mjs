import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import {
  queryTaxonomy,
  queryHistoryRows,
  queryResearchSummary,
  queryEvolution,
} from './database/research.mjs';
import {
  queryGeoRegions,
  queryGeoStates,
  queryGeoMunicipalities,
  queryModalities,
  queryAudienceMapAndDistribution,
  importRegionalAudience,
  importEventsBatch,
  queryEventTrendsAndRankings,
  queryOpportunities,
  querySourcesStatus,
} from './database/geo-intelligence.mjs';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(payload));
}

function checkDatabaseReady(database, req, res) {
  if (!database) return true;
  try {
    database.prepare('SELECT 1').get();
    return true;
  } catch {
    sendJson(req, res, 503, { ok: false, error: 'Banco de dados indisponível' });
    return false;
  }
}

function isAuthorizedAdmin(req, adminToken) {
  const expected = adminToken || process.env.RADAR_ADMIN_TOKEN || 'radar-local-admin';
  const authHeader = req.headers.authorization || '';
  return authHeader === `Bearer ${expected}`;
}

async function readJsonBody(req, maxBytes = 2000000) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('Corpo da requisição excede o limite permitido (2 MB).');
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const POST_ADMIN_ROUTES = new Set([
  '/api/admin/audience/import',
  '/api/admin/events/import',
]);

export function createRadarServer({ database, adminToken } = {}) {
  return createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(requestUrl.pathname);

      if (POST_ADMIN_ROUTES.has(path)) {
        if (req.method !== 'POST') {
          res.writeHead(405, { Allow: 'POST' }).end();
          return;
        }
        if (!isAuthorizedAdmin(req, adminToken)) {
          sendJson(req, res, 401, {
            error: 'Acesso não autorizado. Informe o token administrativo válido.',
          });
          return;
        }
        if (!checkDatabaseReady(database, req, res)) return;
        try {
          const body = await readJsonBody(req);
          if (path === '/api/admin/audience/import') {
            sendJson(res ? req : req, res, 200, importRegionalAudience(database, body));
            return;
          }
          if (path === '/api/admin/events/import') {
            sendJson(req, res, 200, importEventsBatch(database, body));
            return;
          }
        } catch (err) {
          sendJson(req, res, 400, { error: err.message || 'Dados inválidos.' });
          return;
        }
      }

      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }

      if (path === '/api/health') {
        if (database) {
          try {
            database.prepare('SELECT 1').get();
          } catch {
            res.writeHead(503, {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            });
            res.end(
              req.method === 'HEAD' ? undefined : JSON.stringify({ ok: false })
            );
            return;
          }
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(
          req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true })
        );
        return;
      }

      if (path === '/api/taxonomy') {
        if (!checkDatabaseReady(database, req, res)) return;
        sendJson(req, res, 200, queryTaxonomy(database));
        return;
      }

      if (path === '/api/modalities') {
        if (!checkDatabaseReady(database, req, res)) return;
        sendJson(req, res, 200, queryModalities(database));
        return;
      }

      if (path === '/api/geo/regions') {
        if (!checkDatabaseReady(database, req, res)) return;
        sendJson(req, res, 200, queryGeoRegions(database));
        return;
      }

      if (path === '/api/geo/states') {
        if (!checkDatabaseReady(database, req, res)) return;
        const region = requestUrl.searchParams.get('region') || '';
        sendJson(req, res, 200, queryGeoStates(database, { region }));
        return;
      }

      if (path === '/api/geo/municipalities' || path === '/api/geo/radius') {
        if (!checkDatabaseReady(database, req, res)) return;
        try {
          const search = requestUrl.searchParams.get('search') || '';
          const uf = requestUrl.searchParams.get('uf') || '';
          const region = requestUrl.searchParams.get('region') || '';
          const centerMunicipalityId =
            requestUrl.searchParams.get('municipalityId') ||
            requestUrl.searchParams.get('centerMunicipalityId') ||
            '';
          const radiusKm = requestUrl.searchParams.get('radiusKm');
          sendJson(
            req,
            res,
            200,
            queryGeoMunicipalities(database, {
              search,
              uf,
              region,
              centerMunicipalityId,
              radiusKm,
            })
          );
        } catch (err) {
          sendJson(req, res, 400, { error: err.message });
        }
        return;
      }

      if (path === '/api/audience/map' || path === '/api/audience/distribution') {
        if (!checkDatabaseReady(database, req, res)) return;
        try {
          const params = requestUrl.searchParams;
          sendJson(
            req,
            res,
            200,
            queryAudienceMapAndDistribution(database, {
              talentId: params.get('talentId') || '',
              talentName: params.get('talentName') || '',
              platform: params.get('platform') || 'all',
              metric: params.get('metric') || '',
              region: params.get('region') || '',
              uf: params.get('uf') || '',
              centerMunicipalityId:
                params.get('centerMunicipalityId') ||
                params.get('municipalityId') ||
                '',
              radiusKm: params.get('radiusKm'),
              provenance: params.get('provenance') || 'all',
              perCapita: params.get('perCapita') === 'true',
            })
          );
        } catch (err) {
          sendJson(req, res, 400, { error: err.message });
        }
        return;
      }

      if (
        path === '/api/events' ||
        path === '/api/events/trends' ||
        path === '/api/events/rankings' ||
        path === '/api/events/map' ||
        path === '/api/events/calendar'
      ) {
        if (!checkDatabaseReady(database, req, res)) return;
        try {
          const params = requestUrl.searchParams;
          sendJson(
            req,
            res,
            200,
            queryEventTrendsAndRankings(database, {
              modalityId: params.get('modalityId') || 'all',
              submodalityId: params.get('submodalityId') || 'all',
              region: params.get('region') || '',
              uf: params.get('uf') || '',
              centerMunicipalityId:
                params.get('centerMunicipalityId') ||
                params.get('municipalityId') ||
                '',
              radiusKm: params.get('radiusKm'),
              sourceId: params.get('sourceId') || 'all',
              dateFrom: params.get('dateFrom') || '',
              dateTo: params.get('dateTo') || '',
              dateBasis: params.get('dateBasis') || 'realization',
              includeFree: params.get('includeFree') === 'true',
            })
          );
        } catch (err) {
          sendJson(req, res, 400, { error: err.message });
        }
        return;
      }

      if (path === '/api/opportunities') {
        if (!checkDatabaseReady(database, req, res)) return;
        try {
          const params = requestUrl.searchParams;
          sendJson(
            req,
            res,
            200,
            queryOpportunities(database, {
              talentId: params.get('talentId') || '',
              talentName: params.get('talentName') || '',
              platform: params.get('platform') || 'Instagram',
              metric: params.get('metric') || 'seguidores',
              modalityId: params.get('modalityId') || 'all',
              region: params.get('region') || '',
              uf: params.get('uf') || '',
              centerMunicipalityId:
                params.get('centerMunicipalityId') ||
                params.get('municipalityId') ||
                '',
              radiusKm: params.get('radiusKm'),
            })
          );
        } catch (err) {
          sendJson(req, res, 400, { error: err.message });
        }
        return;
      }

      if (path === '/api/sources/status') {
        if (!checkDatabaseReady(database, req, res)) return;
        sendJson(req, res, 200, querySourcesStatus(database));
        return;
      }

      if (path === '/api/history') {
        if (!checkDatabaseReady(database, req, res)) return;
        sendJson(req, res, 200, queryHistoryRows(database));
        return;
      }
      if (path === '/api/research') {
        if (!checkDatabaseReady(database, req, res)) return;
        const start = requestUrl.searchParams.get('start') || '';
        const end = requestUrl.searchParams.get('end') || '';
        sendJson(req, res, 200, queryResearchSummary(database, { start, end }));
        return;
      }
      if (path === '/api/evolution') {
        if (!checkDatabaseReady(database, req, res)) return;
        const personId = requestUrl.searchParams.get('personId') || '';
        const name = requestUrl.searchParams.get('name') || '';
        sendJson(req, res, 200, queryEvolution(database, { personId, name }));
        return;
      }
      if (path === '/api/spotify/history') {
        if (!checkDatabaseReady(database, req, res)) return;
        const history = queryHistoryRows(database);
        const spotifyRows = history.rows
          .filter(r => r.rede === 'Spotify' && Number.isFinite(r.seguidores))
          .map(r => ({
            name: r.nome,
            artistId: r.artistId || '',
            url: r.url,
            date: r.data,
            monthlyListeners: r.seguidores,
            comparisonPersonId: r.personId,
            identityStatus: r.identityConfirmed ? 'confirmed' : 'name-match',
          }));
        sendJson(req, res, 200, { rows: spotifyRows });
        return;
      }
      if (path === '/api' || path.startsWith('/api/')) {
        res
          .writeHead(404, { 'Content-Type': 'application/json' })
          .end(
            req.method === 'HEAD' ? undefined : '{"error":"Rota não encontrada"}'
          );
        return;
      }
      if (path.includes('\\') || path.includes('\0')) {
        res.writeHead(400).end();
        return;
      }
      const file = resolve(dist, path === '/' ? 'index.html' : '.' + path);
      if (!file.startsWith(dist + sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const code =
        error instanceof URIError
          ? 400
          : ['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)
            ? 404
            : 500;
      res.writeHead(code).end();
    }
  });
}
