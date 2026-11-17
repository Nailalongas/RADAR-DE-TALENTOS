// Public artist pages only: no private endpoints, tokens, proxies or paid fallback.
const SPOTIFY_PUBLIC_HOURLY_LIMIT=50,SPOTIFY_PUBLIC_DAILY_LIMIT=24*SPOTIFY_PUBLIC_HOURLY_LIMIT;
function spotifyHourlyRemaining(attempts,now=new Date()){
 const hour=now.toISOString().slice(0,13);
 return Math.max(0,SPOTIFY_PUBLIC_HOURLY_LIMIT-attempts.filter(a=>String(a.attemptedAt||'').startsWith(hour)).length);
}
const spotifyPublicName=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const spotifyPublicQueueName=v=>String(v||'').trim().replace(/\s*[-–|]?\s*(?:VEVO|Oficial|Official|-\s*Topic)$/i,'').trim();
function spotifyPublicDailySummary(date,attempts){
 const resolved=new Set(attempts.filter(a=>a.outcome==='collected').map(a=>spotifyPublicName(spotifyPublicQueueName(a.name)))),latest=new Map();
 for(const attempt of attempts)latest.set(spotifyPublicName(spotifyPublicQueueName(attempt.name)),attempt);
 const outstanding=[...latest].filter(([key,a])=>a.outcome!=='collected'&&!resolved.has(key)).map(([,a])=>({name:a.name,reason:a.reason||'Consulta sem conclusão confirmada.'})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 const excludedProfiles=outstanding.filter(a=>spotifyQueueExclusion(a.name)).map(a=>({...a,...spotifyQueueExclusion(a.name)}));
 const readyProfiles=outstanding.filter(a=>!spotifyQueueExclusion(a.name)&&spotifyReviewedIdentity(a.name)).map(a=>{const identity=spotifyReviewedIdentity(a.name);return {name:a.name,url:'https://open.spotify.com/artist/'+identity.artistId,sources:identity.sources,status:'Link verificado; aguarda coleta na próxima rodada.'};});
 const pendingProfiles=outstanding.filter(a=>!spotifyQueueExclusion(a.name)&&!spotifyReviewedIdentity(a.name));
 return {date,attempted:attempts.length,collected:new Set(attempts.filter(a=>a.outcome==='collected').map(a=>a.artistId)).size,failedAttempts:attempts.filter(a=>a.outcome!=='collected').length,pending:pendingProfiles.length,pendingProfiles,readyForCollection:readyProfiles.length,readyProfiles,excludedFromQueue:excludedProfiles.length,excludedProfiles,remaining:Math.max(0,SPOTIFY_PUBLIC_DAILY_LIMIT-attempts.length)};
}
async function spotifyPublicHistory(bucket){
 const cacheKey='indexes/spotify-history-cache-v1.json',cachedObject=await bucket.get(cacheKey),cached=cachedObject?await cachedObject.json():{},entries={};let cursor,objects=[];
 do{const page=await bucket.list({prefix:'spotify/history/',cursor});objects.push(...page.objects);cursor=page.truncated?page.cursor:undefined;}while(cursor);
 let changed=Object.keys(cached).length!==objects.length;
 for(const object of objects){if(object.etag&&cached[object.key]?.etag===object.etag)entries[object.key]=cached[object.key];else{const row=await bucket.get(object.key);if(row)entries[object.key]={etag:object.etag,value:await row.json()};changed=true;}}
 if(changed)await bucket.put(cacheKey,JSON.stringify(entries));return Object.values(entries).map(e=>e.value);
}
function spotifyPublicDecode(v){return String(v||'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function spotifyPublicPage(html,artistId,expectedNames=[]){
 const meta={};for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))attrs[m[1]]=spotifyPublicDecode(m[2]);meta[attrs.property||attrs.name]=attrs.content;}
 const canonical='https://open.spotify.com/artist/'+artistId;
 if(meta['og:url']?.replace(/\/$/,'')!==canonical)throw Error('Identificador da página não confere.');
 const name=meta['og:title'];if(!name||!expectedNames.some(n=>spotifyPublicName(n)===spotifyPublicName(name)))throw Error('Nome do artista não confere; revisão necessária.');
 const label=html.match(/<[^>]+\bdata-testid=["']monthly-listeners-label["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
 const text=spotifyPublicDecode(label?.[1]||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
 const number=text.match(/^([\d.,\s]+)\s+(?:monthly listeners|ouvintes mensais)$/i)?.[1]?.trim();
 if(!number||!/^\d+(?:[.,\s]\d{3})*$/.test(number))throw Error('Contagem exata de ouvintes ausente; não usamos números arredondados.');
 const monthlyListeners=Number(number.replace(/[.,\s]/g,''));
 if(!Number.isSafeInteger(monthlyListeners)||monthlyListeners<0)throw Error('Contagem inválida.');
 return {artistId,name,monthlyListeners,followers:null,url:canonical,source:'spotify-public-page',identityStatus:'public-name-match',precision:'exact'};
}
async function spotifyPublicFetch(url){
 const response=await fetch(url,{headers:{'User-Agent':'RadarDeTalentos/1.0 (public artist metrics; contact longasnaila@gmail.com)','Accept-Language':'en-US,en;q=0.8'},redirect:'manual',signal:AbortSignal.timeout(15000)});
 if([403,429].includes(response.status)){const e=Error('Fonte temporariamente indisponível (HTTP '+response.status+').');e.pause=true;throw e;}
 if(!response.ok)throw Error('Consulta pública retornou HTTP '+response.status+'.');
 return response;
}
async function spotifyPublicResolve(name,context={}){
 if(context.reviewedIdentity)return context.reviewedIdentity;
 if(context.registryIdentity)return context.registryIdentity;
 if(/^https:\/\/www\.youtube\.com\/channel\/UC[\w-]{22}$/.test(context.profileUrl||'')){
  try{
   const source=await fetch(context.profileUrl+'/about',{redirect:'manual',signal:AbortSignal.timeout(8000)});
   if(source.ok){const found=spotifyYoutubeIdentity(await source.text(),context.profileUrl,name);if(found)return found;}
  }catch{}
 }
 if(context.comparisonPersonId)throw Error('Nenhum identificador público oficial confirmado para este cadastro.');
 const search=await (await spotifyPublicFetch('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbsearchentities',search:name,language:'pt',format:'json',limit:'3'}))).json();
 const matches=(search.search||[]).filter(e=>spotifyPublicName(e.label)===spotifyPublicName(name)||spotifyPublicName(e.match?.text)===spotifyPublicName(name));
 if(!matches.length)throw Error('Nenhum identificador público com nome exato.');
 const data=await (await spotifyPublicFetch('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',ids:matches.map(e=>e.id).join('|'),props:'claims|labels|aliases',languages:'pt|en',format:'json'}))).json();
 const found=[];
 for(const e of Object.values(data.entities||{})){
  const names=[...Object.values(e.labels||{}).map(v=>v.value),...Object.values(e.aliases||{}).flat().map(v=>v.value)];
  if(!names.some(n=>spotifyPublicName(n)===spotifyPublicName(name)))continue;
  const ids=[...new Set((e.claims?.P1902||[]).filter(c=>c.rank!=='deprecated').map(c=>c.mainsnak?.datavalue?.value).filter(v=>/^[A-Za-z0-9]{22}$/.test(v)))];
  if(ids.length===1)found.push({artistId:ids[0],names:[name,...names],wikidataId:e.id});
 }
 if(found.length!==1)throw Error('Identificador ausente ou ambíguo; revisão necessária.');
 return found[0];
}
function spotifyPublicCandidates(history,registry,attempts,mode,recentMisses=new Set(),networkChecks={}){
 const known=new Map();for(const row of history)if(row.artistId&&(!known.has(row.artistId)||known.get(row.artistId).date<row.date))known.set(row.artistId,row);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(mode==='refresh')return [...known.values()].filter(r=>r.date<today&&!attempts.has('id:'+r.artistId)).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name)).map(r=>({name:r.name,artistId:r.artistId,key:'id:'+r.artistId}));
 const seen=new Set([...known.values()].flatMap(r=>[spotifyPublicName(r.name),spotifyPublicName(r.input)])),result=[],grouped=new Map(),comparison=typeof spotifyComparisonChannelIndex==='function'?spotifyComparisonChannelIndex():new Map(),completedComparison=new Set((typeof spotifyComparisonRows==='function'?spotifyComparisonRows(history):[]).map(r=>r.comparisonPersonId).filter(Boolean));
 const comparisonHandles=new Set(typeof SPOTIFY_COMPARISON_QUEUE==='undefined'?[]:SPOTIFY_COMPARISON_QUEUE.map(p=>p.username).filter(Boolean));
 for(const p of registry){if(!(p.categorias||[p.categoria]).includes('Cantores')||['en','es'].includes(p.contentLanguage))continue;
  if(p.username&&comparisonHandles.has(p.username.toLowerCase()))continue;
  const original=String(p.nome||p.title||p.name||'').trim();
  const target=comparison.get(p.selector?.id||p.id);
  if(spotifyQueueExclusion(original)||target?.excluded||target&&completedComparison.has(target.personId))continue;
  const anchor=target?.spotify?.find(s=>p.url==='https://www.youtube.com/channel/'+s.channelId),reviewedIdentity=anchor?{artistId:anchor.artistId,names:[anchor.title,original,target.name],sourceUrl:anchor.source,sources:[anchor.source],reviewed:true}:spotifyReviewedIdentity(original,p.url);
  if(!reviewedIdentity&&(p.entityType==='organization'||(typeof suggestedEntity==='function'&&suggestedEntity(original)==='organization')))continue;
  const name=spotifyPublicQueueName(original),normalized=spotifyPublicName(name);if(!normalized||seen.has(normalized))continue;
  const checkedId=networkChecks[p.selector?.id]?.artistId,source=String(p.description||'')+(/^[a-zA-Z0-9]{22}$/.test(checkedId||'')?'\nhttps://open.spotify.com/artist/'+checkedId:'');
  const registryIdentity=reviewedIdentity?null:spotifyRegistryIdentity({...p,description:source},name),identity=reviewedIdentity||registryIdentity;
  if(identity&&known.has(identity.artistId))continue;
  const groupKey=target?'comparison:'+target.personId:identity?'id:'+identity.artistId:normalized,profileUrl=/^https:\/\/www\.youtube\.com\/channel\/UC[\w-]{22}$/.test(p.url||'')?p.url:null,base=reviewedIdentity?4:registryIdentity?3:profileUrl?2:name.includes(' ')?1:0,priority=target?(target.rank<=50?20000:10000)+(reviewedIdentity||registryIdentity?1000:0)-target.rank+base/10:base,previous=grouped.get(groupKey);
  if(!previous||priority>previous.priority)grouped.set(groupKey,{name,key:'name:'+normalized,priority,reviewedIdentity,registryIdentity,profileUrl,...(target?{comparisonPersonId:target.personId,comparisonRank:target.rank}:{})});
 }
 for(const candidate of grouped.values())if(!attempts.has(candidate.key)&&(!recentMisses.has(candidate.key)||candidate.reviewedIdentity||candidate.registryIdentity))result.push(candidate);
 return result.sort((a,b)=>b.priority-a.priority);
}
async function spotifyRecentMisses(bucket,date){
 const midnight=Date.parse(date+'T00:00:00Z');
 const days=await Promise.all(Array.from({length:7},async(_,i)=>{
  const previousDate=new Date(midnight-(i+1)*86400000).toISOString().slice(0,10);
  const object=await bucket.get('spotify/public/days/'+previousDate+'.json');return object?await object.json():[];
 }));
 return new Set(days.flat().filter(a=>a.outcome==='pending'&&/identificador público|identificador ausente|nome do artista não confere/i.test(a.reason||'')).map(a=>a.key));
}
async function spotifyPublicApi(request,env){
 const stateKey='spotify/public/status.json',stateObject=await env.BUCKET.get(stateKey),previous=stateObject?await stateObject.json():{};
 if(request.method==='GET'){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),day=await env.BUCKET.get('spotify/public/days/'+today+'.json'),attempts=day?await day.json():[];
  return json({...previous,source:'spotify-public-page',paidFallback:false,batchLimit:5,hourlyLimit:SPOTIFY_PUBLIC_HOURLY_LIMIT,hourlyRemaining:spotifyHourlyRemaining(attempts),dailyLimit:SPOTIFY_PUBLIC_DAILY_LIMIT,daily:spotifyPublicDailySummary(today,attempts),queueReview:{reviewedAt:'2026-11-07',registryChanges:false,verifiedLinks:SPOTIFY_REVIEWED_LINKS.map(r=>({name:r.name,aliases:r.aliases,url:'https://open.spotify.com/artist/'+r.artistId,sources:r.sources})),exclusions:SPOTIFY_QUEUE_EXCLUSIONS}});
 }
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 const input=await request.json().catch(()=>({})),mode=input.mode==='refresh'?'refresh':'new',limit=Math.min(5,Math.max(1,Math.floor(Number(input.limit)||5)));
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const lockKey='spotify/public/lease.json',lockObject=await env.BUCKET.get(lockKey),lock=lockObject?await lockObject.json():null;
 if(lock?.expiresAt>Date.now())return json({paused:true,reason:'Uma rodada pública já está em andamento.'},409);
 const headers=new Headers(lockObject?{'If-Match':lockObject.httpEtag||lockObject.etag}:{'If-None-Match':'*'});
 if(!await env.BUCKET.put(lockKey,JSON.stringify({expiresAt:Date.now()+300000}),{onlyIf:headers}))return json({paused:true,reason:'Rodada reservada por outra consulta.'},409);
 try{
  const dayKey='spotify/public/days/'+date+'.json',dayObject=await env.BUCKET.get(dayKey),attempts=dayObject?await dayObject.json():[];
  if(attempts.length>=SPOTIFY_PUBLIC_DAILY_LIMIT)return json({...previous,requested:0,collected:0,rows:[],failed:[],paused:true,reason:'Limite diário de '+SPOTIFY_PUBLIC_DAILY_LIMIT+' consultas atingido.',dailyLimit:SPOTIFY_PUBLIC_DAILY_LIMIT});
  const cooldown=previous.retryAfter&&Date.parse(previous.retryAfter)>Date.now();if(cooldown)return json({...previous,requested:0,collected:0,rows:[],failed:[],paused:true});
  const hourlyRemaining=spotifyHourlyRemaining(attempts);
  if(!hourlyRemaining)return json({paused:true,reason:'Limite de consultas desta hora atingido.',hourlyRemaining:0});
  const history=await readAll(env.BUCKET,'spotify/history/'),registry=[...await readAll(env.BUCKET,'channels/'),...await readAll(env.BUCKET,'ig-profiles/')];
  const recentMisses=mode==='new'&&!input.url?await spotifyRecentMisses(env.BUCKET,date):new Set();
  const networkChecks=mode==='new'&&typeof registeredReviewState==='function'?(await registeredReviewState(env.BUCKET)).checks:{};
  let candidates=spotifyPublicCandidates(history,registry,new Set(attempts.map(a=>a.key)),mode,recentMisses,networkChecks);
  if(mode==='new'&&input.comparisonOnly===true)candidates=candidates.filter(c=>c.comparisonPersonId&&(!input.firstFifty||c.comparisonRank<=50));
  if(mode==='new'&&input.verifiedOnly===true)candidates=candidates.filter(c=>c.reviewedIdentity||c.registryIdentity);
  if(input.url||input.name){const match=String(input.url||'').match(/^https:\/\/open\.spotify\.com\/artist\/([A-Za-z0-9]{22})(?:\?[^#]*)?\/?$/);if(!match||!String(input.name||'').trim()||String(input.name).length>120)return json({error:'Informe nome e link oficial de artista do Spotify.'},400);candidates=[{name:String(input.name).trim(),artistId:match[1],key:'id:'+match[1]}].filter(c=>!attempts.some(a=>a.key===c.key&&a.outcome==='collected')&&!history.some(r=>r.artistId===c.artistId&&r.date===date));}
  const blocked=typeof blockIndex==='function'?await blockIndex(env.BUCKET):[],blockedArtist=id=>id&&blocked.length&&isBlockedProfile({rede:'Spotify',artistId:id},blocked);
  if(input.url&&blockedArtist(candidates[0]?.artistId))return json({error:'Este perfil foi excluído do Radar.'},409);
  candidates=candidates.filter(c=>!blockedArtist(c.artistId||c.reviewedIdentity?.artistId||c.registryIdentity?.artistId));
  const batch=candidates.slice(0,Math.min(limit,hourlyRemaining,SPOTIFY_PUBLIC_DAILY_LIMIT-attempts.length));
  const result={date,source:'spotify-public-page',paidFallback:false,mode,requested:batch.length,collected:0,failed:[],rows:[],attemptedToday:attempts.length,dailyLimit:SPOTIFY_PUBLIC_DAILY_LIMIT,remainingCandidates:candidates.length-batch.length,completedAt:null};
  for(const candidate of batch){
   const attempt={...candidate,date,attemptedAt:new Date().toISOString()};
   attempts.push(attempt);await env.BUCKET.put(dayKey,JSON.stringify(attempts));result.attemptedToday++;
   try{
    const identity=candidate.artistId?{artistId:candidate.artistId,names:[candidate.name]}:await spotifyPublicResolve(candidate.name,candidate);
    if(blockedArtist(identity.artistId))throw Error('Este perfil foi excluído do Radar.');
    const html=await (await spotifyPublicFetch('https://open.spotify.com/artist/'+identity.artistId)).text();
    const row={...spotifyPublicPage(html,identity.artistId,identity.names),date,collectedAt:new Date().toISOString(),input:candidate.name,discoverySource:identity.sourceUrl||(identity.wikidataId?'wikidata:'+identity.wikidataId:'existing-artist-link'),identityEvidence:identity.sources||[],...(candidate.comparisonPersonId?{comparisonPersonId:candidate.comparisonPersonId}:{})};
    const key='spotify/history/'+date+'/'+row.artistId+'.json';
    if(!await env.BUCKET.get(key))await env.BUCKET.put(key,JSON.stringify(row));
    attempt.outcome='collected';attempt.artistId=row.artistId;result.collected++;result.rows.push(row);
   }catch(e){attempt.outcome='pending';attempt.reason=e.message;result.failed.push({name:candidate.name,reason:e.message});if(e.pause){result.paused=true;result.retryAfter=new Date(Date.now()+3600000).toISOString();break;}}
  }
  await env.BUCKET.put(dayKey,JSON.stringify(attempts));result.completedAt=new Date().toISOString();await env.BUCKET.put(stateKey,JSON.stringify(result));return json(result);
 }finally{await env.BUCKET.delete(lockKey);}
}
