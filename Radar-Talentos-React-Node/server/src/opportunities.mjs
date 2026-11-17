import {radarQuery,FilterError,distanceKm} from './radar.mjs';
import {eventQuery} from './events.mjs';

const fail=m=>{throw new FilterError(m)};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;

export function importCoverage(db,items){
 if(!Array.isArray(items)||!items.length)fail('Informe declarações de cobertura');
 const insert=db.prepare('INSERT INTO event_coverage VALUES(?,?,?,?,?,?) ON CONFLICT DO UPDATE SET evidence=excluded.evidence');
 db.exec('BEGIN IMMEDIATE');try{for(const r of items){if(!validDate(r.start)||!validDate(r.end)||r.start>r.end||!['first_seen','published_on','event_date'].includes(r.basis)||typeof r.evidence!=='string'||!r.evidence.trim())fail('Declaração inválida');if(!db.prepare('SELECT 1 FROM event_imports WHERE platform_id=?').get(r.platform))fail('Plataforma sem importação registrada');insert.run(r.platform,r.city,r.start,r.end,r.basis,r.evidence.trim())}db.exec('COMMIT');return items.length}catch(e){db.exec('ROLLBACK');throw e}
}

export function opportunityQuery(db,p){
 const get=k=>p.get(k)||'';const modality=get('modality'), sub=get('submodality'), platform=get('platform'), basis=get('basis')||'first_seen';
 if(!modality)fail('Selecione uma modalidade para comparação coerente');
 if(get('talent'))fail('Use o ranking de talentos retornado na consulta');
 if(!get('start')||!get('end'))fail('Selecione um relatório exato de audiência');
 const ep=new URLSearchParams(p);ep.set('start',get('eventStart'));ep.set('end',get('eventEnd'));ep.set('basis',basis);
 const rp=new URLSearchParams(p);rp.set('mode','regional');rp.set('order','audience');rp.set('limit','200');rp.delete('offset');
 const audience=radarQuery(db,'/api/radar/ranking',rp), events=eventQuery(db,'/api/events/trends',ep);
 const platforms=db.prepare('SELECT id FROM ticket_platforms WHERE (?=\'\' OR id=?)').all(platform,platform).map(r=>r.id);
 const coverage=db.prepare('SELECT * FROM event_coverage WHERE period_start=? AND period_end=? AND basis=?').all(get('eventStart'),get('eventEnd'),basis);
 const covered=new Map();for(const row of coverage)if(platforms.includes(row.platform_id)){if(!covered.has(row.municipality_code))covered.set(row.municipality_code,new Set());covered.get(row.municipality_code).add(row.platform_id)}
 const places=new Map(events.places.map(r=>[r.code,{...r,events:r.value,audience:null}]));
 for(const a of audience.places){const old=places.get(a.code);places.set(a.code,{...a,events:old?.events??0,audience:a.value})}
 const rows=[...places.values()].map(r=>{const sources=covered.get(r.code)?.size??0;const complete=sources===platforms.length;return {...r,events:complete||r.events>0?r.events:null,coverage:sources,expected:platforms.length,complete,score:null,signal:'Dados insuficientes'}});
 const comparable=rows.filter(r=>r.complete&&r.audience!==null);const maxAudience=Math.max(0,...comparable.map(r=>r.audience)),maxEvents=Math.max(0,...comparable.map(r=>r.events));
 for(const r of comparable){if(maxAudience===0||(!maxEvents&&comparable.length<2))continue;const a=r.audience/maxAudience,o=maxEvents?r.events/maxEvents:0;r.score=Math.round(100*a*(1-o*.5));r.signal=a>=.5?(o<.5?'Audiência alta / oferta baixa':'Audiência alta / oferta alta'):(o<.5?'Audiência baixa / oferta baixa':'Audiência baixa / oferta alta')}
 rows.sort((a,b)=>(b.score??-1)-(a.score??-1)||(b.audience??-1)-(a.audience??-1)||a.code.localeCompare(b.code));let rank=0;for(const r of rows)r.rank=r.score===null?null:++rank;
 const scored=new Map(rows.filter(r=>r.score!==null).map(r=>[r.code,r.score]));
 const talentRows=db.prepare(`SELECT a.talent_id,t.name,a.municipality_code,a.value FROM regional_audience a JOIN talents t ON t.id=a.talent_id WHERE t.blocked=0 AND a.network=? AND a.metric=? AND a.period_start=? AND a.period_end=? AND a.source=? AND a.quality=? AND EXISTS(SELECT 1 FROM talent_modalities m WHERE m.talent_id=t.id AND m.modality_id=?) AND (?='' OR EXISTS(SELECT 1 FROM talent_submodalities s WHERE s.talent_id=t.id AND s.submodality_id=?))`).all(audience.network,audience.metric,get('start'),get('end'),get('source'),get('quality'),modality,sub,sub);
 const scoped=new Set(audience.places.map(r=>r.code)),talents=new Map();for(const r of talentRows){if(!scoped.has(r.municipality_code))continue;const t=talents.get(r.talent_id)||{id:r.talent_id,name:r.name,audience:0,coveredAudience:0,weighted:0};t.audience+=r.value;if(scored.has(r.municipality_code)){t.coveredAudience+=r.value;t.weighted+=r.value*scored.get(r.municipality_code)}talents.set(t.id,t)}
 const artists=[...talents.values()].map(({weighted,...t})=>({...t,coverage_pct:t.audience?100*t.coveredAudience/t.audience:null,score:t.coveredAudience?Math.round(weighted/t.coveredAudience):null})).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.audience-a.audience||a.id.localeCompare(b.id));
 const mapPlaces=rows.filter(r=>r.score!==null).map(r=>({...r,value:r.score}));
 // Scores are not additive: state view uses maximum city score, not a sum.
 const agg=field=>{const m=new Map();for(const r of mapPlaces)m.set(r[field],Math.max(m.get(r[field])??0,r.score));return [...m].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value)};
 return {modality,network:audience.network,metric:audience.metric,rows,artists,scored:rank,platforms,places:mapPlaces,byState:agg('uf'),byRegion:agg('region'),origin:audience.origin,radius:audience.radius,notice:'Índice relativo ao recorte: 100 × audiência/máximo × (1 − 0,5 × oferta/máximo). Cobertura declarada apenas das fontes selecionadas; não representa demanda, vendas ou previsão. Artistas: média ponderada pela audiência nas cidades pontuadas; verificar cobertura. Estados: maior índice municipal.'};
}

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

  // 3. Build City Commercial Praças
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

  // 5. Índice de oportunidades por artista
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
