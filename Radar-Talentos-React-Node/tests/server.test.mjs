import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadarServer } from '../server/src/app.mjs';

test('servidor responde status, HEAD e rotas inválidas', async () => {
  const server = createRadarServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const head = await fetch(base + '/api/health', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(base + '/api/inexistente')).status, 404);
    assert.equal((await fetch(base + '/api/health', { method: 'POST' })).status, 405);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
