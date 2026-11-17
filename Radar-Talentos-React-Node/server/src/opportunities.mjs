import { FilterError, distanceKm } from './radar.mjs';

const fail = msg => {
  throw new FilterError(msg);
};

export function opportunitiesQuery(db, p) {
  const get = k => p.get(k) || '';
  const network = get('network') || 'YouTube';
  const metric =
    get('metric') ||
    { YouTube: 'views', Instagram: 'followers', Spotify: 'listeners' }[
      network
    ] ||
    'views';
  const modality = get('modality') || '';
  const region = get('region') || '';
  const uf = get('uf') || '';
  const center = get('center') || '';
  const radius = get('radius') || '';
  const talent = get('talent') || '';

  if (
    !db
      .prepare('SELECT 1 FROM regional_metrics WHERE network=? AND metric=?')
      .get(network, metric)
  ) {
    fail('Rede ou métrica regional inválida');
  }
  if (
    region &&
    !['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'].includes(region)
  ) {
    fail('Região inválida');
  }
  if (
    uf &&
    !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(
      uf
    )
  ) {
    fail('UF inválida');
  }
  if (
    modality &&
    !db.prepare('SELECT 1 FROM modalities WHERE id=?').get(modality)
  ) {
    fail('Modalidade inválida');
  }

  const lookup = code =>
    db.prepare('SELECT * FROM municipalities WHERE code=?').get(code);
  const origin = center ? lookup(center) : null;
  if (
    (center || radius !== '') &&
    (!origin ||
      origin.lat == null ||
      radius === '' ||
      !Number.isFinite(+radius) ||
      +radius < 0 ||
      +radius > 10000)
  ) {
    fail('Raio inválido');
  }

  // 1. Aggregate latest known regional audience per (talent, municipality)
  const rawAudience = db
    .prepare(
      `SELECT a.talent_id, t.name AS talent_name, a.municipality_code, a.value, a.quality, a.source, a.period_end,
              m.name AS city_name, m.uf, m.region, m.lat, m.lon
       FROM regional_audience a
       JOIN talents t ON t.id = a.talent_id
       JOIN municipalities m ON m.code = a.municipality_code
       WHERE t.blocked = 0 AND a.network = ? AND a.metric = ?
         AND (? = '' OR a.talent_id = ?)
         AND (? = '' OR EXISTS(SELECT 1 FROM talent_modalities tm WHERE tm.talent_id = t.id AND tm.modality_id = ?))
       ORDER BY a.period_end DESC`
    )
    .all(network, metric, talent, talent, modality, modality);

  const latestTalentCity = new Map();
  for (const r of rawAudience) {
    if (region && r.region !== region) continue;
    if (uf && r.uf !== uf) continue;
    if (origin) {
      if (r.lat == null) continue;
      if (distanceKm(origin, r) > +radius) continue;
    }
    const key = `${r.talent_id}|${r.municipality_code}`;
    if (!latestTalentCity.has(key)) {
      latestTalentCity.set(key, r);
    }
  }

  // 2. Count observed events per municipality and modality
  const rawEvents = db
    .prepare(
      `SELECT e.id, e.title, e.municipality_code, e.modality_id, e.event_date,
              mo.name AS modality_name, m.name AS city_name, m.uf, m.region, m.lat, m.lon
       FROM events e
       JOIN municipalities m ON m.code = e.municipality_code
       JOIN modalities mo ON mo.id = e.modality_id
       WHERE (? = '' OR e.modality_id = ?)`
    )
    .all(modality, modality)
    .filter(r => {
      if (region && r.region !== region) return false;
      if (uf && r.uf !== uf) return false;
      if (origin) {
        if (r.lat == null) return false;
        if (distanceKm(origin, r) > +radius) return false;
      }
      return true;
    });

  const eventsByCity = new Map();
  const eventsByModality = new Map();
  for (const ev of rawEvents) {
    eventsByCity.set(
      ev.municipality_code,
      (eventsByCity.get(ev.municipality_code) || 0) + 1
    );
    eventsByModality.set(
      ev.modality_id,
      (eventsByModality.get(ev.modality_id) || 0) + 1
    );
  }

  // 3. Build City Commercial Praças (cidades mais promissoras & muita audiencia / pouca oferta)
  const cityMap = new Map();
  for (const r of latestTalentCity.values()) {
    const entry = cityMap.get(r.municipality_code) || {
      code: r.municipality_code,
      name: r.city_name,
      uf: r.uf,
      region: r.region,
      lat: r.lat,
      lon: r.lon,
      distance_km: origin ? Number(distanceKm(origin, r).toFixed(1)) : null,
      audience: 0,
      talents_count: 0,
      events_count: eventsByCity.get(r.municipality_code) || 0,
    };
    entry.audience += r.value;
    entry.talents_count += 1;
    cityMap.set(r.municipality_code, entry);
  }

  const citiesList = [...cityMap.values()];
  const maxAud = Math.max(1, ...citiesList.map(c => c.audience));
  const maxEv = Math.max(1, ...citiesList.map(c => c.events_count));

  const sortedAud = [...citiesList]
    .map(c => c.audience)
    .sort((a, b) => a - b);
  const medianAud =
    sortedAud.length > 0 ? sortedAud[Math.floor(sortedAud.length / 2)] : 0;

  const promisingCities = citiesList
    .map(c => {
      const normAud = (c.audience / maxAud) * 100;
      const supplyPenalty = (c.events_count / (maxEv + 1)) * 35;
      const opportunityScore = Math.round(
        Math.min(100, Math.max(10, normAud * 0.75 + (35 - supplyPenalty)))
      );
      let classification = 'Praça em desenvolvimento';
      if (c.audience >= medianAud && c.events_count <= 1) {
        classification = 'Alta oportunidade (muita audiência · baixa oferta)';
      } else if (c.audience >= medianAud && c.events_count > 1) {
        classification = 'Praça consolidada (alta audiência · oferta ativa)';
      } else if (c.audience < medianAud && c.events_count > 1) {
        classification = 'Praça saturada (oferta acima da audiência relativa)';
      }
      return {
        ...c,
        value: opportunityScore,
        opportunity_score: opportunityScore,
        demand_per_event:
          c.events_count > 0
            ? Math.round(c.audience / c.events_count)
            : c.audience,
        classification,
      };
    })
    .sort(
      (a, b) =>
        b.opportunity_score - a.opportunity_score || b.audience - a.audience
    );

  // 4. Ranking de modalidades por potencial regional
  const allModalities = db
    .prepare('SELECT id, name FROM modalities ORDER BY name')
    .all();
  const talentMods = db
    .prepare('SELECT talent_id, modality_id FROM talent_modalities')
    .all();
  const modsByTalent = new Map();
  for (const tm of talentMods) {
    if (!modsByTalent.has(tm.talent_id)) modsByTalent.set(tm.talent_id, []);
    modsByTalent.get(tm.talent_id).push(tm.modality_id);
  }

  const audByModality = new Map();
  for (const r of latestTalentCity.values()) {
    for (const mId of modsByTalent.get(r.talent_id) || []) {
      audByModality.set(mId, (audByModality.get(mId) || 0) + r.value);
    }
  }

  const modalityPotential = allModalities
    .map(m => {
      const aud = audByModality.get(m.id) || 0;
      const evs = eventsByModality.get(m.id) || 0;
      return {
        id: m.id,
        name: m.name,
        audience: aud,
        events: evs,
        value: aud > 0 ? Math.round(aud / (evs + 1)) : evs * 100,
      };
    })
    .filter(m => m.audience > 0 || m.events > 0)
    .sort((a, b) => b.value - a.value || b.audience - a.audience);

  // 5. Índice de oportunidades por artista (em qual praça cada talento tem mais demanda sem evento)
  const artistOpportunities = [];
  for (const r of latestTalentCity.values()) {
    const cityEvents = eventsByCity.get(r.municipality_code) || 0;
    const score = Math.round(
      Math.min(
        100,
        (r.value / maxAud) * 75 + (cityEvents === 0 ? 25 : cityEvents === 1 ? 15 : 5)
      )
    );
    artistOpportunities.push({
      talent_id: r.talent_id,
      talent_name: r.talent_name,
      municipality_code: r.municipality_code,
      city_name: r.city_name,
      uf: r.uf,
      region: r.region,
      audience: r.value,
      events_in_city: cityEvents,
      opportunity_index: score,
      recommendation:
        cityEvents === 0
          ? 'Prioridade máxima — praça com audiência verificada e zero eventos na seleção'
          : cityEvents === 1
            ? 'Expansão recomendada — baixa concorrência observada'
            : 'Praça competitiva — avaliar janela de calendário',
    });
  }
  artistOpportunities.sort(
    (a, b) =>
      b.opportunity_index - a.opportunity_index || b.audience - a.audience
  );

  // 6. Agregação por estado e região para o GeoMap
  const byStateMap = new Map();
  const byRegionMap = new Map();
  for (const c of promisingCities) {
    byStateMap.set(c.uf, (byStateMap.get(c.uf) || 0) + c.audience);
    byRegionMap.set(c.region, (byRegionMap.get(c.region) || 0) + c.audience);
  }
  const byState = [...byStateMap]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const byRegion = [...byRegionMap]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    network,
    metric,
    origin,
    radius: origin ? +radius : null,
    promisingCities,
    highDemandLowSupply: promisingCities.filter(c =>
      c.classification.startsWith('Alta oportunidade')
    ),
    modalityPotential,
    artistOpportunities: artistOpportunities.slice(0, 40),
    places: promisingCities.map(c => ({
      ...c,
      value: c.audience,
    })),
    byState,
    byRegion,
    notice:
      'Inteligência comercial calculada sobre audiência regional conhecida e oferta observada de eventos. Índices orientativos para prospecção de praças e turnês; não representam previsão de bilheteria.',
  };
}
