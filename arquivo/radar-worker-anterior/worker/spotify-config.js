async function spotifyConfigApi(request,env){
 if(!request.headers.get('oai-authenticated-user-id'))return json({error:'Entre com sua conta para configurar o Spotify.'},401);
 if(request.method==='GET')return json({configured:!!await env.BUCKET.get('config/apify-token.json'),automaticCollection:!!await env.BUCKET.get('spotify/sync-status.json')});
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 const body=await request.json(),token=String(body.token||'').trim();
 if(!/^apify_api_[A-Za-z0-9_-]{10,240}$/.test(token))return json({error:'Confira o token copiado do Apify.'},400);
 let response;
 try{response=await fetch('https://api.apify.com/v2/acts/2YpgDg46kTVoHMxuQ/runs?limit=1',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});}catch{return json({error:'Apify indisponível no momento. Tente salvar novamente mais tarde.'},503);}
 if(!response.ok){await response.body?.cancel();return json({error:response.status===401||response.status===403?'O token não permite consultar as execuções desse coletor. Confira List runs e o Actor ID.':'Não foi possível validar o acesso ao Apify agora.'},response.status===401||response.status===403?400:503);}
 await response.body?.cancel();
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(env),new TextEncoder().encode(token));
 await env.BUCKET.put('config/apify-token.json',JSON.stringify({iv:base64(iv),ciphertext:base64(ciphertext),validatedAt:new Date().toISOString(),actorId:'2YpgDg46kTVoHMxuQ'}));
 return json({configured:true,automaticCollection:false});
}

async function spotifyReadApify(env,path){
 const object=await env.BUCKET.get('config/apify-token.json');
 if(!object)throw Error('Conecte o Apify primeiro.');
 const record=await object.json();
 const token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(record.iv)},await encryptionKey(env),bytes(record.ciphertext)));
 const res=await fetch('https://api.apify.com/v2/'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error('Apify não permitiu ler os resultados (HTTP '+res.status+'). Nenhuma execução foi iniciada.');
 return res.json();
}
async function spotifyImportApi(request,env,runId){
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 const runs=runId?[(await spotifyReadApify(env,'actor-runs/'+encodeURIComponent(runId))).data]:(await spotifyReadApify(env,'acts/2YpgDg46kTVoHMxuQ/runs?status=SUCCEEDED&desc=1&limit=20')).data?.items||[];
 const run=runs.find(r=>r.status==='SUCCEEDED'&&r.defaultDatasetId&&r.finishedAt);
 if(run?.actId!=='2YpgDg46kTVoHMxuQ'||run.status!=='SUCCEEDED'||!run.defaultDatasetId||!run.finishedAt)throw Error('Nenhuma execução concluída disponível para importação.');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(run.finishedAt));
 const items=await spotifyReadApify(env,'datasets/'+encodeURIComponent(run.defaultDatasetId)+'/items?format=json&clean=true&limit=1000');
 if(!Array.isArray(items))throw Error('Formato de resultado não reconhecido.');
 const rows=[];
 for(const item of items){
  const link=String(item.link||''),match=link.match(/^https:\/\/open\.spotify\.com\/artist\/([A-Za-z0-9]{22})(?:[/?]|$)/);
  if(!match||typeof item.monthly_listeners!=='number'||!Number.isSafeInteger(item.monthly_listeners)||item.monthly_listeners<0||typeof item.name!=='string')continue;
  const normalizeName=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const input=String(item.input||'');
  const identityMatches=input.includes(match[1])||normalizeName(input)===normalizeName(item.name);
  if(!identityMatches){
   await env.BUCKET.put('spotify/unverified/'+run.id+'/'+match[1]+'.json',JSON.stringify({input,name:item.name,artistId:match[1],date,sourceRun:run.id,reason:'Nome retornado diferente do solicitado; revisar identidade.'}));
   const historyKey='spotify/history/'+date+'/'+match[1]+'.json',saved=await env.BUCKET.get(historyKey);
   if(saved&&(await saved.json()).sourceRun===run.id)await env.BUCKET.delete(historyKey);
   continue;
  }
  rows.push({artistId:match[1],name:item.name,monthlyListeners:item.monthly_listeners,followers:Number.isSafeInteger(item.followers)?item.followers:null,url:'https://open.spotify.com/artist/'+match[1],date,collectedAt:run.finishedAt,sourceRun:run.id,input,identityStatus:input.includes(match[1])?'artist-link':'name-match'});
 }
 if(!rows.length)throw Error('Nenhum resultado reconhecido. Os dados existentes foram preservados.');
 for(const row of rows){const key='spotify/history/'+date+'/'+row.artistId+'.json';if(!await env.BUCKET.get(key))await env.BUCKET.put(key,JSON.stringify(row));}
 await env.BUCKET.put('spotify/import-status.json',JSON.stringify({date,imported:rows.length,sourceRun:run.id,importedAt:new Date().toISOString(),automaticCollection:false}));
 return json({date,rows,automaticCollection:false});
}

// Conservative live policy. The US$50/7000-artist proposal is not enabled.
const SPOTIFY_POLICY={collectionDays:[1,11,21],batchLimit:10,maxChargeUsd:0.03,monthlyReservationLimitUsd:0.09,budgetMode:'free-credit',proposedBatchLimit:7000};
function spotifyCandidateBatch(history,channels,unverified,state={}){
 const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const latest=new Map();for(const r of history)if(r.artistId&&(!latest.has(r.artistId)||latest.get(r.artistId).date<r.date))latest.set(r.artistId,r);
 const known=[...latest.values()].sort((a,b)=>a.artistId.localeCompare(b.artistId));
 const seen=new Set(known.map(r=>key(r.name))),rejected=new Set(unverified.map(r=>key(r.input)));
 const candidates=channels.filter(c=>(c.categorias||[c.categoria]).includes('Cantores')&&c.entityType!=='organization'&&!['en','es'].includes(c.contentLanguage)).map(c=>c.nome||c.title||c.name).filter(name=>{const k=key(name);if(!k||seen.has(k)||rejected.has(k))return false;seen.add(k);return true;});
 const limit=SPOTIFY_POLICY.batchLimit,newCount=Math.min(candidates.length,known.length?Math.ceil(limit*.8):limit),knownCount=Math.min(known.length,limit-newCount);
 const knownOffset=Number(state.knownOffset||0)%Math.max(1,known.length),offset=Number(state.discoveryOffset||0)%Math.max(1,candidates.length);
 return {artists:[...Array.from({length:newCount},(_,i)=>candidates[(offset+i)%candidates.length]),...Array.from({length:knownCount},(_,i)=>known[(knownOffset+i)%known.length].url)],priority:'complete-registered-artists-first',missingSpotify:newCount,refreshSpotify:knownCount,knownOffset:knownOffset+knownCount,discoveryOffset:offset+newCount,registered:known.length,discoveryCandidates:candidates.length};
}
let spotifySyncBusy=false;
async function spotifySyncApi(request,env){
 const key='spotify/sync-status.json',old=await env.BUCKET.get(key),state=old?await old.json():{};
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const policy={...SPOTIFY_POLICY};
 if(request.method==='GET')return new URL(request.url).searchParams.get('preflight')==='1'?json({...state,policy,preflight:await spotifyPreflight(env,state)}):json({...state,policy});
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 if(spotifySyncBusy)return json({...state,paused:true,reason:'Rodada em andamento',policy});
 spotifySyncBusy=true;
 try{
  if(state.runId&&(!state.completed||state.validationVersion!==2)){
   const run=(await spotifyReadApify(env,'actor-runs/'+encodeURIComponent(state.runId))).data;
   if(['READY','RUNNING','TIMING-OUT','ABORTING'].includes(run.status))return json({...state,paused:true,reason:'Aguardando conclusão do lote já iniciado.',policy});
   if(run.status==='SUCCEEDED'){
    const response=await spotifyImportApi(new Request(request.url,{method:'POST'}),env,state.runId),result=await response.json();
    state.completed=true;state.validationVersion=2;state.completedAt=new Date().toISOString();state.imported=result.rows.length;
   }else{state.completed=true;state.error='Execução encerrada: '+run.status;}
   await env.BUCKET.put(key,JSON.stringify(state));
  }
  if(state.date===date)return json({...state,paused:true,reason:'Lote desta rodada já reservado. Nenhuma nova execução iniciada.',policy});
  if(!policy.collectionDays.includes(Number(date.slice(-2))))return json({...state,paused:true,reason:'Próxima coleta nos dias 1, 11 ou 21.',policy});
  const month=date.slice(0,7),reservations=await readAll(env.BUCKET,'spotify/reservations/'+month+'/'),reserved=reservations.reduce((sum,r)=>sum+Number(r.maxChargeUsd||0),0);
  if(reserved+policy.maxChargeUsd>policy.monthlyReservationLimitUsd+1e-9)return json({...state,paused:true,reason:'Orçamento mensal reservado. Fila preservada.',reservedUsd:reserved,policy});
  const object=await env.BUCKET.get('config/apify-token.json');if(!object)return json({...state,paused:true,error:'Conexão do Apify ausente',policy});
  const history=await readAll(env.BUCKET,'spotify/history/'),channels=[...await readAll(env.BUCKET,'channels/'),...await readAll(env.BUCKET,'ig-profiles/')],unverified=await readAll(env.BUCKET,'spotify/unverified/');
  const batch=spotifyCandidateBatch(history,channels,unverified,state);
  if(!batch.artists.length)return json({...state,remaining:0,reason:'Nenhum candidato elegível.',policy});
  const next={enabled:true,date,...batch,reservedAt:new Date().toISOString(),maxChargeUsd:policy.maxChargeUsd,completed:false};
  // Atomic slot reservation prevents two isolates from starting the same round.
  const reservation=await env.BUCKET.put('spotify/reservations/'+month+'/'+date+'.json',JSON.stringify(next),{onlyIf:new Headers({'If-None-Match':'*'})});
  if(!reservation)return json({...state,paused:true,reason:'Rodada já reservada por outra execução. Não repetir.',policy});
  await env.BUCKET.put(key,JSON.stringify(next));
  const record=await object.json(),token=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(record.iv)},await encryptionKey(env),bytes(record.ciphertext)));
  try{
   const response=await fetch('https://api.apify.com/v2/acts/2YpgDg46kTVoHMxuQ/runs?timeout=180&memory=256&maxTotalChargeUsd='+policy.maxChargeUsd,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({artists:batch.artists,scrapeDetails:false}),signal:AbortSignal.timeout(20000)});
   if(!response.ok){next.paused=true;next.error='Apify HTTP '+response.status;}else{const run=(await response.json()).data;next.runId=run.id;}
  }catch{next.paused=true;next.error='Início sem confirmação. Reserva mantida para evitar cobrança duplicada.';}
  await env.BUCKET.put(key,JSON.stringify(next));return json({...next,policy});
 }finally{spotifySyncBusy=false;}
}

// Read-only diagnostics: never starts an Actor or writes a reservation.
async function spotifyPreflight(env,state){
 const checkedAt=new Date().toISOString();
 const probes=[['limits','users/me/limits',d=>({limits:d.limits,current:d.current,monthlyUsageCycle:d.monthlyUsageCycle})],['actor','acts/2YpgDg46kTVoHMxuQ',d=>({id:d.id,pricingInfos:d.pricingInfos,isDeprecated:d.isDeprecated})],['runs','acts/2YpgDg46kTVoHMxuQ/runs?desc=1&limit=10',d=>({items:(d.items||[]).map(r=>({id:r.id,status:r.status,startedAt:r.startedAt,finishedAt:r.finishedAt,usageTotalUsd:r.usageTotalUsd,pricingInfo:r.pricingInfo,chargedEventCounts:r.chargedEventCounts,defaultDatasetId:r.defaultDatasetId}))})]];
 const entries=await Promise.all(probes.map(async([name,path,select])=>{try{return [name,{ok:true,...select((await spotifyReadApify(env,path)).data||{})}];}catch(e){return [name,{ok:false,error:e.message}];}}));
 return {checkedAt,readOnly:true,...Object.fromEntries(entries)};
}
