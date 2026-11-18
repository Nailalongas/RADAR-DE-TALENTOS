import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase, databasePath } from '../server/src/database/index.mjs';
import { seedPilotDatabaseIfEmpty } from '../server/src/seed-pilot.mjs';
import { createRadarServer } from '../server/src/app.mjs';
import { readDashboardConfig } from '../server/src/event-config.mjs';

let sharedServerPromise = null;

function getServerlessServer() {
  if (!sharedServerPromise) {
    sharedServerPromise = Promise.resolve().then(() => {
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
      const defaultPath = databasePath();
      const targetPath = !isServerless && existsSync(defaultPath)
        ? defaultPath
        : join(tmpdir(), 'radar-vercel-v15.sqlite');
      const db = openDatabase(targetPath);
      seedPilotDatabaseIfEmpty(db);
      return createRadarServer({
        database: db,
        eventsOnly: true,
        combinedDashboard: true,
        syncConfig: readDashboardConfig,
      });
    });
  }
  return sharedServerPromise;
}

export default async function handler(req, res) {
  try {
    const server = await getServerlessServer();
    server.emit('request', req, res);
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
