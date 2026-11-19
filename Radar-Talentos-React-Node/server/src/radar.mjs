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
  if(path==='/api/radar/geography') {const asset=db.prepare('SELECT * FROM geographic_assets WHERE id=?').get('states');return {total:db.prepare('SELECT count(*) n FROM municipalities').get().n,coordinates:db.prepare('SELECT count(*) n FROM municipalities WHERE lat IS NOT NULL').get().n,states:asset?JSON.parse(asset.geojson):null,version:asset?.version??null,municipalities:db.prepare('SELECT code,name,uf,region,lat,lon FROM municipalities WHERE lat IS NOT NULL AND lon IS NOT NULL').all()};}
  if(path==='/api/radar/reports') return db.prepare('SELECT network,metric,period_start,period_end,source,quality,count(*) records FROM regional_audience GROUP BY network,metric,period_start,period_end,source,quality ORDER BY period_end DESC').all();
  if(path==='/api/radar/modalities') return db.prepare('SELECT * FROM modalities ORDER BY name').all().map(m=>({...m,submodalities:db.prepare('SELECT id,name FROM submodalities WHERE modality_id=? ORDER BY name').all(m.id)}));
  if(path==='/api/radar/municipalities') {
    const norm=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    const rawQ=norm(get('q').trim()), uf=get('uf'), region=get('region');
    const qClean=rawQ.replace(/[\/,-]+/g,' ').replace(/\s+/g,' ').trim();
    const qParts=qClean?qClean.split(' '):[];
    const maybeUf=qParts.length>1&&/^[a-z]{2}$/.test(qParts.at(-1))?qParts.at(-1):'';
    const nameQuery=maybeUf?qParts.slice(0,-1).join(' '):qClean;
    const items=db.prepare(`SELECT code,name,uf,region,lat,lon FROM municipalities WHERE (?='' OR uf=?) AND (?='' OR region=?) ORDER BY name,uf`).all(uf,uf,region,region).filter(m=>{
      if(!rawQ)return true;
      const mn=norm(m.name), muf=norm(m.uf);
      if(m.code===rawQ||mn.includes(rawQ)||mn.includes(qClean))return true;
      if(maybeUf&&muf===maybeUf&&mn.includes(nameQuery))return true;
      return `${mn} / ${muf}`.includes(rawQ)||`${mn} ${muf}`.includes(qClean);
    });
    if(rawQ){
      const target=nameQuery||qClean;
      items.sort((a,b)=>{
        const an=norm(a.name), bn=norm(b.name);
        const aExact=an===target?0:an.startsWith(target)?1:2;
        const bExact=bn===target?0:bn.startsWith(target)?1:2;
        return aExact-bExact||a.name.localeCompare(b.name)||a.uf.localeCompare(b.uf);
      });
    }
    return {total:items.length,items};
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
  if(mode==='national'&&(region||uf||city||p.getAll('cities').length||center||radius||quality||source)) fail('Filtros geográficos exigem métricas regionais');
  if(mode==='regional'&&(!start||!end||order!=='audience'||!source||!quality)) fail('Informe período exato, fonte e qualidade; ranking regional inicial por audiência');
  if(mode==='national'&&order!=='audience'&&(!start||!end)) fail('Crescimento exige início e fim');
  const lookup=code=>db.prepare('SELECT * FROM municipalities WHERE code=?').get(code);
  const selectedCities=new Set([city,...p.getAll('cities')].filter(Boolean)); if(selectedCities.size>100||[...selectedCities].some(c=>!lookup(c))) fail('Município desconhecido');
  const category=get('category'); if(category&&category!=='unclassified'&&!db.prepare('SELECT 1 FROM categories WHERE id=?').get(category))fail('Categoria inválida');
  let origin; if(center||radius!=='') {if(!center||radius===''||!Number.isFinite(Number(radius))||Number(radius)<0||Number(radius)>10000) fail('Raio inválido'); origin=lookup(center); if(!origin||origin.lat===null) fail('Centro sem coordenadas');}
  const talents=db.prepare(`SELECT id,name,entity_type FROM talents t WHERE blocked=0 AND (?='' OR EXISTS(SELECT 1 FROM talent_modalities m WHERE m.talent_id=t.id AND m.modality_id=?)) AND (?='' OR EXISTS(SELECT 1 FROM talent_submodalities s WHERE s.talent_id=t.id AND s.submodality_id=?)) AND (?='' OR t.id=?)`).all(modality,modality,sub,sub,get('talent'),get('talent'));
  const classifications=new Map();for(const c of db.prepare('SELECT talent_id,category_id FROM talent_categories').all()){if(!classifications.has(c.talent_id))classifications.set(c.talent_id,new Set());classifications.get(c.talent_id).add(String(c.category_id));}const hasCategory=id=>!category||(category==='unclassified'?!classifications.has(id):classifications.get(id)?.has(category));
  const baseAllowed=new Map(talents.map(t=>[t.id,t])),allowed=new Map(talents.filter(t=>hasCategory(t.id)).map(t=>[t.id,t])); const rows=[]; const places=new Map(); const growthLeaders=[],matching=new Set(),regionTalents=new Map(); let excludedCoordinates=0;
  if(mode==='national') {
    // Uma conta por talento/rede: maior valor observado no fim, sem somar contas potencialmente sobrepostas.
    const data=db.prepare(`SELECT a.talent_id,a.id account_id,s.value,s.observed_on,s.source FROM social_accounts a JOIN metric_snapshots s ON s.account_id=a.id WHERE a.identity_confirmed=1 AND a.network=? AND s.metric=? AND (?='' OR s.observed_on>=?) AND (?='' OR s.observed_on<=?) ORDER BY s.observed_on DESC,s.id DESC`).all(network,metric,start,start,end,end);
    const accounts=new Map(); for(const r of data) if(baseAllowed.has(r.talent_id)){ const a=accounts.get(r.account_id)||{last:r,first:r}; a.first=r; accounts.set(r.account_id,a); }
    const best=new Map(); for(const a of accounts.values()){ const old=best.get(a.last.talent_id); if(!old||a.last.observed_on>old.last.observed_on||(a.last.observed_on===old.last.observed_on&&(a.last.value>old.last.value||(a.last.value===old.last.value&&a.last.account_id<old.last.account_id)))) best.set(a.last.talent_id,a); }
    for(const [id,a] of best){ matching.add(id);if(!allowed.has(id))continue; const comparable=a.first.observed_on!==a.last.observed_on&&a.first.source===a.last.source; const growth=comparable?a.last.value-a.first.value:null; rows.push({...allowed.get(id),value:a.last.value,source:a.last.source,observed_on:a.last.observed_on,baseline_on:comparable?a.first.observed_on:null,growth,growth_pct:growth!==null&&a.first.value>0?growth/a.first.value*100:null}); }
  } else {
    const data=db.prepare(`SELECT a.*,m.name city_name,m.uf,m.region,m.lat,m.lon FROM regional_audience a JOIN municipalities m ON m.code=a.municipality_code WHERE network=? AND metric=? AND period_start=? AND period_end=? AND a.source=? AND a.quality=?`).all(network,metric,start,end,source,quality);
    const inScope=r=>baseAllowed.has(r.talent_id)&&(!region||r.region===region)&&(!uf||r.uf===uf)&&(!selectedCities.size||selectedCities.has(r.municipality_code));
    const sums=new Map(),grids=new Map(); for(const r of data){if(!inScope(r)) continue; if(origin&&r.lat===null){excludedCoordinates++;continue;} const d=origin?distanceKm(origin,r):null; if(origin&&d>Number(radius)) continue; matching.add(r.talent_id);if(!allowed.has(r.talent_id))continue;if(!regionTalents.has(r.region))regionTalents.set(r.region,new Set());regionTalents.get(r.region).add(r.talent_id); const x=sums.get(r.talent_id)||{...allowed.get(r.talent_id),value:0,cities:0,source,quality}; x.value+=r.value;x.cities++;sums.set(r.talent_id,x);if(!grids.has(r.talent_id))grids.set(r.talent_id,new Set());grids.get(r.talent_id).add(r.municipality_code); const place=places.get(r.municipality_code)||{code:r.municipality_code,name:r.city_name,uf:r.uf,region:r.region,lat:r.lat,lon:r.lon,distance_km:d,value:0};place.value+=r.value;places.set(r.municipality_code,place); }
    // Período anterior de igual duração. Só comparar quando o conjunto de municípios é idêntico.
    const duration=(Date.parse(end)-Date.parse(start))/86400000+1;
    const priorEnd=new Date(Date.parse(start)-86400000).toISOString().slice(0,10),priorStart=new Date(Date.parse(start)-duration*86400000).toISOString().slice(0,10);
    const previous=db.prepare(`SELECT a.*,m.uf,m.region,m.lat,m.lon FROM regional_audience a JOIN municipalities m ON m.code=a.municipality_code WHERE network=? AND metric=? AND period_start=? AND period_end=? AND a.source=? AND a.quality=?`).all(network,metric,priorStart,priorEnd,source,quality);
    const prev=new Map();for(const r of previous){if(!inScope(r)||!allowed.has(r.talent_id)||origin&&(r.lat===null||distanceKm(origin,r)>Number(radius)))continue;const x=prev.get(r.talent_id)||{value:0,codes:new Set()};x.value+=r.value;x.codes.add(r.municipality_code);prev.set(r.talent_id,x);}
    for(const [id,row] of sums){const before=prev.get(id),codes=grids.get(id),comparable=before&&before.codes.size===codes.size&&[...codes].every(c=>before.codes.has(c));row.growth=comparable?row.value-before.value:null;row.growth_pct=comparable&&before.value>0?100*row.growth/before.value:null;row.previous_value=comparable?before.value:null;if(comparable){row.previous_start=priorStart;row.previous_end=priorEnd;growthLeaders.push(row);}rows.push(row);}
    growthLeaders.sort((a,b)=>(b.growth_pct??-Infinity)-(a.growth_pct??-Infinity)||b.growth-a.growth||a.id.localeCompare(b.id));
  }
  const aggregate=field=>{const totals=new Map();for(const place of places.values())totals.set(place[field],(totals.get(place[field])||0)+place.value);return [...totals].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);};
  const categoryCounts=db.prepare('SELECT c.id,c.name,tc.talent_id FROM categories c LEFT JOIN talent_categories tc ON c.id=tc.category_id ORDER BY c.name').all(); const counts=new Map(); for(const c of categoryCounts){if(!counts.has(c.id))counts.set(c.id,{id:c.id,name:c.name,value:0});if(matching.has(c.talent_id))counts.get(c.id).value++;} counts.set('unclassified',{id:'unclassified',name:'Sem categoria',value:[...matching].filter(id=>!classifications.has(id)).length});
  const key=order==='audience'?'value':order; const ranked=rows.filter(r=>r[key]!=null).sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id)).map((r,i)=>({...r,rank:i+1}));
  const limit=Number(get('limit')||50), offset=Number(get('offset')||0); if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isSafeInteger(offset)||offset<0) fail('Paginação inválida');
  return {scopeTotal:matching.size,byRegionTalent:[...regionTalents].map(([name,ids])=>({name,value:ids.size})).sort((a,b)=>b.value-a.value),categories:[...counts.values()],growthLeaders:growthLeaders.slice(0,50),comparableCount:growthLeaders.length,mode,network,metric,total:ranked.length,eligible:allowed.size,items:ranked.slice(offset,offset+limit),places:[...places.values()].sort((a,b)=>b.value-a.value),byRegion:aggregate('region'),byState:aggregate('uf'),excludedCoordinates,origin, radius:origin?Number(radius):null,notice:mode==='regional'?'Valores conhecidos por cidade; soma entre talentos não representa pessoas únicas.':'Conta confirmada mais recente por talento; empate pelo maior valor. Dados nacionais não indicam localização.'};
}
