import { commercialQuery, metrics } from './commercial.mjs';
import { PLATFORM_POLICIES } from './discovery.mjs';
import { radarQuery, FilterError } from './radar.mjs';
const networks=Object.keys(metrics);
const regionalPreferred={YouTube:['views','subscribers'],Instagram:['views','reach','followers'],Spotify:['streams','listeners'],TikTok:['views','reach','followers']};
const primary={YouTube:'subscribers',Instagram:'followers',Spotify:'monthly_listeners',TikTok:'followers'};
export function commercialInsights(db,p){
 const talent=p.get('talent')||'', rawNet=p.get('network')||'all', isAll=rawNet==='all'||rawNet==='Todas as mídias', network=isAll?'all':rawNet, days=p.get('days')||'30', modality=p.get('modality')||'',region=p.get('region')||'',scope=p.get('scope')||'all';
 if((!isAll&&!networks.includes(network))||!['all','artist'].includes(scope)||scope==='artist'&&!talent||!['','Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].includes(region))throw new FilterError('Filtro de detalhes inválido');
 if(modality&&!db.prepare('SELECT 1 FROM modalities WHERE id=?').get(modality))throw new FilterError('Modalidade inválida');
 const base=new URLSearchParams({network,days});if(p.get('end'))base.set('end',p.get('end'));const {start,end}=commercialQuery(db,new URLSearchParams({...Object.fromEntries(base),talent:'__period_validation__'}));
 const artist=talent?db.prepare('SELECT id,name FROM talents WHERE id=? AND blocked=0').get(talent):null;if(talent&&!artist)throw new FilterError('Artista não encontrado');
 const findCurrent=db.prepare('SELECT status,status_detail,collected_at,source FROM metric_current WHERE talent_id=? AND network=? AND metric=? LIMIT 1');
 const national=artist?networks.map(n=>{
  const queryWin=d=>commercialQuery(db,new URLSearchParams({network:n,metric:primary[n],days:String(d),end,talent})).items[0]??null;
  const item=queryWin(days);
  const windows={7:Number(days)===7?item:queryWin(7),30:Number(days)===30?item:queryWin(30),90:Number(days)===90?item:queryWin(90)};
  const cur=findCurrent.get(talent,n,primary[n]);
  const policy=PLATFORM_POLICIES[n]??{};
  const currentStatus=cur??(item?{status:'available',status_detail:'Atualizado',collected_at:item.collected_at??item.observed_on,source:item.source}:{status:policy.fallbackStatus??'pending_source',status_detail:policy.fallbackLabel??'Fonte pendente · Dados indisponíveis',collected_at:null,source:null});
  return {network:n,metric:primary[n],item,windows,currentStatus};
 }):[];
 const consolidatedWindows=artist?[7,30,90].reduce((acc,w)=>{
  const comp=national.filter(n=>n.windows?.[w]?.growth_pct!=null).sort((a,b)=>b.windows[w].growth_pct-a.windows[w].growth_pct);
  const avgPct=comp.length?comp.reduce((s,n)=>s+n.windows[w].growth_pct,0)/comp.length:null;
  const topW=comp[0]??null;
  acc[w]={days:w,growth_pct:avgPct,comparable_networks:comp.length,top_network:topW?topW.network:null,top_growth_pct:topW?topW.windows[w].growth_pct:null,top_growth:topW?topW.windows[w].growth:null};
  return acc;
 },{}):null;
 const subject=scope==='artist'?talent:'';
 const reports=db.prepare(`SELECT a.network,a.metric,a.period_start,a.period_end,a.source,a.quality,count(DISTINCT a.talent_id) talents FROM regional_audience a JOIN talents t ON t.id=a.talent_id JOIN municipalities m ON m.code=a.municipality_code WHERE t.blocked=0 AND a.period_start>=? AND a.period_end<=? AND (?='' OR a.talent_id=?) AND (?='' OR m.region=?) AND (?='' OR EXISTS(SELECT 1 FROM talent_modalities tm WHERE tm.talent_id=t.id AND tm.modality_id=?)) GROUP BY a.network,a.metric,a.period_start,a.period_end,a.source,a.quality ORDER BY a.period_end DESC,a.period_start ASC, a.source`).all(start,end,subject,subject,region,region,modality,modality);
 const regional=networks.map(n=>{const preferred=regionalPreferred[n],selected=p.get('metric_'+n)||'';if(selected&&!preferred.includes(selected))throw new FilterError('Indicador regional inválido');const available=reports.filter(r=>r.network===n&&preferred.includes(r.metric));const choices=[...new Set(available.map(r=>r.metric))].sort((a,b)=>preferred.indexOf(a)-preferred.indexOf(b));const candidates=available.filter(r=>!selected||r.metric===selected).sort((a,b)=>b.period_end.localeCompare(a.period_end)||Number(b.quality==='verified')-Number(a.quality==='verified')||preferred.indexOf(a.metric)-preferred.indexOf(b.metric)||a.period_start.localeCompare(b.period_start)||a.source.localeCompare(b.source));const report=candidates[0];if(!report)return {network:n,choices,report:null,cities:[],regions:[],total:null};const params=new URLSearchParams({mode:'regional',order:'audience',network:n,metric:report.metric,start:report.period_start,end:report.period_end,source:report.source,quality:report.quality,talent:subject,modality,region});const r=radarQuery(db,'/api/radar/ranking',params);const total=r.places.reduce((s,c)=>s+c.value,0);
 // Comparação municipal só para um artista, em janelas adjacentes de igual duração e fonte/qualidade idênticas.
 let cityGrowth=null;
 if(subject){const day=86400000,previousEnd=new Date(Date.parse(report.period_start)-day).toISOString().slice(0,10),previousStart=new Date(Date.parse(previousEnd)-(Date.parse(report.period_end)-Date.parse(report.period_start))).toISOString().slice(0,10);const priorParams=new URLSearchParams(params);priorParams.set('start',previousStart);priorParams.set('end',previousEnd);const prior=radarQuery(db,'/api/radar/ranking',priorParams);const before=new Map(prior.places.map(c=>[c.code,c.value]));const comparable=r.places.filter(c=>before.has(c.code)).map(c=>({...c,previous:before.get(c.code),growth:c.value-before.get(c.code),growth_pct:before.get(c.code)>0?(c.value-before.get(c.code))/before.get(c.code)*100:null})).sort((a,b)=>b.growth-a.growth||a.code.localeCompare(b.code));if(comparable.length)cityGrowth={previousStart,previousEnd,comparable:comparable.length,leaders:comparable.filter(c=>c.growth>0).slice(0,5)};}
 return {network:n,choices,report,cities:r.places.slice(0,5),regions:r.byRegion,total,municipalities:r.places.length,talents:r.total,cityGrowth};});
 const topNet=national.filter(x=>x.item?.growth_pct!=null).sort((a,b)=>b.item.growth_pct-a.item.growth_pct)[0]??null;
 const allRising=regional.flatMap(g=>(g.cityGrowth?.leaders??[]).map(c=>({...c,network:g.network}))).sort((a,b)=>(b.growth_pct??0)-(a.growth_pct??0)||b.growth-a.growth);
 const lastCollected=national.map(x=>x.item?.observed_on).filter(Boolean).sort().at(-1)??null;
 return {artist,network,start,end,scope,national,consolidatedWindows,regional,topNetwork:topNet?{network:topNet.network,metric:topNet.metric,growth:topNet.item.growth,growth_pct:topNet.item.growth_pct}:null,risingCity:allRising[0]??null,lastCollected};
}
