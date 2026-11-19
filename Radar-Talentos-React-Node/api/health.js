import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase, databasePath } from '../server/src/database/index.mjs';
import { seedPilotDatabaseIfEmpty } from '../server/src/seed-pilot.mjs';
import { createRadarServer } from '../server/src/app.mjs';
import { readDashboardConfig } from '../server/src/event-config.mjs';
import { productionSecurity } from '../server/src/security.mjs';

let sharedServerPromise = null;

function getServerlessServer() {
  if (!sharedServerPromise) {
    sharedServerPromise = Promise.resolve().then(() => {
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
      if (isServerless && !process.env.DISCOVERY_DB) {
        process.env.DISCOVERY_DB = join(tmpdir(), 'radar-discovery-v18.sqlite');
      }
      const defaultPath = databasePath();
      const targetPath = !isServerless && existsSync(defaultPath)
        ? defaultPath
        : join(tmpdir(), 'radar-vercel-v18.sqlite');
      const db = openDatabase(targetPath);
      seedPilotDatabaseIfEmpty(db);
      const security = (process.env.RADAR_USER || process.env.RADAR_PASSWORD)
        ? productionSecurity(process.env)
        : null;
      return createRadarServer({
        database: db,
        security,
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
