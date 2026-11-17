export class FilterError extends Error {}
const fail = message => { throw new FilterError(message); };
const regions = ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
export function distanceKm(a,b) {
  const rad=Math.PI/180, dlat=(b.lat-a.lat)*rad, dlon=(b.lon-a.lon)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
export function radarQuery(db,path,p) {
  const get=k=>p.get(k)||'';
  if(path==='/api/radar/geography') {const asset=db.prepare('SELECT * FROM geographic_assets WHERE id=?').get('states');return {total:db.prepare('SELECT count(*) n FROM municipalities').get().n,coordinates:db.prepare('SELECT count(*) n FROM municipalities WHERE lat IS NOT NULL').get().n,states:asset?JSON.parse(asset.geojson):null,version:asset?.version??null};}
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
