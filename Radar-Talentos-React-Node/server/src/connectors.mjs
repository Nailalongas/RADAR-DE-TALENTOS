import {classifyEvent} from './events.mjs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
export const platforms=['sympla','eventim','ticketmaster','ingresse','ticketsports','ticket360','blueticket','diskingressos','bilheteriadigital','uhuu'];
const MAX=20*1024*1024;
export const normalize=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function secret(name,env=process.env){if(!/^[A-Z][A-Z0-9_]{2,100}$/.test(name??'')||!env[name])throw Error('Credencial não configurada');return env[name];}
export async function jsonResponse(url,{fetcher=fetch,headers={},method='GET',body,timeoutMs=20000,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let i=0;i<3;i++){
  let res;try{res=await fetcher(url,{headers,method,body,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});}catch{if(i===2)throw Error('Falha de transporte');await sleep(1000*2**i);continue;}
  if(res.status===429||res.status>=500){const raw=res.headers.get('retry-after');const seconds=raw===null?null:Number(raw);const delay=raw===null?1000*2**i:Number.isFinite(seconds)?seconds*1000:Date.parse(raw)-Date.now();await res.body?.cancel();if(i===2||delay>30000){const error=Error(`HTTP ${res.status}; nova tentativa pelo agendador`);if(raw!==null&&Number.isFinite(delay)&&delay>0)error.retryAfterMs=delay;throw error;}await sleep(Math.max(1000,Number.isFinite(delay)?delay:1000));continue;}
  if(!res.ok){await res.body?.cancel();throw Error(`HTTP ${res.status}`)}
  if(Number(res.headers.get('content-length'))>MAX){await res.body?.cancel();throw Error('Resposta excede limite');}
  const reader=res.body?.getReader();if(!reader)throw Error('Resposta sem corpo');const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX)throw Error('Resposta excede limite');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('JSON inválido');}
 }
}
export async function loadFeed(job,ctx){
 if(job.adapter==='file'){
  const root=resolve(ctx.inbox),file=resolve(root,job.file??''),rel=relative(root,file);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Arquivo fora da caixa de entrada');
  // A caixa de entrada é administrada localmente; rejeitar symlinks de saída.
  const {realpath}=await import('node:fs/promises');const actual=relative(await realpath(root),await realpath(file));if(actual.startsWith('..')||isAbsolute(actual))throw Error('Arquivo fora da caixa de entrada');
  if((await stat(file)).size>MAX)throw Error('Arquivo excede limite');return JSON.parse(await readFile(file,'utf8'));
 }
 const url=new URL(job.url);if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!ctx.allowedHosts.includes(url.hostname))throw Error('Feed HTTPS não autorizado');
 return jsonResponse(url,{...ctx,headers:job.tokenEnv?{Authorization:`Bearer ${secret(job.tokenEnv,ctx.env)}`}:{}});
}
export async function ticketmaster(db,job,ctx){
 const key=secret(job.tokenEnv,ctx.env),items=[],ids=new Set();let skipped=0,truncated=false;
 const municipalities=db.prepare('SELECT code,name,uf FROM municipalities').all();const cities=new Map();for(const m of municipalities){const k=normalize(m.name)+'|'+m.uf;cities.set(k,cities.has(k)?null:m.code);}
 const size=100,maxPages=Math.min(10,job.maxPages??10);if(!Number.isInteger(maxPages)||maxPages<1)throw Error('Limite de páginas inválido');
 for(let page=0;page<maxPages;page++){
  const url=new URL('https://app.ticketmaster.com/discovery/v2/events.json');url.search=new URLSearchParams({apikey:key,countryCode:'BR',size:String(size),page:String(page),sort:'date,asc'});
  const data=await jsonResponse(url,ctx);if(!Number.isInteger(data.page?.totalPages)||data.page.totalPages<0)throw Error('Paginação inválida');const events=data._embedded?.events??[];if(!Array.isArray(events)||(!events.length&&data.page.totalPages>page))throw Error('Página incompleta');
  for(const e of events){if(typeof e.id!=='string'||ids.has(e.id)){skipped++;continue;}ids.add(e.id);const v=e._embedded?.venues?.[0],uf=v?.state?.stateCode?.toUpperCase();const city=cities.get(normalize(v?.city?.name)+'|'+uf);const day=e.dates?.start?.localDate;
   if(v?.country?.countryCode!=='BR'||!city||!v?.name||!day||!e.name||!e.url){skipped++;continue;}
   const segment=e.classifications?.[0]?.segment?.name;const genre=normalize(e.classifications?.[0]?.genre?.name);const specific=classifyEvent(e.name);const modality=['corridas','humor','infantil'].includes(specific)?specific:segment==='Music'?'shows':segment==='Sports'?'esportes':segment==='Arts & Theatre'?(genre==='comedy'?'humor':'teatro'):undefined;
   const status=({onsale:'listed',offsale:'unknown',canceled:'cancelled',postponed:'postponed',rescheduled:'unknown'})[e.dates?.status?.code]??'unknown';
   items.push({external_id:e.id,title:e.name,venue:v.name,municipality_code:city,event_date:day,url:e.url,status,...(modality?{modality_id:modality}:{})});
  }
  if(page+1>=data.page.totalPages)break;if(page+1===maxPages)truncated=true;else await (ctx.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))(250);
 }
 return {platform:'ticketmaster',observed_on:ctx.day,source:'Ticketmaster Discovery API / '+job.authorizationRef,items,partial:truncated||skipped>0,skipped};
}
export async function sympla(db,job,ctx){
 const key=secret(job.tokenEnv,ctx.env),items=[],ids=new Set(),cursors=new Set();let skipped=0,truncated=false,cursor;
 const cities=new Map();for(const m of db.prepare('SELECT code,name,uf FROM municipalities').all()){const k=normalize(m.name)+'|'+m.uf;cities.set(k,cities.has(k)?null:m.code);}
 const maxPages=job.maxPages??10;if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw Error('Limite de páginas inválido');
 for(let p=0;p<maxPages;p++){
  const u=new URL('https://api.sympla.com.br/public/v1.6.0/events');u.search=new URLSearchParams({published:'published',timezone:'America/Sao_Paulo',sort:'asc',field_sort:'start_date',page_size:'100',fields:'id,name,start_date,url,address,private_event,published,cancelled,category_prim,category_sec'});if(cursor)u.searchParams.set('cursor',cursor);
  const data=await jsonResponse(u,{...ctx,headers:{s_token:key}});if(!Array.isArray(data.data)||!data.pagination)throw Error('Paginação Sympla inválida');
  for(const e of data.data){if(e.private_event!==0||e.published!==1)continue;const a=e.address,city=cities.get(normalize(a?.city)+'|'+String(a?.state??'').toUpperCase().trim());
   if(typeof e.id!=='string'||ids.has(e.id)||!city||!['br','brasil','brazil'].includes(normalize(a?.country))||!a?.name||!e.name||!e.url||!e.start_date){skipped++;continue;}ids.add(e.id);
   const category=normalize(e.category_prim?.name),specific=classifyEvent(e.name),modality=['corridas','humor','infantil'].includes(specific)?specific:({'shows':'shows','teatro e espetaculos':'teatro','esportes':'esportes','gastronomia':'gastronomia','cursos e workshops':'palestras','congressos e seminarios':'palestras'})[category];
   items.push({external_id:e.id,title:e.name,venue:a.name,municipality_code:city,event_date:String(e.start_date).slice(0,10),url:e.url,status:e.cancelled===1?'cancelled':'listed',...(modality?{modality_id:modality}:{})});
  }
  cursor=data.pagination.next_cursor;if(!cursor)break;if(typeof cursor!=='string'||cursors.has(cursor))throw Error('Cursor repetido');cursors.add(cursor);if(p+1===maxPages)truncated=true;else await (ctx.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))(250);
 }
 return {platform:'sympla',observed_on:ctx.day,items,partial:truncated||skipped>0,skipped};
}

export async function youtubeToken(job,ctx){
 if(!job.refreshTokenEnv)return secret(job.tokenEnv,ctx.env);
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:secret(job.refreshTokenEnv,ctx.env),client_id:secret(job.clientIdEnv,ctx.env),client_secret:secret(job.clientSecretEnv,ctx.env)});
 const data=await jsonResponse(new URL('https://oauth2.googleapis.com/token'),{...ctx,method:'POST',body,headers:{'Content-Type':'application/x-www-form-urlencoded'}});
 if(typeof data.access_token!=='string'||!data.access_token)throw Error('Token renovado indisponível');return data.access_token;
}
// Partner Reports uses the host supplied during onboarding and a user token
// (client_credentials is not accepted by this endpoint).
export async function ingresse(db,job,ctx){
 const host=job.host;if(typeof host!=='string'||!ctx.allowedHosts.includes(host)||!/^[a-z0-9.-]+$/.test(host))throw Error('Host Ingresse não autorizado');
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(job.organizationId??''))throw Error('Organização Ingresse inválida');
 const cities=new Map();for(const m of db.prepare('SELECT code,name,uf FROM municipalities').all()){const k=normalize(m.name)+'|'+m.uf;cities.set(k,cities.has(k)?null:m.code);}
 const maxPages=job.maxPages??10;if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw Error('Limite de páginas inválido');
 const key=await providerToken(job,ctx),items=[],ids=new Set();let skipped=0,truncated=false,seen=0;
 for(let page=1;page<=maxPages;page++){
  const u=new URL(`https://${host}/v1/reports/organizations/${job.organizationId}/events`);u.search=new URLSearchParams({page:String(page),page_size:'100'});
  const data=await jsonResponse(u,{...ctx,timeoutMs:35000,headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.total<0||data.page!==page||data.items.length>100)throw Error('Paginação Ingresse inválida');
  seen+=data.items.length;if(!data.items.length&&seen<data.total)throw Error('Página incompleta');
  for(const e of data.items){if(e.status!=='published')continue;const v=e.venue,city=cities.get(normalize(v?.city)+'|'+String(v?.state??'').toUpperCase().trim());const dates=Array.isArray(e.dates)?e.dates.map(x=>x.date).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort():[];
   if(typeof e.id!=='string'||ids.has(e.id)||!city||!['br','brasil','brazil'].includes(normalize(v?.country))||!v?.street||!e.title||!e.link||!dates.length){skipped++;continue;}ids.add(e.id);
   // One public listing per event, not per session. Street is the venue field supplied by the API.
   items.push({external_id:e.id,title:e.title,venue:v.street,municipality_code:city,event_date:dates[0],url:e.link,status:e.sale_enabled===true?'listed':'unknown'});
  }
  if(seen>=data.total)break;if(page===maxPages)truncated=true;else await (ctx.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))(250);
 }
 return {platform:'ingresse',observed_on:ctx.day,items,partial:truncated||skipped>0,skipped};
}
export async function providerToken(job,ctx){
 if(!job.tokenFile)return secret(job.tokenEnv,ctx.env);
 const {realpath}=await import('node:fs/promises'),root=await realpath(ctx.secretsDir??'data/secrets'),file=await realpath(resolve(root,job.tokenFile)),rel=relative(root,file);if(!rel||rel.startsWith('..')||isAbsolute(rel)||(await stat(file)).size>16384)throw Error('Arquivo de credencial inválido');
 const token=(await readFile(file,'utf8')).trim();if(!token||/[\r\n]/.test(token))throw Error('Credencial não configurada');return token;
}
