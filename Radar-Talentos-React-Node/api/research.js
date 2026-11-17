export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return response.status(405).end();
  }
  if (request.method === 'HEAD') return response.status(200).end();

  try {
    const { openDatabase } = await import('../server/src/database/index.mjs');
    const { queryResearchSummary } = await import(
      '../server/src/database/research.mjs'
    );
    const db = openDatabase(process.env.RADAR_DATABASE_PATH || ':memory:');
    try {
      const url = new URL(request.url, 'http://localhost');
      const start = url.searchParams.get('start') || '';
      const end = url.searchParams.get('end') || '';
      return response
        .status(200)
        .json(queryResearchSummary(db, { start, end }));
    } finally {
      db.close();
    }
  } catch {
    return response.status(200).json({
      rows: [],
      historyStart: '',
      summaryOnly: true,
    });
  }
}
