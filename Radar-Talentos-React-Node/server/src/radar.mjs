export class FilterError extends Error {}
const fail = message => { throw new FilterError(message); };
const regions = ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
export function distanceKm(a,b) {
  const rad=Math.PI/180, dlat=(b.lat-a.lat)*rad, dlon=(b.lon-a.lon)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
const shiftDay = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

const MODALITY_TO_CATEGORY = {
  shows: 'Cantores',
  humor: 'Humoristas',
  palestras: 'Palestrantes',
  teatro: 'Peças de teatro e musicais',
  infantil: 'Infantil e família',
  gastronomia: 'Gastronomia',
  feiras: 'Influenciadores',
  experiencias: 'Artistas',
};

const CATEGORY_ORDER = [
  'Cantores',
  'Humoristas',
  'Palestrantes',
  'Influenciadores',
  'Peças de teatro e musicais',
  'Infantil e família',
  'Artistas',
  'Gastronomia',
];

const CATEGORY_SHORT_LABEL = {
  'Peças de teatro e musicais': 'Teatro e musicais',
};

function radarOverview(db, p) {
  const get = k => (p.get(k) || '').trim();
  const network = get('network') || 'Instagram';
  if (!['Instagram', 'YouTube', 'Spotify', 'TikTok'].includes(network)) fail('Mídia inválida');
  const days = Number(get('days') || 30);
  if (![7, 30, 90].includes(days)) fail('Período inválido');
  const region = get('region');
  if (region && !regions.includes(region)) fail('Região inválida');
  const uf = get('uf');
  if (uf && !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf)) fail('UF inválida');
  const categoryParam = get('category');
  const artistQuery = get('artist').toLowerCase();

  const rawCities = [get('cities'), get('city')].filter(Boolean).join(',');
  const explicitCityCodes = [...new Set(rawCities.split(',').map(s => s.trim()).filter(Boolean))];
  const lookup = code => db.prepare('SELECT * FROM municipalities WHERE code=?').get(code);
  for (const c of explicitCityCodes) {
    if (!lookup(c)) fail('Município desconhecido: ' + c);
  }
  const citySet = explicitCityCodes.length ? new Set(explicitCityCodes) : null;

  const center = get('center');
  const radius = get('radius');
  let origin = null;
  if (center || radius !== '') {
    if (!center || radius === '' || !Number.isFinite(Number(radius)) || Number(radius) < 0 || Number(radius) > 10000) fail('Raio inválido');
    origin = lookup(center);
    if (!origin || origin.lat === null) fail('Centro sem coordenadas');
  }

  // 1. Load categories directly from database
  const dbCategories = db.prepare('SELECT id, name FROM categories').all();
  dbCategories.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.name);
    const ib = CATEGORY_ORDER.indexOf(b.name);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
  });
  const catById = new Map(dbCategories.map(c => [String(c.id), c]));
  const catByName = new Map(dbCategories.map(c => [c.name.toLowerCase(), c]));

  let selectedCatObj = null;
  if (categoryParam) {
    selectedCatObj = catById.get(categoryParam) || catByName.get(categoryParam.toLowerCase()) || null;
    if (!selectedCatObj) fail('Categoria inválida');
  }

  // 2. Map every unblocked talent to its categories
  const allTalents = db.prepare('SELECT id, name, entity_type FROM talents WHERE blocked = 0 ORDER BY name').all();
  const tcRows = db.prepare('SELECT talent_id, category_id FROM talent_categories').all();
  const tmRows = db.prepare('SELECT talent_id, modality_id FROM talent_modalities').all();
  const talentCats = new Map();
  for (const t of allTalents) talentCats.set(t.id, new Set());
  for (const r of tcRows) {
    if (talentCats.has(r.talent_id)) talentCats.get(r.talent_id).add(String(r.category_id));
  }
  for (const r of tmRows) {
    if (!talentCats.has(r.talent_id)) continue;
    const mappedName = MODALITY_TO_CATEGORY[r.modality_id];
    const cat = mappedName ? catByName.get(mappedName.toLowerCase()) : null;
    if (cat) talentCats.get(r.talent_id).add(String(cat.id));
  }

  // 3. Load latest regional audience report per network
  const regPrimaryMetric = { Instagram: 'views', YouTube: 'views', Spotify: 'streams', TikTok: 'views' };
  const latestReports = new Map();
  for (const net of ['Instagram', 'YouTube', 'Spotify', 'TikTok']) {
    const rep = db.prepare(
      `SELECT network, metric, period_start, period_end, source, quality
       FROM regional_audience
       WHERE network = ? AND metric = ?
       GROUP BY network, metric, period_start, period_end, source, quality
       ORDER BY period_end DESC, period_start ASC LIMIT 1`
    ).get(net, regPrimaryMetric[net]);
    if (rep) latestReports.set(net, rep);
  }

  // Filter regional_audience across all 4 networks for the active territory (ignoring category filter first so we can count active talents per category in the territory)
  const activeRep = latestReports.get(network);
  const territoryRowsByNet = new Map();
  for (const [net, rep] of latestReports.entries()) {
    const rows = db.prepare(
      `SELECT a.talent_id, a.municipality_code, a.value, m.name city_name, m.uf, m.region, m.lat, m.lon
       FROM regional_audience a
       JOIN municipalities m ON m.code = a.municipality_code
       WHERE a.network = ? AND a.metric = ? AND a.period_start = ? AND a.period_end = ? AND a.source = ? AND a.quality = ?`
    ).all(net, rep.metric, rep.period_start, rep.period_end, rep.source, rep.quality);

    const filtered = [];
    for (const r of rows) {
      if (!talentCats.has(r.talent_id)) continue;
      if (region && r.region !== region) continue;
      if (uf && r.uf !== uf) continue;
      if (citySet && !citySet.has(r.municipality_code)) continue;
      if (origin) {
        if (r.lat === null) continue;
        const d = distanceKm(origin, r);
        if (d > Number(radius)) continue;
      }
      filtered.push(r);
    }
    territoryRowsByNet.set(net, filtered);
  }

  const hasGeoFilter = Boolean(region || uf || citySet || origin);
  const talentsInTerritory = new Set();
  for (const r of territoryRowsByNet.get(network) || []) {
    talentsInTerritory.add(r.talent_id);
  }

  // 4. Compute category cards from DB
  const talentById = new Map(allTalents.map(t => [t.id, t]));
  const matchesName = tid => !artistQuery || (talentById.get(tid)?.name.toLowerCase().includes(artistQuery));

  const categoryCards = dbCategories.map(c => {
    const cid = String(c.id);
    let totalReg = 0;
    let inScope = 0;
    for (const t of allTalents) {
      if (!matchesName(t.id)) continue;
      if (talentCats.get(t.id)?.has(cid)) {
        totalReg++;
        if (!hasGeoFilter || talentsInTerritory.has(t.id)) inScope++;
      }
    }
    return {
      id: cid,
      name: c.name,
      label: CATEGORY_SHORT_LABEL[c.name] || c.name,
      count: inScope,
      totalRegistered: totalReg,
    };
  });

  const eligibleTalentIds = new Set();
  let totalTalentsInTerritory = 0;
  for (const t of allTalents) {
    if (!matchesName(t.id)) continue;
    const inTerr = !hasGeoFilter || talentsInTerritory.has(t.id);
    if (inTerr) totalTalentsInTerritory++;
    if (selectedCatObj && !talentCats.get(t.id)?.has(String(selectedCatObj.id))) continue;
    if (inTerr) eligibleTalentIds.add(t.id);
  }

  // 5. Load commercial growth metrics for the selected period (7, 30, 90 days) across all 4 networks
  const maxObsRow = db.prepare('SELECT max(observed_on) AS max_day FROM commercial_snapshots').get();
  const endDay = maxObsRow?.max_day || new Date().toISOString().slice(0, 10);
  const startDay = shiftDay(endDay, -days);
  const commPrimary = { Instagram: 'followers', YouTube: 'subscribers', Spotify: 'monthly_listeners', TikTok: 'followers' };
  const commSecondary = { Instagram: 'views', YouTube: 'views', Spotify: 'streams', TikTok: 'views' };

  const commRows = db.prepare(
    `SELECT talent_id, network, metric, observed_on, value, source, url
     FROM commercial_observations
     WHERE observed_on <= ?
     ORDER BY observed_on DESC`
  ).all(endDay);

  // Map: `${talent_id}:${network}:${metric}` -> { latest, baseline, growth, growth_pct }
  const commStats = new Map();
  const groupedComm = new Map();
  for (const r of commRows) {
    const k = `${r.talent_id}:${r.network}:${r.metric}`;
    if (!groupedComm.has(k)) groupedComm.set(k, []);
    groupedComm.get(k).push(r);
  }
  for (const [k, list] of groupedComm.entries()) {
    const latest = list[0];
    const base = list.find(x => x.observed_on <= startDay) || list.at(-1);
    const comparable = base && base.observed_on !== latest.observed_on;
    const growth = comparable ? latest.value - base.value : null;
    const growth_pct = growth !== null && base.value > 0 ? (growth / base.value) * 100 : null;
    commStats.set(k, {
      value: latest.value,
      observed_on: latest.observed_on,
      baseline_on: comparable ? base.observed_on : null,
      growth,
      growth_pct,
      source: latest.source,
      url: latest.url,
    });
  }

  // 6. Aggregate active network regional rows for map, regions, states, cities, and artists
  const activeRegRows = (territoryRowsByNet.get(network) || []).filter(r => eligibleTalentIds.has(r.talent_id));
  const placesMap = new Map();
  const stateMap = new Map();
  const regionMap = new Map();
  const artistRegMap = new Map();

  for (const r of activeRegRows) {
    // Municipality
    const p = placesMap.get(r.municipality_code) || {
      code: r.municipality_code,
      name: r.city_name,
      uf: r.uf,
      region: r.region,
      lat: r.lat,
      lon: r.lon,
      value: 0,
      talentsSet: new Set(),
      byTalent: new Map(),
    };
    p.value += r.value;
    p.talentsSet.add(r.talent_id);
    p.byTalent.set(r.talent_id, (p.byTalent.get(r.talent_id) || 0) + r.value);
    placesMap.set(r.municipality_code, p);

    // State
    const st = stateMap.get(r.uf) || { name: r.uf, value: 0, talentsSet: new Set() };
    st.value += r.value;
    st.talentsSet.add(r.talent_id);
    stateMap.set(r.uf, st);

    // Region
    const rg = regionMap.get(r.region) || { name: r.region, value: 0, talentsSet: new Set() };
    rg.value += r.value;
    rg.talentsSet.add(r.talent_id);
    regionMap.set(r.region, rg);

    // Artist regional
    const ar = artistRegMap.get(r.talent_id) || { value: 0, cities: new Map() };
    ar.value += r.value;
    ar.cities.set(r.municipality_code, {
      name: r.city_name,
      uf: r.uf,
      value: (ar.cities.get(r.municipality_code)?.value || 0) + r.value,
    });
    artistRegMap.set(r.talent_id, ar);
  }

  const places = [...placesMap.values()]
    .map(p => {
      let topTid = null, topVal = -1;
      for (const [tid, v] of p.byTalent.entries()) {
        if (v > topVal) { topVal = v; topTid = tid; }
      }
      return {
        code: p.code,
        name: p.name,
        uf: p.uf,
        region: p.region,
        lat: p.lat,
        lon: p.lon,
        value: p.value,
        talentsCount: p.talentsSet.size,
        topArtist: topTid ? talentById.get(topTid)?.name || '—' : '—',
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const byState = [...stateMap.values()]
    .map(s => ({ name: s.name, value: s.value, talentsCount: s.talentsSet.size }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const artistsByRegion = regions
    .map(rName => {
      const rg = regionMap.get(rName);
      return {
        name: rName,
        talentsCount: rg ? rg.talentsSet.size : 0,
        audience: rg ? rg.value : 0,
        value: rg ? rg.talentsSet.size : 0,
      };
    })
    .filter(r => r.talentsCount > 0 || !hasGeoFilter)
    .sort((a, b) => b.talentsCount - a.talentsCount || b.audience - a.audience);

  // 7. Media Summary for all 4 networks (Instagram, YouTube, Spotify, TikTok)
  const mediaLabels = {
    Instagram: { primary: 'Seguidores', secondary: 'Visualizações' },
    YouTube: { primary: 'Inscritos', secondary: 'Visualizações' },
    Spotify: { primary: 'Ouvintes mensais', secondary: 'Reproduções' },
    TikTok: { primary: 'Seguidores', secondary: 'Visualizações' },
  };

  const mediaSummary = ['Instagram', 'YouTube', 'Spotify', 'TikTok'].map(net => {
    const pMetric = commPrimary[net];
    const sMetric = commSecondary[net];
    let primarySum = 0;
    let secondarySum = 0;
    let growthPctSum = 0;
    let growthCount = 0;
    let netTalents = 0;
    for (const tid of eligibleTalentIds) {
      const pStat = commStats.get(`${tid}:${net}:${pMetric}`);
      const sStat = commStats.get(`${tid}:${net}:${sMetric}`);
      if (pStat) {
        primarySum += pStat.value;
        netTalents++;
        if (pStat.growth_pct !== null) {
          growthPctSum += pStat.growth_pct;
          growthCount++;
        }
      }
      if (sStat) {
        secondarySum += sStat.value;
      }
    }
    const regVol = (territoryRowsByNet.get(net) || [])
      .filter(r => eligibleTalentIds.has(r.talent_id))
      .reduce((sum, r) => sum + r.value, 0);

    return {
      network: net,
      primaryLabel: mediaLabels[net].primary,
      secondaryLabel: mediaLabels[net].secondary,
      primaryValue: primarySum,
      secondaryValue: secondarySum,
      regionalAudience: regVol,
      avgGrowthPct: growthCount > 0 ? growthPctSum / growthCount : null,
      talentsCount: netTalents,
    };
  });

  // 8. Category Growth ranking
  const categoryGrowth = dbCategories
    .map(c => {
      const cid = String(c.id);
      let pctSum = 0;
      let pctCount = 0;
      let absGrowth = 0;
      let catTalents = 0;
      for (const t of allTalents) {
        if (!eligibleTalentIds.has(t.id) && selectedCatObj) continue;
        if (! (!hasGeoFilter || talentsInTerritory.has(t.id))) continue;
        if (!talentCats.get(t.id)?.has(cid)) continue;
        catTalents++;
        const st = commStats.get(`${t.id}:${network}:${commPrimary[network]}`);
        if (st && st.growth_pct !== null) {
          pctSum += st.growth_pct;
          pctCount++;
          absGrowth += st.growth || 0;
        }
      }
      return {
        id: cid,
        name: CATEGORY_SHORT_LABEL[c.name] || c.name,
        fullName: c.name,
        talentsCount: catTalents,
        growth_pct: pctCount > 0 ? pctSum / pctCount : null,
        growth: absGrowth,
        value: pctCount > 0 ? Math.round((pctSum / pctCount) * 10) / 10 : 0,
      };
    })
    .filter(c => c.talentsCount > 0)
    .sort((a, b) => (b.growth_pct ?? -Infinity) - (a.growth_pct ?? -Infinity) || b.talentsCount - a.talentsCount);

  // 9. Selected Localities (Individual and Consolidated Totals for selected cities or top cities in scope)
  const localityCodes = explicitCityCodes.length
    ? explicitCityCodes
    : places.slice(0, 8).map(p => p.code);

  const localityItems = [];
  const consolByNet = { Instagram: 0, YouTube: 0, Spotify: 0, TikTok: 0 };
  const consolTalents = new Set();
  let consolAudience = 0;

  for (const code of localityCodes) {
    const muni = lookup(code);
    if (!muni) continue;
    const pEntry = placesMap.get(code);
    const byNet = { Instagram: 0, YouTube: 0, Spotify: 0, TikTok: 0 };
    for (const net of ['Instagram', 'YouTube', 'Spotify', 'TikTok']) {
      for (const r of territoryRowsByNet.get(net) || []) {
        if (r.municipality_code === code && eligibleTalentIds.has(r.talent_id)) {
          byNet[net] += r.value;
          consolByNet[net] += r.value;
          if (net === network) consolTalents.add(r.talent_id);
        }
      }
    }
    const aud = pEntry ? pEntry.value : 0;
    consolAudience += aud;
    let topTid = null, topV = -1;
    if (pEntry) {
      for (const [tid, v] of pEntry.byTalent.entries()) {
        if (v > topV) { topV = v; topTid = tid; }
      }
    }
    localityItems.push({
      code: muni.code,
      name: muni.name,
      uf: muni.uf,
      region: muni.region,
      audience: aud,
      talentsCount: pEntry ? pEntry.talentsSet.size : 0,
      topArtist: topTid ? talentById.get(topTid)?.name || '—' : '—',
      byNetwork: byNet,
    });
  }

  for (const item of localityItems) {
    item.sharePct = consolAudience > 0 ? (item.audience / consolAudience) * 100 : 0;
  }

  // 10. Artists Ranking in Scope
  const artists = [...eligibleTalentIds]
    .map(tid => {
      const t = talentById.get(tid);
      const cIds = [...(talentCats.get(tid) || [])];
      const catNames = cIds.map(id => catById.get(id)?.name).filter(Boolean);
      const pStat = commStats.get(`${tid}:${network}:${commPrimary[network]}`);
      const sStat = commStats.get(`${tid}:${network}:${commSecondary[network]}`);
      const reg = artistRegMap.get(tid);
      let topCity = '—';
      if (reg && reg.cities.size) {
        const sortedCities = [...reg.cities.values()].sort((a, b) => b.value - a.value);
        topCity = `${sortedCities[0].name}/${sortedCities[0].uf}`;
      }
      return {
        id: tid,
        name: t.name,
        category: catNames.map(n => CATEGORY_SHORT_LABEL[n] || n).join(', ') || 'Geral',
        categoryId: cIds[0] || '',
        network,
        primaryLabel: mediaLabels[network].primary,
        primaryValue: pStat?.value ?? null,
        secondaryValue: sStat?.value ?? null,
        growth: pStat?.growth ?? null,
        growth_pct: pStat?.growth_pct ?? null,
        observed_on: pStat?.observed_on ?? null,
        regionalAudience: reg?.value ?? 0,
        citiesCount: reg ? reg.cities.size : 0,
        topCity,
      };
    })
    .sort((a, b) => (b.growth_pct ?? -Infinity) - (a.growth_pct ?? -Infinity) || b.regionalAudience - a.regionalAudience || a.name.localeCompare(b.name));

  return {
    network,
    days,
    startDay,
    endDay,
    region: region || null,
    uf: uf || null,
    selectedCategory: selectedCatObj ? String(selectedCatObj.id) : '',
    selectedCategoryName: selectedCatObj ? selectedCatObj.name : 'Todas',
    explicitCities: explicitCityCodes,
    totalTalents: totalTalentsInTerritory,
    totalRegisteredTalents: allTalents.length,
    categories: categoryCards,
    mediaSummary,
    artistsByRegion,
    categoryGrowth,
    byState,
    places,
    selectedLocalities: {
      isExplicit: explicitCityCodes.length > 0,
      consolidated: {
        citiesCount: localityItems.length,
        talentsCount: consolTalents.size,
        audienceTotal: consolAudience,
        byNetwork: consolByNet,
      },
      items: localityItems,
    },
    artists,
    origin,
    radius: origin ? Number(radius) : null,
    reportPeriod: activeRep ? `${activeRep.period_start} a ${activeRep.period_end}` : null,
    notice: 'Monitoramento de artistas por categoria, evolução nas mídias digitais e concentração geográfica na Base Geográfica Nacional.',
  };
}

export function radarQuery(db,path,p) {
  const get=k=>p.get(k)||'';
  if(path==='/api/radar/overview') return radarOverview(db,p);
  if(path==='/api/radar/geography') {const asset=db.prepare('SELECT * FROM geographic_assets WHERE id=?').get('states');return {total:db.prepare('SELECT count(*) n FROM municipalities').get().n,coordinates:db.prepare('SELECT count(*) n FROM municipalities WHERE lat IS NOT NULL').get().n,states:asset?JSON.parse(asset.geojson):null,version:asset?.version??null,municipalities:db.prepare('SELECT code,name,uf,region,lat,lon FROM municipalities WHERE lat IS NOT NULL AND lon IS NOT NULL').all()};}
  if(path==='/api/radar/reports') return db.prepare('SELECT network,metric,period_start,period_end,source,quality,count(*) records FROM regional_audience GROUP BY network,metric,period_start,period_end,source,quality ORDER BY period_end DESC').all();
  if(path==='/api/radar/modalities') return db.prepare('SELECT * FROM modalities ORDER BY name').all().map(m=>({...m,submodalities:db.prepare('SELECT id,name FROM submodalities WHERE modality_id=? ORDER BY name').all(m.id)}));
  if(path==='/api/radar/municipalities') {
    const q=get('q').trim(); return {total:db.prepare('SELECT count(*) n FROM municipalities').get().n,items:db.prepare('SELECT * FROM municipalities WHERE name LIKE ? OR code=? ORDER BY name,uf LIMIT 100').all('%'+q+'%',q)};
  }
  if(path!=='/api/radar/ranking') return undefined;
  const network=get('network')||'YouTube', mode=get('mode')||'national', metric=get('metric')||(mode==='national'?{YouTube:'subscribers',Instagram:'followers',Spotify:'monthly_listeners'}[network]:{YouTube:'views',Instagram:'followers',Spotify:'listeners'}[network]);
  if(!['national','regional'].includes(mode)) fail('Modo inválido');
  if(!db.prepare(`SELECT 1 FROM ${mode==='national'?'network_metrics':'regional_metrics'} WHERE network=? AND metric=?`).get(network,metric||'')) fail('Rede ou métrica inválida');
  const modality=get('modality'), sub=get('submodality'), region=get('region'), uf=get('uf'), city=get('city'), center=get('center'), radius=get('radius'), quality=get('quality'), source=get('source'), start=get('start'), end=get('end');
  const order=get('order')||'audience'; if(!['audience','growth','growth_pct'].includes(order)) fail('Ordenação inválida');
  if(modality&&!db.prepare('SELECT 1 FROM modalities WHERE id=?').get(modality)) fail('Modalidade inválida');
  if(sub&&(!/^\d+$/.test(sub)||!db.prepare('SELECT 1 FROM submodalities WHERE id=? AND (?=\'\' OR modality_id=?)').get(Number(sub),modality,modality))) fail('Submodalidade inválida');
  if(region&&!regions.includes(region)) fail('Região inválida'); if(uf&&!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf)) fail('UF inválida');
  if((start&&!date(start))||(end&&!date(end))||(start&&end&&start>end)) fail('Período inválido');
  if(quality&&!['verified','estimated'].includes(quality)) fail('Qualidade inválida');
  if(mode==='national'&&(region||uf||city||center||radius||quality||source)) fail('Filtros geográficos exigem métricas regionais');
  if(mode==='regional'&&(!start||!end||order!=='audience'||!source||!quality)) fail('Informe período exato, fonte e qualidade; ranking regional inicial por audiência');
  if(mode==='national'&&order!=='audience'&&(!start||!end)) fail('Crescimento exige início e fim');
  const lookup=code=>db.prepare('SELECT * FROM municipalities WHERE code=?').get(code);
  if(city&&!lookup(city)) fail('Município desconhecido');
  let origin; if(center||radius!=='') {if(!center||radius===''||!Number.isFinite(Number(radius))||Number(radius)<0||Number(radius)>10000) fail('Raio inválido'); origin=lookup(center); if(!origin||origin.lat===null) fail('Centro sem coordenadas');}
  const talents=db.prepare(`SELECT id,name,entity_type FROM talents t WHERE blocked=0 AND (?='' OR EXISTS(SELECT 1 FROM talent_modalities m WHERE m.talent_id=t.id AND m.modality_id=?)) AND (?='' OR EXISTS(SELECT 1 FROM talent_submodalities s WHERE s.talent_id=t.id AND s.submodality_id=?)) AND (?='' OR t.id=?)`).all(modality,modality,sub,sub,get('talent'),get('talent'));
  const allowed=new Map(talents.map(t=>[t.id,t])); const rows=[]; const places=new Map(); let excludedCoordinates=0;
  if(mode==='national') {
    // Uma conta por talento/rede: maior valor observado no fim, sem somar contas potencialmente sobrepostas.
    const data=db.prepare(`SELECT a.talent_id,a.id account_id,s.value,s.observed_on,s.source FROM social_accounts a JOIN metric_snapshots s ON s.account_id=a.id WHERE a.identity_confirmed=1 AND a.network=? AND s.metric=? AND (?='' OR s.observed_on>=?) AND (?='' OR s.observed_on<=?) ORDER BY s.observed_on DESC,s.id DESC`).all(network,metric,start,start,end,end);
    const accounts=new Map(); for(const r of data) if(allowed.has(r.talent_id)){ const a=accounts.get(r.account_id)||{last:r,first:r}; a.first=r; accounts.set(r.account_id,a); }
    const best=new Map(); for(const a of accounts.values()){ const old=best.get(a.last.talent_id); if(!old||a.last.observed_on>old.last.observed_on||(a.last.observed_on===old.last.observed_on&&(a.last.value>old.last.value||(a.last.value===old.last.value&&a.last.account_id<old.last.account_id)))) best.set(a.last.talent_id,a); }
    for(const [id,a] of best){ const comparable=a.first.observed_on!==a.last.observed_on&&a.first.source===a.last.source; const growth=comparable?a.last.value-a.first.value:null; rows.push({...allowed.get(id),value:a.last.value,source:a.last.source,observed_on:a.last.observed_on,baseline_on:comparable?a.first.observed_on:null,growth,growth_pct:growth!==null&&a.first.value>0?growth/a.first.value*100:null}); }
  } else {
    const data=db.prepare(`SELECT a.*,m.name city_name,m.uf,m.region,m.lat,m.lon FROM regional_audience a JOIN municipalities m ON m.code=a.municipality_code WHERE network=? AND metric=? AND period_start=? AND period_end=? AND a.source=? AND a.quality=?`).all(network,metric,start,end,source,quality);
    const sums=new Map(); for(const r of data){if(!allowed.has(r.talent_id)||(region&&r.region!==region)||(uf&&r.uf!==uf)||(city&&r.municipality_code!==city)) continue; if(origin&&r.lat===null){excludedCoordinates++;continue;} const d=origin?distanceKm(origin,r):null; if(origin&&d>Number(radius)) continue; const x=sums.get(r.talent_id)||{...allowed.get(r.talent_id),value:0,cities:0,source,quality}; x.value+=r.value;x.cities++;sums.set(r.talent_id,x); const place=places.get(r.municipality_code)||{code:r.municipality_code,name:r.city_name,uf:r.uf,region:r.region,lat:r.lat,lon:r.lon,distance_km:d,value:0};place.value+=r.value;places.set(r.municipality_code,place); }
    rows.push(...sums.values());
  }
  const aggregate=field=>{const totals=new Map();for(const place of places.values())totals.set(place[field],(totals.get(place[field])||0)+place.value);return [...totals].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);};
  const key=order==='audience'?'value':order; const ranked=rows.filter(r=>r[key]!=null).sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id)).map((r,i)=>({...r,rank:i+1}));
  const limit=Number(get('limit')||50), offset=Number(get('offset')||0); if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isSafeInteger(offset)||offset<0) fail('Paginação inválida');
  return {mode,network,metric,total:ranked.length,eligible:talents.length,items:ranked.slice(offset,offset+limit),places:[...places.values()].sort((a,b)=>b.value-a.value),byRegion:aggregate('region'),byState:aggregate('uf'),excludedCoordinates,origin, radius:origin?Number(radius):null,notice:mode==='regional'?'Valores conhecidos por cidade; soma entre talentos não representa pessoas únicas.':'Conta confirmada mais recente por talento; empate pelo maior valor. Dados nacionais não indicam localização.'};
}
