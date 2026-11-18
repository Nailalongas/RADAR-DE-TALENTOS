import {importCommercial} from './commercial.mjs';
import {importRegionalReport} from './regional-dashboard.mjs';
import {importNationalMetrics} from './registry.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {importEvents} from './events.mjs';
import {importAudience,fetchYouTubeReport} from './audience.mjs';
import {opportunityQuery} from './opportunities.mjs';
import {platforms,loadFeed,ticketmaster,sympla,ingresse,youtubeToken} from './connectors.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const localDay=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const localClock=d=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
const scopeFor=j=>j.adapter==='ticketmaster'?'Discovery Brasil / páginas retornadas':j.adapter==='sympla'?'Eventos públicos do produtor autorizado':j.adapter==='ingresse'?'Eventos públicos da organização autorizada':j.adapter==='youtube'?'Canal autorizado / relatório por cidade':j.kind==='alerts'?'Alertas internos dos recortes configurados':j.scope??'Feed autorizado / escopo não informado';
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x);
export function validateConfig(c){
 if(!c||!Array.isArray(c.jobs)||c.jobs.length>100||!Array.isArray(c.allowedHosts??[]))throw Error('Configuração inválida');if((c.allowedHosts??[]).some(h=>typeof h!=='string'||!/^([a-z0-9-]+\.)+[a-z0-9-]+$/.test(h)))throw Error('Host autorizado inválido');const seen=new Set();
 for(const j of c.jobs){if(!safeId(j.id)||seen.has(j.id)||typeof j.enabled!=='boolean'||!['events','audience','metrics','alerts'].includes(j.kind))throw Error('Job inválido');seen.add(j.id);
  if(j.runAfter!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(j.runAfter)||j.maxAttempts!==undefined&&(!Number.isInteger(j.maxAttempts)||j.maxAttempts<1||j.maxAttempts>6)||j.retryMinutes!==undefined&&(!Number.isInteger(j.retryMinutes)||j.retryMinutes<15||j.retryMinutes>360))throw Error('Agendamento inválido');
  if(j.scope!==undefined&&(typeof j.scope!=='string'||j.scope.length>300))throw Error('Escopo inválido');
  if(j.kind==='events'&&!platforms.includes(j.provider)||j.kind==='audience'&&!['YouTube','Instagram','Spotify','TikTok'].includes(j.provider)||j.kind==='metrics'&&!['YouTube','Instagram','Spotify',...(j.commercial===true?['TikTok']:[])].includes(j.provider)||j.kind==='alerts'&&j.provider!=='radar')throw Error('Provedor inválido');
  if(j.kind==='alerts'){if(j.adapter!=='internal'||!Array.isArray(j.queries??[])||(j.queries??[]).length>30||(j.queries??[]).some(q=>!q||typeof q!=='object'||Array.isArray(q)||Object.values(q).some(v=>typeof v!=='string'||v.length>500)))throw Error('Consultas de alerta inválidas');continue;}
  if(!['file','https','ticketmaster','sympla','ingresse','youtube'].includes(j.adapter)||j.adapter==='ticketmaster'&&(j.kind!=='events'||j.provider!=='ticketmaster')||j.adapter==='sympla'&&(j.kind!=='events'||j.provider!=='sympla')||j.adapter==='ingresse'&&(j.kind!=='events'||j.provider!=='ingresse')||j.adapter==='youtube'&&(j.kind!=='audience'||j.provider!=='YouTube'))throw Error('Adaptador inválido');
  if(j.commercial===true&&(j.kind!=='metrics'||!['file','https'].includes(j.adapter)))throw Error('Feed comercial inválido');
  if(j.enabled){
   if(typeof j.authorizationRef!=='string'||!j.authorizationRef.trim()||j.authorizationRef.length>300)throw Error('Referência de autorização obrigatória');
   if(['audience','metrics'].includes(j.kind)&&j.commercial!==true&&j.provider!=='TikTok'&&(typeof j.accountId!=='string'||!j.accountId.trim()))throw Error('Conta obrigatória');
   if(j.kind==='audience'&&j.provider==='TikTok'&&(!['file','https'].includes(j.adapter)||typeof j.talentId!=='string'||!j.talentId.trim()))throw Error('Talento e feed autorizados obrigatórios para TikTok');
   if(['file','https'].includes(j.adapter)&&(typeof j.scope!=='string'||!j.scope.trim()))throw Error('Declare o escopo autorizado da fonte');
   if(j.adapter==='file'&&(typeof j.file!=='string'||!j.file.trim()))throw Error('Arquivo obrigatório');
   if(j.adapter==='https'){const u=new URL(j.url);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!(c.allowedHosts??[]).includes(u.hostname))throw Error('Feed HTTPS não autorizado');}
   if(j.adapter==='ingresse'&&(!(c.allowedHosts??[]).includes(j.host)||!j.organizationId))throw Error('Host ou organização Ingresse ausente');
   if(j.splitByState!==undefined&&typeof j.splitByState!=='boolean')throw Error('Particionamento inválido');
   if(j.maxPages!==undefined&&(!Number.isInteger(j.maxPages)||j.maxPages<1||j.maxPages>20))throw Error('Limite de páginas inválido');
   if(['ticketmaster','sympla'].includes(j.adapter)&&!j.tokenEnv||j.adapter==='ingresse'&&!j.tokenEnv&&!j.tokenFile||j.adapter==='youtube'&&!j.tokenEnv&&!j.refreshTokenEnv)throw Error('Referência de credencial obrigatória');
   if(j.adapter==='youtube'&&j.refreshTokenEnv&&(!j.clientIdEnv||!j.clientSecretEnv))throw Error('Referências OAuth obrigatórias');
  }
 }
 return c;
}
function register(db,c,now){db.exec('BEGIN IMMEDIATE');try{db.exec('UPDATE operation_jobs SET enabled=0');const s=db.prepare('INSERT INTO operation_jobs(id,kind,provider,adapter,scope,config_hash,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET adapter=excluded.adapter,scope=excluded.scope,config_hash=excluded.config_hash,enabled=excluded.enabled,updated_at=excluded.updated_at');for(const j of c.jobs){const old=db.prepare('SELECT kind,provider FROM operation_jobs WHERE id=?').get(j.id);if(old&&(old.kind!==j.kind||old.provider!==j.provider))throw Error('ID já vinculado a outro provedor');s.run(j.id,j.kind,j.provider,j.adapter,scopeFor(j),hash(j),+j.enabled,now);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
function claim(db,j,day,now,refreshAlert=false){const ts=now.toISOString(),lease=new Date(+now+60*60000).toISOString();db.exec('BEGIN IMMEDIATE');try{
 // Running imports must never overlap, even if a second scheduler is started.
 const active=db.prepare("SELECT 1 FROM operation_runs WHERE job_id=? AND state='running' AND lease_until>?").get(j.id,ts);if(active){db.exec('COMMIT');return null;}
 db.prepare("UPDATE operation_runs SET state='failed',finished_at=?,summary='Execução interrompida; lease expirou' WHERE job_id=? AND state='running' AND lease_until<=?").run(ts,j.id,ts);
 if(db.prepare("SELECT 1 FROM operation_runs WHERE job_id=? AND config_hash=? AND retry_not_before>?").get(j.id,hash(j),ts)){db.exec('COMMIT');return null;}
 const lastAny=db.prepare('SELECT attempt FROM operation_runs WHERE job_id=? AND day=? ORDER BY attempt DESC LIMIT 1').get(j.id,day);
 const last=db.prepare('SELECT * FROM operation_runs WHERE job_id=? AND day=? AND config_hash=? ORDER BY attempt DESC LIMIT 1').get(j.id,day,hash(j));const attempts=db.prepare('SELECT count(*) n FROM operation_runs WHERE job_id=? AND day=? AND config_hash=?').get(j.id,day,hash(j)).n;
 if(last&&!(refreshAlert&&j.kind==='alerts'&&last.state==='success')&&(last.state!=='failed'||attempts>=(j.maxAttempts??3)||Date.parse(last.finished_at)+(j.retryMinutes??15)*60000>+now)){db.exec('COMMIT');return null;}
 const id=randomUUID();db.prepare('INSERT INTO operation_runs(id,job_id,config_hash,day,attempt,state,started_at,lease_until) VALUES(?,?,?,?,?,\'running\',?,?)').run(id,j.id,hash(j),day,(lastAny?.attempt??0)+1,ts,lease);db.exec('COMMIT');return id;
 }catch(e){db.exec('ROLLBACK');throw e;}}
function assertLease(db,id){if(!db.prepare("SELECT 1 FROM operation_runs WHERE id=? AND state='running' AND lease_until>?").get(id,new Date().toISOString()))throw Error('Lease expirado');}
function finish(db,id,state,records,summary,fingerprint=null,retryNotBefore=null){db.prepare("UPDATE operation_runs SET state=?,records=?,summary=?,finished_at=?,fingerprint=?,retry_not_before=? WHERE id=? AND state='running'").run(state,records,summary,new Date().toISOString(),fingerprint,retryNotBefore,id);}
function alert(db,day,kind,subject,message,details={}){return Number(db.prepare('INSERT OR IGNORE INTO operation_alerts VALUES(?,?,?,?,?,?,?)').run(hash([day,kind,subject]),day,kind,subject,message,JSON.stringify(details),new Date().toISOString()).changes);}
function generateAlerts(db,j,day){let count=0;
 // Compare two seven-day windows only after a baseline day and with a stable successful job daily.
 for(const p of platforms){const jobs=db.prepare("SELECT * FROM operation_jobs WHERE kind='events' AND provider=? AND enabled=1").all(p);if(jobs.length!==1)continue;const source=jobs[0];const days=db.prepare("SELECT count(DISTINCT day) n FROM operation_runs WHERE job_id=? AND config_hash=? AND day BETWEEN ? AND ? AND state IN ('success','empty')").get(source.id,source.config_hash,shift(day,-14),day).n;if(days!==15)continue;
 const rows=db.prepare(`SELECT e.modality_id,min(o.day) first_seen FROM operation_event_observations o JOIN events e ON e.id=o.event_id WHERE o.job_id=? AND o.config_hash=? GROUP BY e.id`).all(source.id,source.config_hash);
 const counts=new Map();for(const r of rows){if(r.first_seen<shift(day,-13)||r.first_seen>day)continue;const a=counts.get(r.modality_id)??[0,0];a[r.first_seen>=shift(day,-6)?1:0]++;counts.set(r.modality_id,a);}
 for(const [m,[before,after]] of counts){if((before>=5&&after>=before*1.3&&after-before>=5)||(before<5&&after>=10)){count+=alert(db,day,'trend',p+':'+m,before<5?'Categoria emergente na fonte selecionada':'Aumento de eventos observados na fonte selecionada',{platform:p,modality:m,before,after,windowDays:7,scope:source.scope,notice:'primeira detecção, não vendas; cobertura restrita à fonte'});}}
 }
 for(const [i,q] of (j.queries??[]).entries()){try{const result=opportunityQuery(db,new URLSearchParams(Object.fromEntries(Object.entries(q).map(([k,v])=>[k,typeof v==='string'&&/^today(?:-\d{1,3})?$/.test(v)?shift(day,-Number(v.split('-')[1]??0)):v]))));for(const r of result.rows.filter(r=>r.score!==null&&r.score>=80).slice(0,10)){count+=alert(db,day,'opportunity',j.id+':'+i+':'+r.code,'Praça com índice exploratório elevado',{city:r.name,code:r.code,score:r.score,modality:result.modality,query:q,notice:result.notice});}}catch{alert(db,day,'configuration',j.id+':'+i,'Consulta de oportunidade inválida ou indisponível');}}
 return count;
}
export async function runOperations(db,config,options={}){
 validateConfig(config);const now=options.now??new Date(),day=localDay(now);register(db,config,now.toISOString());const ctx={inbox:options.inbox??'data/inbox',secretsDir:options.secretsDir??'data/secrets',allowedHosts:config.allowedHosts??[],env:options.env??process.env,day,fetcher:options.fetcher??fetch,sleep:options.sleep};const result=[];
 for(const j of [...config.jobs].sort((a,b)=>(a.kind==='alerts')-(b.kind==='alerts'))){if(!j.enabled||!options.ignoreSchedule&&localClock(options.now??new Date())<(j.runAfter??'00:00'))continue;const changed=result.some(x=>['success','partial','empty'].includes(x.state));const id=claim(db,j,day,options.now??new Date(),changed);if(!id)continue;
 try{let state='success',records=0,summary='',fingerprint=null;
  if(j.kind==='alerts'){assertLease(db,id);records=generateAlerts(db,j,day);}
  else if(j.kind==='events'){
   const batch=j.adapter==='ticketmaster'?await ticketmaster(db,j,ctx):j.adapter==='sympla'?await sympla(db,j,ctx):j.adapter==='ingresse'?await ingresse(db,j,ctx):await loadFeed(j,ctx);if(batch.platform!==j.provider||batch.observed_on!==day||!Array.isArray(batch.items)||batch.items.length>50000)throw Error('Lote incompatível ou desatualizado');
   state=batch.partial!==false||Number(batch.skipped??0)>0?'partial':batch.items.length?'success':'empty';summary=`${batch.items.length} anúncios; ${Number.isSafeInteger(batch.skipped)?batch.skipped:0} não resolvidos`;
   records=importEvents(db,{...batch,source:'Automação '+j.id+' / '+j.authorizationRef},(n,meta)=>{
    if(meta.conflicts){state='partial';summary+=`; ${meta.conflicts} alterações em revisão`;}
    assertLease(db,id);const observation=db.prepare('INSERT OR IGNORE INTO operation_event_observations SELECT ?,?,event_id,? FROM event_listings WHERE platform_id=? AND external_id=?');for(const external of meta.accepted)observation.run(j.id,hash(j),day,j.provider,external);
    finish(db,id,state,n,summary); // importação e estado da tarefa são atômicos
   },{tolerateConflicts:true}); // nunca declarar cobertura municipal automaticamente
  }else if(j.kind==='metrics'){
   const batch=await loadFeed(j,ctx);if(j.commercial===true){fingerprint=hash(batch);records=importCommercial(db,{...batch,authorization_ref:j.authorizationRef},{network:j.provider,day},n=>{assertLease(db,id);state=n?'success':'unchanged';summary=`${n} observações comerciais`;finish(db,id,state,n,summary,fingerprint);});}else{if(batch.network!==j.provider||batch.account_id!==j.accountId||!Array.isArray(batch.rows)||batch.rows.length>50000)throw Error('Métricas incompatíveis');
   fingerprint=hash(batch);records=importNationalMetrics(db,batch.rows,{accountId:j.accountId,network:j.provider,day},n=>{assertLease(db,id);state=n?'success':batch.rows.length?'unchanged':'empty';summary=`${n} novas fotografias nacionais`;finish(db,id,state,n,summary,fingerprint);});}
  }else{
   let report;if(j.adapter==='youtube'){
    const a=db.prepare("SELECT external_id FROM social_accounts WHERE id=? AND network='YouTube' AND identity_confirmed=1").get(j.accountId);if(!a?.external_id)throw Error('Conta YouTube não confirmada');const end=shift(day,-3),start=shift(end,-29);const rows=await fetchYouTubeReport({channel:a.external_id,token:await youtubeToken(j,ctx),start,end,fetcher:ctx.fetcher});report={account_id:j.accountId,network:'YouTube',metric:'views',quality:'verified',period_start:start,period_end:end,report_ref:`youtube:${j.accountId}:${start}:${end}`,coverage:'partial',rows};
   }else report=await loadFeed(j,ctx);
   if(report.network!==j.provider||(j.provider==='TikTok'?report.talent_id!==j.talentId:report.account_id!==j.accountId)||!Array.isArray(report.rows)||report.rows.length>50000||report.period_end>day)throw Error('Relatório incompatível');
   fingerprint=hash(report);const previous=db.prepare("SELECT 1 FROM operation_runs WHERE job_id=? AND config_hash=? AND fingerprint=? AND state IN ('success','partial','unchanged')").get(j.id,hash(j),fingerprint);
   assertLease(db,id);if(previous){state='unchanged';summary='Relatório já importado';}else{const imported=j.provider==='TikTok'?importRegionalReport(db,{...report,authorization_ref:j.authorizationRef}):importAudience(db,{...report,authorization_ref:j.authorizationRef});state=imported.status??'partial';records=imported.imported;summary=`${records} municípios; ${imported.unresolved?.length??0} não resolvidos`;}
  }
  if(!['events','metrics'].includes(j.kind))finish(db,id,state,records,summary,fingerprint);result.push({job:j.id,state,records});
 }catch(error){ // Never expose tokens, upstream URL, personal data or raw exception strings in the dashboard.
  const message=String(error?.message??''),code=/^HTTP (\d{3})/.exec(message)?.[1];const reason=code?'HTTP '+code:message==='Credencial não configurada'?'Credencial não configurada':message==='Lote incompatível ou desatualizado'?'Lote incompatível ou desatualizado':message.startsWith('Identidade alterada:')?'Identidade ou data do anúncio mudou: revisar antes de reimportar':message.startsWith('Município desconhecido:')?'Município não localizado na base geográfica':message.startsWith('Paginação')?'Resposta de paginação inesperada':'Falha de coleta/validação; verificar configuração e fonte';const retry=Number.isFinite(error?.retryAfterMs)&&error.retryAfterMs>0?new Date(Date.now()+Math.min(error.retryAfterMs,365*86400000)).toISOString():null;finish(db,id,'failed',0,reason,null,retry);alert(db,day,'collection',j.id,'Falha de coleta; verificar configuração e fonte');result.push({job:j.id,state:'failed'});
 }}return result;
}
export function operationsStatus(db){
 const day=localDay(),jobs=db.prepare(`SELECT j.id,j.kind,j.provider,j.adapter,j.scope,j.enabled,j.updated_at,CASE WHEN j.config_hash=r.config_hash THEN 0 ELSE 1 END config_changed,r.state,r.day,r.attempt,r.records,r.summary,r.finished_at,r.lease_until,r.retry_not_before FROM operation_jobs j LEFT JOIN operation_runs r ON r.id=(SELECT id FROM operation_runs WHERE job_id=j.id ORDER BY day DESC,attempt DESC LIMIT 1) ORDER BY j.kind,j.provider`).all().map(r=>({...r,stale:!!r.enabled&&(r.day!==day||r.config_changed||(r.state==='running'&&r.lease_until<=new Date().toISOString()))}));
 const heartbeat=db.prepare('SELECT max(updated_at) ts FROM operation_jobs').get().ts;
 return {day,heartbeat,workerRecent:!!heartbeat&&Date.now()-Date.parse(heartbeat)<5*60000,jobs,platforms:db.prepare('SELECT p.id,p.name,count(j.id) configured,sum(CASE WHEN j.enabled=1 THEN 1 ELSE 0 END) enabled FROM ticket_platforms p LEFT JOIN operation_jobs j ON j.provider=p.id AND j.kind=\'events\' GROUP BY p.id ORDER BY p.name').all(),history:db.prepare('SELECT job_id,day,attempt,state,records,summary,started_at,finished_at,retry_not_before FROM operation_runs ORDER BY started_at DESC LIMIT 50').all(),alerts:db.prepare('SELECT day,kind,subject,message,details FROM operation_alerts ORDER BY day DESC,created_at DESC LIMIT 100').all().map(r=>({...r,details:JSON.parse(r.details)})),notice:'Fontes sem configuração não são coletadas; uma execução bem-sucedida não certifica cobertura nacional.'};
}
