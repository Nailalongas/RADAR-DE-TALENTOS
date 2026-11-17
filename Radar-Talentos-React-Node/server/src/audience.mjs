import { randomUUID } from 'node:crypto';
const official={YouTube:'YouTube Analytics',Instagram:'Instagram Insights',Spotify:'Spotify for Artists'};
const metrics={YouTube:['views'],Instagram:['followers','reach','views'],Spotify:['listeners','streams']};
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
export function importAudience(db,report){
 const {account_id,network,metric,period_start,period_end,report_ref,authorization_ref,quality,rows,coverage='partial'}=report;
 const source=quality==='verified'?official[network]:report.source;
 if(!metrics[network]?.includes(metric)||!['verified','estimated'].includes(quality)||!nonempty(source)||!nonempty(report_ref)||!nonempty(authorization_ref)||!date(period_start)||!date(period_end)||period_start>period_end||!Array.isArray(rows)||!['partial','complete'].includes(coverage))throw Error('Metadados do relatório inválidos');
 const account=db.prepare('SELECT a.* FROM social_accounts a JOIN talents t ON t.id=a.talent_id WHERE a.id=? AND a.network=? AND a.identity_confirmed=1 AND t.blocked=0').get(account_id??'',network);
 if(!account)throw Error('Conta confirmada e ativa obrigatória');
 // A tabela regional legada não separa contas: impedir sobreposição entre contas do mesmo talento.
 const other=db.prepare('SELECT 1 FROM audience_import_runs r JOIN social_accounts a ON a.id=r.account_id WHERE a.talent_id=? AND r.account_id<>? AND r.network=? AND r.metric=? AND r.source=? AND r.period_start=? AND r.period_end=? AND r.status IN (\'success\',\'partial\',\'empty\')').get(account.talent_id,account_id,network,metric,source,period_start,period_end);
 if(other)throw Error('Outra conta já representa este talento neste relatório');
 const id=randomUUID(), mapped=new Map(), unknown=[]; const seen=new Set();
 for(const row of rows){
  if(!Number.isSafeInteger(row.value)||row.value<0)throw Error('Valor inválido: use contagem inteira, não percentual');
  const k=row.municipality_code?String(row.municipality_code):row.external_city;
  if(!nonempty(k)||seen.has(k))throw Error('Cidade ausente ou duplicada');seen.add(k);
  const code=row.municipality_code?String(row.municipality_code):db.prepare('SELECT municipality_code FROM audience_city_map WHERE network=? AND external_city=?').get(network,k)?.municipality_code;
  if(!code||!db.prepare('SELECT 1 FROM municipalities WHERE code=?').get(code)){unknown.push(k);continue;}
  if(mapped.has(code))throw Error('Duas linhas mapeiam para o mesmo município');mapped.set(code,row.value);
 }
 const status=!rows.length?'empty':unknown.length||coverage==='partial'?'partial':'success';
 db.exec('BEGIN IMMEDIATE');try{
 // Não substituir uma fotografia antiga por resposta vazia ou não resolvida.
 if(mapped.size){
  const oldComplete=db.prepare("SELECT 1 FROM audience_import_runs WHERE account_id=? AND network=? AND metric=? AND source=? AND period_start=? AND period_end=? AND status='success'").get(account_id,network,metric,source,period_start,period_end);
  if(status==='partial'&&oldComplete)throw Error('Relatório parcial não pode substituir fotografia completa');
  const existing=db.prepare('SELECT DISTINCT quality FROM regional_audience WHERE talent_id=? AND network=? AND metric=? AND source=? AND period_start=? AND period_end=?').all(account.talent_id,network,metric,source,period_start,period_end);
  if(existing.some(r=>r.quality!==quality))throw Error('Fonte já usada com outra qualidade');
  // Substituir a fotografia por relatório não vazio; nunca misturar fotografias parciais.
  db.prepare('DELETE FROM regional_audience WHERE talent_id=? AND network=? AND metric=? AND source=? AND period_start=? AND period_end=?').run(account.talent_id,network,metric,source,period_start,period_end);
  const insert=db.prepare('INSERT INTO regional_audience VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(talent_id,network,metric,municipality_code,period_start,period_end,source) DO UPDATE SET value=excluded.value,report_ref=excluded.report_ref,quality=excluded.quality,collected_at=excluded.collected_at');
  for(const [code,value] of mapped)insert.run(account.talent_id,network,metric,code,period_start,period_end,value,source,report_ref,quality,new Date().toISOString());
 }
 db.prepare('INSERT INTO audience_import_runs(id,account_id,network,metric,source,quality,period_start,period_end,report_ref,authorization_ref,status,imported,unresolved,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,account_id,network,metric,source,quality,period_start,period_end,report_ref,authorization_ref,status,mapped.size,unknown.length,JSON.stringify({coverage,unresolvedCities:unknown}));
 db.exec('COMMIT');return {id,status,imported:mapped.size,unresolved:unknown};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function audienceStatus(db){return Object.keys(official).map(network=>({network,source:official[network],confirmed_accounts:db.prepare('SELECT count(*) n FROM social_accounts WHERE network=? AND identity_confirmed=1').get(network).n,records:db.prepare('SELECT count(*) n FROM regional_audience WHERE network=?').get(network).n,cities:db.prepare('SELECT count(DISTINCT municipality_code) n FROM regional_audience WHERE network=?').get(network).n,last:db.prepare('SELECT status,created_at,imported,unresolved FROM audience_import_runs WHERE network=? ORDER BY rowid DESC LIMIT 1').get(network)??null}));}
export async function fetchYouTubeReport({channel,token,start,end,fetcher=fetch}){
 if(!/^UC[\w-]{22}$/.test(channel)||!nonempty(token)||!date(start)||!date(end)||start>end||start<'2022-01-01')throw Error('Canal, período ou token inválido');
 const url=new URL('https://youtubeanalytics.googleapis.com/v2/reports');url.search=new URLSearchParams({ids:`channel==${channel}`,startDate:start,endDate:end,metrics:'views',dimensions:'city',filters:'country==BR',sort:'-views',maxResults:'250'});
 const res=await fetcher(url,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error(`YouTube Analytics HTTP ${res.status}`);
 const json=await res.json();const headers=json.columnHeaders?.map(x=>x.name);if(!headers||headers.join(',')!=='city,views'||(json.rows!==undefined&&!Array.isArray(json.rows)))throw Error('Formato inesperado do YouTube');
 return (json.rows??[]).map(([external_city,value])=>({external_city,value}));
}
