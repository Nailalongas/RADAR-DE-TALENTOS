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
const states=Object.freeze({'AC':'Acre','AL':'Alagoas','AP':'Amapá','AM':'Amazonas','BA':'Bahia','CE':'Ceará','DF':'Distrito Federal','ES':'Espírito Santo','GO':'Goiás','MA':'Maranhão','MT':'Mato Grosso','MS':'Mato Grosso do Sul','MG':'Minas Gerais','PA':'Pará','PB':'Paraíba','PR':'Paraná','PE':'Pernambuco','PI':'Piauí','RJ':'Rio de Janeiro','RN':'Rio Grande do Norte','RS':'Rio Grande do Sul','RO':'Rondônia','RR':'Roraima','SC':'Santa Catarina','SP':'São Paulo','SE':'Sergipe','TO':'Tocantins'});
const ufNames=new Map(Object.entries(states).flatMap(([code,name])=>[[normalize(code),code],[normalize(name),code]]));
function cityFinder(db){const exact=new Map(),global=new Map();for(const m of db.prepare('SELECT code,name,uf FROM municipalities').all()){const k=normalize(m.name),id=k+'|'+m.uf;exact.set(id,exact.has(id)?null:m.code);global.set(k,global.has(k)?null:m.code);}return (name,state)=>{const key=normalize(name),uf=ufNames.get(normalize(state));return uf?exact.get(key+'|'+uf):state?undefined:global.get(key)};}
const safeLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export async function ticketmaster(db,job,ctx){
 const key=secret(job.tokenEnv,ctx.env),items=[],ids=new Set();let skipped=0,truncated=false,requests=0;
 const locate=cityFinder(db),size=100,maxPages=Math.min(10,job.maxPages??10);if(!Number.isInteger(maxPages)||maxPages<1)throw Error('Limite de páginas inválido');
 const wait=ctx.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));
 async function pageData(page,uf){if(requests++)await wait(250);const url=new URL('https://app.ticketmaster.com/discovery/v2/events.json');url.search=new URLSearchParams({apikey:key,countryCode:'BR',size:String(size),page:String(page),sort:'date,asc'});if(uf)url.searchParams.set('stateCode',uf);const data=await jsonResponse(url,ctx);if(!Number.isInteger(data.page?.totalPages)||data.page.totalPages<0)throw Error('Paginação inválida');const events=data._embedded?.events??[];if(!Array.isArray(events)||(!events.length&&data.page.totalPages>page))throw Error('Página incompleta');return {data,events};}
 function add(events,partition){const pageIds=new Set();for(const e of events){if(typeof e.id!=='string'||!e.id||pageIds.has(e.id)){skipped++;continue;}pageIds.add(e.id);const v=e._embedded?.venues?.[0],rawUf=v?.state?.stateCode||v?.state?.name,uf=ufNames.get(normalize(rawUf));if(partition&&uf&&uf!==partition){truncated=true;continue;}if(ids.has(e.id))continue;ids.add(e.id);const city=locate(v?.city?.name,rawUf||partition),day=e.dates?.start?.localDate,url=safeLink(e.url);
  if(v?.country?.countryCode!=='BR'||!city||!v?.name||!validDay(day)||!e.name||!url){skipped++;continue;}
  const segment=e.classifications?.[0]?.segment?.name,genre=normalize(e.classifications?.[0]?.genre?.name),specific=classifyEvent(e.name),modality=['corridas','humor','infantil'].includes(specific)?specific:segment==='Music'?'shows':segment==='Sports'?'esportes':segment==='Arts & Theatre'?(genre==='comedy'?'humor':'teatro'):undefined;
  const genreName=({rock:'Rock',pop:'Pop',country:'Sertanejo',reggae:null,'hip hop rap':'Rap/hip-hop','dance electronic':'Eletrônico',jazz:'Jazz/blues',blues:'Jazz/blues'})[genre];const sub=modality==='shows'&&genreName&&genre!=='country'?db.prepare('SELECT id FROM submodalities WHERE modality_id=? AND name=?').get(modality,genreName)?.id:undefined;
  const status=({onsale:'listed',offsale:'unknown',canceled:'cancelled',postponed:'postponed',rescheduled:'unknown'})[e.dates?.status?.code]??'unknown';
  items.push({external_id:e.id,title:e.name,...(Array.isArray(e._embedded?.attractions)?{artists:e._embedded.attractions.filter(a=>typeof a?.name==='string'&&a.name.trim()).map(a=>({name:a.name,...(typeof a.id==='string'?{id:a.id}:{})}))}:{}),venue:v.name,municipality_code:city,event_date:day,url,status,...(modality?{modality_id:modality}:{}),...(sub?{submodality_id:sub}:{})});
 }}
 const first=await pageData(0);add(first.events);const total=first.data.page.totalPages;
 if(total>maxPages&&job.splitByState===true){for(const uf of Object.keys(states)){const firstState=await pageData(0,uf);add(firstState.events,uf);const pages=firstState.data.page.totalPages;for(let p=1;p<Math.min(maxPages,pages);p++)add((await pageData(p,uf)).events,uf);if(pages>maxPages)truncated=true;}if(!Number.isSafeInteger(first.data.page.totalElements)||ids.size<first.data.page.totalElements)truncated=true;}
 else{for(let p=1;p<Math.min(maxPages,total);p++)add((await pageData(p)).events);if(total>maxPages)truncated=true;}
 return {platform:'ticketmaster',observed_on:ctx.day,source:'Ticketmaster Discovery API / '+job.authorizationRef,items,partial:truncated||skipped>0,skipped};
}
export async function sympla(db,job,ctx){
 const key=secret(job.tokenEnv,ctx.env),items=[],ids=new Set(),cursors=new Set();let skipped=0,truncated=false,cursor;
 const locate=cityFinder(db);
 const maxPages=job.maxPages??10;if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw Error('Limite de páginas inválido');
 for(let p=0;p<maxPages;p++){
  const u=new URL('https://api.sympla.com.br/public/v1.6.0/events');u.search=new URLSearchParams({published:'published',timezone:'America/Sao_Paulo',sort:'asc',field_sort:'start_date',page_size:'100',fields:'id,name,start_date,url,address,private_event,published,cancelled,category_prim,category_sec'});if(cursor)u.searchParams.set('cursor',cursor);
  const data=await jsonResponse(u,{...ctx,headers:{s_token:key}});if(!Array.isArray(data.data)||!data.pagination)throw Error('Paginação Sympla inválida');
  for(const e of data.data){if(e.private_event!==0||e.published!==1)continue;const a=e.address,city=locate(a?.city,a?.state),day=String(e.start_date??'').slice(0,10),url=safeLink(e.url);
   if(!['string','number'].includes(typeof e.id)||ids.has(String(e.id))||!city||!['br','brasil','brazil'].includes(normalize(a?.country))||!a?.name||!e.name||!url||!validDay(day)){skipped++;continue;}ids.add(String(e.id));
   const category=normalize(e.category_prim?.name),specific=classifyEvent(e.name),modality=['corridas','humor','infantil'].includes(specific)?specific:({'shows':'shows','teatro e espetaculos':'teatro','esportes':'esportes','gastronomia':'gastronomia','cursos e workshops':'palestras','congressos e seminarios':'palestras'})[category];
   items.push({external_id:String(e.id),title:e.name,venue:a.name,municipality_code:city,event_date:day,url,status:e.cancelled===1?'cancelled':'listed',...(modality?{modality_id:modality}:{})});
  }
  cursor=data.pagination.next_cursor;if(!cursor)break;if(typeof cursor!=='string'||cursors.has(cursor))throw Error('Cursor repetido');cursors.add(cursor);if(p+1===maxPages)truncated=true;else await (ctx.sleep??(ms=>new Promise(r=>setTimeout(r,ms))))(250);
 }
 return {platform:'sympla',observed_on:ctx.day,items,partial:truncated||skipped>0,skipped};
}

export async function youtubeToken(job,ctx){
 if(!job.refreshTokenEnv)return providerToken(job,ctx);
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:secret(job.refreshTokenEnv,ctx.env),client_id:secret(job.clientIdEnv,ctx.env),client_secret:secret(job.clientSecretEnv,ctx.env)});
 const data=await jsonResponse(new URL('https://oauth2.googleapis.com/token'),{...ctx,method:'POST',body,headers:{'Content-Type':'application/x-www-form-urlencoded'}});
 if(typeof data.access_token!=='string'||!data.access_token)throw Error('Token renovado indisponível');return data.access_token;
}

export async function spotifyToken(job,ctx){
 if(!job.clientIdEnv&&!job.clientSecretEnv)return providerToken(job,ctx);
 const clientId=secret(job.clientIdEnv,ctx.env),clientSecret=secret(job.clientSecretEnv,ctx.env);
 const basic=Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
 const body=new URLSearchParams({grant_type:'client_credentials'});
 const data=await jsonResponse(new URL('https://accounts.spotify.com/api/token'),{...ctx,method:'POST',body,headers:{Authorization:`Basic ${basic}`,'Content-Type':'application/x-www-form-urlencoded'}});
 if(typeof data.access_token!=='string'||!data.access_token)throw Error('Token Spotify indisponível');
 return data.access_token;
}

// Partner Reports uses the host supplied during onboarding and a user token
// (client_credentials is not accepted by this endpoint).
export async function ingresse(db,job,ctx){
 const host=job.host;if(typeof host!=='string'||!ctx.allowedHosts.includes(host)||!/^[a-z0-9.-]+$/.test(host))throw Error('Host Ingresse não autorizado');
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(job.organizationId??''))throw Error('Organização Ingresse inválida');
 const locate=cityFinder(db);
 const maxPages=job.maxPages??10;if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw Error('Limite de páginas inválido');
 const key=await providerToken(job,ctx),items=[],ids=new Set();let skipped=0,truncated=false,seen=0;
 for(let page=1;page<=maxPages;page++){
  const u=new URL(`https://${host}/v1/reports/organizations/${job.organizationId}/events`);u.search=new URLSearchParams({page:String(page),page_size:'100'});
  const data=await jsonResponse(u,{...ctx,timeoutMs:35000,headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}});if(!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.total<0||data.page!==page||data.items.length>100)throw Error('Paginação Ingresse inválida');
  seen+=data.items.length;if(!data.items.length&&seen<data.total)throw Error('Página incompleta');
  for(const e of data.items){if(e.status!=='published')continue;const v=e.venue,city=locate(v?.city,v?.state),url=safeLink(e.link);const dates=Array.isArray(e.dates)?e.dates.map(x=>x.date).filter(validDay).sort():[];
   if(!['string','number'].includes(typeof e.id)||ids.has(String(e.id))||!city||!['br','brasil','brazil'].includes(normalize(v?.country))||!v?.street||!e.title||!url||!dates.length){skipped++;continue;}ids.add(String(e.id));
   // One public listing per event, not per session. Street is the venue field supplied by the API.
   items.push({external_id:String(e.id),title:e.title,venue:v.street,municipality_code:city,event_date:dates[0],url,status:e.sale_enabled===true?'listed':'unknown'});
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

function getConfirmedAccount(db,accountId,network){
 const a=db.prepare('SELECT a.id,a.talent_id,a.network,a.external_id,a.url,a.identity_confirmed,a.identity_source,t.name,t.blocked FROM social_accounts a JOIN talents t ON t.id=a.talent_id WHERE a.id=?').get(accountId);
 if(!a||a.network!==network||!a.identity_confirmed||a.blocked||typeof a.external_id!=='string'||!a.external_id.trim()){
  throw Error(`Conta ${network} não confirmada ou sem identificador externo`);
 }
 return {...a,external_id:a.external_id.trim()};
}

export async function instagramMetrics(db,job,ctx){
 const account=getConfirmedAccount(db,job.accountId,'Instagram');
 const token=await providerToken(job,ctx);
 const collectedAt=(ctx.now??new Date()).toISOString();
 const source=`Instagram Graph API / ${job.authorizationRef}`;
 let profile;
 if(job.businessAccountId){
  if(!/^[0-9]{4,40}$/.test(job.businessAccountId)||!/^[a-zA-Z0-9._]{1,60}$/.test(account.external_id)){
   throw Error('Identificador Instagram inválido');
  }
  const url=new URL(`https://graph.facebook.com/v21.0/${job.businessAccountId}`);
  url.search=new URLSearchParams({fields:`business_discovery.username(${account.external_id}){username,followers_count,media_count}`});
  const data=await jsonResponse(url,{...ctx,headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
  profile=data?.business_discovery;
  if(!profile||normalize(profile.username)!==normalize(account.external_id)){
   throw Error('Identidade retornada pelo Instagram não corresponde à conta confirmada');
  }
 }else{
  if(!/^[a-zA-Z0-9._-]{1,60}$/.test(account.external_id))throw Error('Identificador Instagram inválido');
  const url=new URL(`https://graph.facebook.com/v21.0/${account.external_id}`);
  url.search=new URLSearchParams({fields:'id,username,followers_count,media_count'});
  profile=await jsonResponse(url,{...ctx,headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
 }
 const followers=profile?.followers_count;
 if(!Number.isSafeInteger(followers)||followers<0)throw Error('Métrica de seguidores Instagram indisponível');
 const rows=[{account_id:account.id,network:'Instagram',metric:'followers',observed_on:ctx.day,value:followers,source,collected_at:collectedAt,intraday:true}];
 return {network:'Instagram',account_id:account.id,observed_on:ctx.day,collected_at:collectedAt,intraday:true,rows};
}

export async function youtubeMetrics(db,job,ctx){
 const account=getConfirmedAccount(db,job.accountId,'YouTube');
 if(!/^[a-zA-Z0-9_-]{4,60}$/.test(account.external_id))throw Error('Identificador de canal YouTube inválido');
 const token=await youtubeToken(job,ctx);
 const collectedAt=(ctx.now??new Date()).toISOString();
 const source=`YouTube Data API v3 / ${job.authorizationRef}`;
 const url=new URL('https://www.googleapis.com/youtube/v3/channels');
 url.search=new URLSearchParams({part:'statistics',id:account.external_id});
 const data=await jsonResponse(url,{...ctx,headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
 const item=Array.isArray(data?.items)?data.items.find(x=>x?.id===account.external_id):null;
 const stats=item?.statistics;
 if(!stats||stats.hiddenSubscriberCount===true)throw Error('Inscritos ocultos ou canal YouTube não localizado');
 const subscribers=Number(stats.subscriberCount);
 if(!Number.isSafeInteger(subscribers)||subscribers<0)throw Error('Métrica de inscritos YouTube inválida');
 const rows=[{account_id:account.id,network:'YouTube',metric:'subscribers',observed_on:ctx.day,value:subscribers,source,collected_at:collectedAt,intraday:true}];
 return {network:'YouTube',account_id:account.id,observed_on:ctx.day,collected_at:collectedAt,intraday:true,rows};
}

export async function spotifyMetrics(db,job,ctx){
 const account=getConfirmedAccount(db,job.accountId,'Spotify');
 if(!/^[a-zA-Z0-9]{10,50}$/.test(account.external_id))throw Error('Identificador de artista Spotify inválido');
 const token=await spotifyToken(job,ctx);
 const collectedAt=(ctx.now??new Date()).toISOString();
 const source=`Spotify Web API / ${job.authorizationRef}`;
 const url=new URL(`https://api.spotify.com/v1/artists/${account.external_id}`);
 const data=await jsonResponse(url,{...ctx,headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
 if(data?.id!==account.external_id)throw Error('Artista retornado pelo Spotify não corresponde à conta confirmada');
 const followers=data?.followers?.total;
 if(!Number.isSafeInteger(followers)||followers<0)throw Error('Métrica de seguidores Spotify inválida');
 const rows=[{account_id:account.id,network:'Spotify',metric:'followers',observed_on:ctx.day,value:followers,source,collected_at:collectedAt,intraday:true}];
 return {network:'Spotify',account_id:account.id,observed_on:ctx.day,collected_at:collectedAt,intraday:true,rows};
}
