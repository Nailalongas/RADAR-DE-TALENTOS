import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

export function createRadarServer({ database } = {}) {
  return createServer(async (req, res) => {
    if (!['GET','HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path === '/api/health') {
        if (database) {
          try { database.prepare('SELECT 1').get(); } catch {
            res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: false }));
            return;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true }));
        return;
      }
      if (path === '/api' || path.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' }).end(req.method === 'HEAD' ? undefined : '{"error":"Rota não encontrada"}');
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
      res.writeHead(200, { 'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const code = error instanceof URIError ? 400 : ['ENOENT','EISDIR','ENOTDIR'].includes(error.code) ? 404 : 500;
      res.writeHead(code).end();
    }
  });
}
