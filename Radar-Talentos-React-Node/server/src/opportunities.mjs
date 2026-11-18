import {radarQuery,FilterError} from './radar.mjs';
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
