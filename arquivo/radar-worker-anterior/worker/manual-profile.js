function manualLink(value){
 let u;try{u=new URL(String(value||'').trim());}catch{throw Error('Informe o link completo do perfil.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Use um link HTTPS do Instagram ou YouTube.');
 const host=u.hostname.toLowerCase(),parts=u.pathname.split('/').filter(Boolean);
 if(['instagram.com','www.instagram.com'].includes(host)){
  const username=(parts[0]||'').toLowerCase();
  if(parts.length!==1||!/^[a-z0-9._]{1,30}$/.test(username)||['p','reel','reels','stories','explore','accounts','direct','share','tv'].includes(username))throw Error('Use o link do perfil, não de uma publicação do Instagram.');
  return {rede:'Instagram',username,url:'https://www.instagram.com/'+username+'/'};
 }
 const selector=channelSelector(u.href);return {rede:'YouTube',selector,url:selector.id?'https://www.youtube.com/channel/'+selector.id:'https://www.youtube.com/'+selector.forHandle};
}
function manualClassification(description){
 const text=String(description||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const rules={Cantores:/\b(cantor|cantora|musico|musica|banda|sertanejo|pagode|gospel|rapper)\b/,Humoristas:/\b(humorista|comediante|stand[ -]?up|comedia)\b/,Palestrantes:/\b(palestrante|palestras|speaker)\b/,Artistas:/\b(ator|atriz|artista|apresentador|apresentadora|magico|dancarino|dancarina|escritor|escritora)\b/,Influenciadores:/\b(influenciador|influenciadora|criador de conteudo|criadora de conteudo|digital influencer|youtuber)\b/};
 const selected=categories.filter(c=>(rules[c]||eventCategoryTerms[c])?.test(text));return {categorias:selected,subcategorias:suggestedBiographyTopics({description,categorias:selected})};
}
function manualIdentity(p){return p.username?'Instagram|'+p.username.toLowerCase():'YouTube|'+(p.selector?.id||p.selector?.forHandle?.toLowerCase()||p.id);}
async function manualProfileApi(request,env){
 const b=await request.json();
 if(b.action==='preview'){
  const nome=String(b.nome||'').trim();if(!nome||nome.length>120)throw Error('Informe o nome da pessoa, com até 120 caracteres.');
  const link=manualLink(b.url),registry=await readAll(env.BUCKET,link.rede==='Instagram'?'ig-profiles/':'channels/');
  if(isBlockedProfile(link,await blockIndex(env.BUCKET)))throw Error('Este perfil foi excluído e bloqueado pela curadoria.');
  let existing=registry.find(p=>manualIdentity(p)===manualIdentity(link));
  if(existing)return json({existing:true,profile:{nome:existing.nome,url:existing.url||link.url,rede:link.rede},message:'Este perfil já está na base.'});
  let description='',seguidores=null,collectionState='queued',collectionError='',validated=false;
  try{
   if(link.rede==='Instagram'){
    const connection=await igRead(env,'connection');if(!connection)throw Error('Instagram sem conexão. O cadastro pode ser salvo, mas é necessário reconectar nas configurações para coletar.');
    if(!await reserveInstagram(env,1))throw deferredInstagram('A Meta limitou temporariamente as consultas.');
    const p=await igProfile(connection,link.username,env);seguidores=p.followers_count;validated=true;
    description=p.biography||'';
   }else{
    const response=await youtubeFetch(env,'channels',{part:'snippet,statistics',...link.selector}),p=response.items?.[0];
    if(!p)return json({error:'Canal não encontrado. Confira o link antes de cadastrar.'},400);
    link.selector={id:p.id};link.url='https://www.youtube.com/channel/'+p.id;
    existing=registry.find(c=>c.selector?.id===p.id||c.id===p.id);
    if(existing)return json({existing:true,profile:{nome:existing.nome,url:link.url,rede:link.rede},message:'Este perfil já está na base.'});
    description=p.snippet?.description||'';validated=true;
    if(!p.statistics?.hiddenSubscriberCount&&p.statistics?.subscriberCount!=null){const n=Number(p.statistics.subscriberCount);if(Number.isFinite(n)&&n>=0)seguidores=n;}
    if(seguidores===null)collectionError='O YouTube não disponibilizou a contagem de inscritos.';
   }
  }catch(e){collectionError=e.message;collectionState=e.deferred?'paused':'queued';}
  const classification=manualClassification(description),draft={...link,nome,description,...classification,seguidores,validated,collectionState:seguidores!==null?'collected':collectionState,collectionError,collectedAt:seguidores!==null?new Date().toISOString():null,expiresAt:Date.now()+1800000};
  const draftId=crypto.randomUUID();await env.BUCKET.put('manual-drafts/'+draftId+'.json',JSON.stringify(draft));
  return json({draftId,profile:draft,message:seguidores===null?'Aguardando coleta. '+collectionError:'Consulta concluída. Confira a classificação antes de confirmar.'});
 }
 if(b.action==='confirm'){
  if(!/^[a-f0-9-]{36}$/.test(b.draftId||''))throw Error('Consulte o perfil antes de confirmar.');
  const key='manual-drafts/'+b.draftId+'.json',o=await env.BUCKET.get(key);if(!o)throw Error('Consulta expirada. Consulte o perfil novamente.');
  const draft=await o.json();if(draft.expiresAt<Date.now())throw Error('Consulta expirada. Consulte o perfil novamente.');
  const selected=Array.isArray(b.categorias)?[...new Set(b.categorias)]:[];
  if(!selected.every(c=>categories.includes(c))||!validTalentTopics(b.subcategorias||[],selected))throw Error('Confira as categorias e os temas.');
  const prefix=draft.rede==='Instagram'?'ig-profiles':'channels',registry=await readAll(env.BUCKET,prefix+'/');
  if(registry.some(p=>manualIdentity(p)===manualIdentity(draft)))return json({existing:true,profile:draft,message:'Este perfil já está na base. Nenhum cadastro duplicado foi criado.'});
  if(registry.length>=(draft.rede==='Instagram'?IG_LIMIT:BASE_LIMIT))throw Error('Capacidade da base atingida.');
  const profile={nome:draft.nome,url:draft.url,description:draft.description,categoria:selected[0]||'',categorias:selected,subcategorias:b.subcategorias||[],categorySuggested:false,classificationPending:!selected.length,topicSuggested:false,source:'manual',createdAt:new Date().toISOString(),collectionState:draft.collectionState,collectionError:draft.collectionError};
  if(draft.rede==='Instagram')profile.username=draft.username;else{profile.selector=draft.selector;profile.id=encodeURIComponent(draft.selector.id||draft.selector.forHandle.toLowerCase());}
  registry.push(profile);await saveRegistry(env.BUCKET,prefix,registry);
  if(draft.seguidores!==null)await saveDay(env.BUCKET,igDate(),[{nome:profile.nome,categoria:profile.categoria,categorias:selected,subcategorias:profile.subcategorias,rede:draft.rede,data:igDate(),seguidores:draft.seguidores,url:draft.url,collectedAt:draft.collectedAt,provider:draft.rede==='Instagram'?'Instagram Graph API':'YouTube Data API',...(draft.rede==='YouTube'?{channelId:draft.selector.id,rounded:true}:{})}]);
  return json({saved:true,profile:{...profile,rede:draft.rede,seguidores:draft.seguidores},message:draft.seguidores===null?'Perfil cadastrado. Aguardando coleta nas próximas rodadas.':'Perfil cadastrado e primeira contagem salva. O crescimento exige coletas em datas diferentes.'});
 }
 throw Error('Operação de cadastro inválida.');
}
