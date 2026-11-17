import { createRadarServer } from './app.mjs';
import { openDatabase } from './database/index.mjs';
import { seedPilotDatabaseIfEmpty } from './seed-pilot.mjs';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const database = openDatabase();
seedPilotDatabaseIfEmpty(database);
const server = createRadarServer({ database });
server.once('close', () => database.close());
server.listen(port, host, () => {
  console.log('Radar Node.js em http://' + host + ':' + port);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close());
}
