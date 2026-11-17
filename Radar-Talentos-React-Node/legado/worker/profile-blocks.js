function blockProfileKeys(p){const rede=p.rede||(p.artistId?'Spotify':p.username?'Instagram':'YouTube'),keys=[];let url;try{url=new URL(p.url)}catch{}if(rede==='Instagram'){const name=p.username||url?.pathname.split('/').filter(Boolean)[0];if(name)keys.push('ig:'+String(name).replace(/^@/,'').toLowerCase());}else if(rede==='YouTube'){const id=p.channelId||p.selector?.id||(String(p.id||'').startsWith('UC')?p.id:null)||(url?.pathname.startsWith('/channel/')?url.pathname.split('/')[2]:null);if(id)keys.push('yt:'+id);const handle=p.selector?.forHandle||(url?.pathname.startsWith('/@')?url.pathname.split('/')[1]:null);if(handle)keys.push('yt-handle:'+handle.toLowerCase());}else if(rede==='Spotify'){const id=p.artistId||url?.pathname.match(/\/artist\/([a-zA-Z0-9]{22})(?:\/|$)/)?.[1];if(id)keys.push('sp:'+id);}if(url)keys.push(rede+'|'+url.hostname.toLowerCase()+url.pathname.replace(/\/$/,''));if(url)keys.push(rede+'|'+url.pathname.replace(/\/$/,'').toLowerCase());return keys;}
async function blockIndex(bucket){const o=await bucket.get('indexes/blocked-profiles.json');return o?await o.json():[];}
function isBlockedProfile(p,blocks){const keys=blockProfileKeys(p);return blocks.some(b=>b.keys.some(k=>keys.includes(k)));}
async function filterBlockedProfiles(bucket,rows){const blocks=await blockIndex(bucket);return blocks.length?rows.filter(p=>!isBlockedProfile(p,blocks)):rows;}
function talentBlockGroup(row){return row.personId?'id:'+row.personId:'name:'+countryPersonKey(row.nome);}
const talentBlockName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
async function talentBlockProfiles(env){
 const bucket=env.BUCKET,[channels,instagram,history,spotify,links,curation]=await Promise.all([readAll(bucket,'channels/'),readAll(bucket,'ig-profiles/'),historyRows(bucket),readAll(bucket,'spotify/history/'),readAll(bucket,'youtube-instagram-links/'),bucket.get('indexes/talent-curation.json')]);
 const edits=curation?await curation.json():{},byProfile=new Map(),registry=[...channels,...instagram];
 const record=row=>{const key=curationKey(row),old=byProfile.get(key);if(!old||(old.data||'')<(row.data||''))byProfile.set(key,row);};
 for(const p of channels)record({...p,rede:'YouTube'});
 for(const p of instagram)record({...p,rede:'Instagram',url:'https://www.instagram.com/'+p.username+'/'});
 for(const row of history)record(row);
 const base=await filterBlockedProfiles(bucket,includeYoutubeInstagramLinks(associateTalentRows([...byProfile.values()].map(row=>{const edit=edits[curationKey(row)];return {...row,originalName:row.nome,...(edit?{nome:edit.nome,personId:edit.personId,categoryReviewed:true}:{})};}),registry),links));
 const byName=new Map(),byChannel=new Map(),artistGroups=new Map();
 for(const p of base){const group=talentBlockGroup(p),key=talentBlockName(p.nome);if(key){if(!byName.has(key))byName.set(key,new Set());byName.get(key).add(group);}if(p.rede==='YouTube'){const id=p.channelId||p.selector?.id||p.url?.match(/\/channel\/(UC[\w-]{22})/)?.[1];if(id)byChannel.set(id,p);}}
 const addArtistGroup=(id,group)=>{if(!artistGroups.has(id))artistGroups.set(id,new Set());artistGroups.get(id).add(group);};
 for(const [id,p]of byChannel){const reviewed=spotifyReviewedIdentity(p.originalName||p.nome,'https://www.youtube.com/channel/'+id);if(reviewed)addArtistGroup(reviewed.artistId,talentBlockGroup(p));}
 for(const r of spotifyComparisonRows(spotify)){
  const explicit=r.comparisonPersonId?'id:'+r.comparisonPersonId:null,verified=artistGroups.get(r.artistId),fallback=byName.get(talentBlockName(r.name))||byName.get(talentBlockName(r.input));
  const group=explicit||(verified?.size===1?[...verified][0]:!verified?.size&&fallback?.size===1?[...fallback][0]:null);
  base.push({...r,rede:'Spotify',nome:r.name,blockGroup:group||'spotify:'+r.artistId});
 }
 return base;
}
async function blockTalentApi(request,env){
 if(!request.headers.get('oai-authenticated-user-id'))return json({error:'Entre com sua conta para excluir perfis.'},401);
 const {anchor}=await request.json();if(typeof anchor!=='string'||anchor.length>500||!/^(Instagram|YouTube|Spotify)\|/.test(anchor))return json({error:'Selecione o perfil que deseja excluir.'},400);
 const known=await talentBlockProfiles(env),selected=known.find(p=>blockProfileKeys(p).includes(anchor));
 if(!selected)return json({error:'Perfil não encontrado ou já excluído. Atualize a lista.'},404);
 const group=selected.blockGroup||talentBlockGroup(selected),matches=known.filter(p=>(p.blockGroup||talentBlockGroup(p))===group);
 const profiles=[...new Map(matches.map(p=>[curationKey(p),p])).values()];
 if(group.startsWith('name:')&&['Instagram','YouTube','Spotify'].some(rede=>profiles.filter(p=>p.rede===rede).length>1))return json({error:'Há contas com o mesmo nome. Revise os vínculos do talento antes de excluir.'},409);
 const keys=[...new Set(profiles.flatMap(blockProfileKeys))],bucket=env.BUCKET;
 // The block is the source of truth: registries and history remain safe from concurrent collection writes.
 for(let retry=0;retry<3;retry++){
  const index=await bucket.get('indexes/blocked-profiles.json'),blocks=index?await index.json():[];
  if(isBlockedProfile(selected,blocks))return json({error:'O perfil já foi excluído. Atualize a lista.'},409);
  const saved=await bucket.put('indexes/blocked-profiles.json',JSON.stringify([...blocks,{keys,nome:selected.nome,blockedAt:new Date().toISOString()}]),{onlyIf:new Headers(index?{'If-Match':index.httpEtag||index.etag}:{'If-None-Match':'*'})});
  if(saved)return json({blocked:profiles.length,profiles:profiles.map(({rede,url})=>({rede,url})),message:'Perfil excluído do Radar.'});
 }
 return json({error:'Não foi possível salvar a exclusão. Tente novamente.'},409);
}
async function blockProfilesApi(request,env){if(!request.headers.get('oai-authenticated-user-id'))return json({error:'Entre com sua conta para excluir perfis.'},401);const body=await request.json();if(!Array.isArray(body.profiles)||!body.profiles.length||body.profiles.length>10)return json({error:'Selecione de 1 a 10 perfis.'},400);const known=[...await readAll(env.BUCKET,'channels/'),...await readAll(env.BUCKET,'ig-profiles/'),...await historyRows(env.BUCKET)];const selected=body.profiles.map(key=>known.find(p=>blockProfileKeys(p).includes(key)));if(selected.some(p=>!p))return json({error:'Perfil não encontrado ou já bloqueado. Atualize a lista.'},400);const blocks=await blockIndex(env.BUCKET);for(const p of selected){const aliases=known.filter(q=>blockProfileKeys(q).some(k=>blockProfileKeys(p).includes(k)));const keys=[...new Set(aliases.flatMap(blockProfileKeys))];blocks.push({keys,nome:p.nome,blockedAt:new Date().toISOString()});}await env.BUCKET.put('indexes/blocked-profiles.json',JSON.stringify(blocks));for(const prefix of ['channels','ig-profiles']){const rows=await readAll(env.BUCKET,prefix+'/');await saveRegistry(env.BUCKET,prefix,rows);}return json({blocked:selected.length,message:'Perfil excluído do acompanhamento e bloqueado para novas descobertas.'});}
