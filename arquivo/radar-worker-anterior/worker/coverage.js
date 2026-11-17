function talentCategories(row){
const found=new Set((row.categorias||[row.categoria]).filter(c=>categories.includes(c)));
if(row.categoryReviewed)return [...found];
const text=String((row.nome||'')+' '+(row.description||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const terms={Cantores:/\b(cantor|cantora|cantores|singer|compositor|compositora)\b/,Humoristas:/\b(humorista|comediante|comediantes|stand up|stand-up)\b/,Palestrantes:/\b(palestrante|palestrantes|speaker)\b/,Artistas:/\b(ator|atriz|atores|atrizes|ilusionista|dan[cç]arino|dan[cç]arina)\b/,Influenciadores:/\b(influenciador|influenciadora|criador de conteudo|criadora de conteudo|digital influencer)\b/};
for(const [c,re]of Object.entries({...terms,...eventCategoryTerms}))if(re.test(text))found.add(c);
const topics=row.subcategorias||[];
if(topics.includes('Cantores|Música infantil'))found.add('Infantil e família');
if(topics.includes('Influenciadores|Gastronomia'))found.add('Gastronomia');
return [...found];
}
function identityName(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' e ').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().replace(/^(?:(?:banda|dupla|canal|oficial|official)\s+)+/,'').replace(/(?:\s*(?:vevo|oficial|official))+$/,'').trim();}
function channelInstagramLinks(item){return [...new Set([...instagramLinks(item.snippet?.description),...(item.aboutLinks||[]).map(v=>v.username),...(item.videoLinks||[]).map(v=>v.username),...(item.websiteLinks||[]).map(v=>v.username)])];}
function officialChannelInstagramLinks(item){const description=instagramLinks(item.snippet?.description),directDescription=description.length===1?description:[];return [...new Set([...directDescription,...(item.aboutLinks||[]).map(v=>v.username),...(item.websiteLinks||[]).map(v=>v.username)])];}
async function saveYoutubeInstagramLinks(env,details,channels){let found=0;for(const item of details){const usernames=officialChannelInstagramLinks(item);if(!usernames.length)continue;const channel=channels.get(item.id);const links=usernames.map(username=>({username,nome:channel?.nome||item.snippet?.title,youtubeChannelId:item.id,categorias:channel?.categorias||[channel?.categoria],sourceUrl:'https://www.youtube.com/channel/'+item.id,foundAt:new Date().toISOString()}));await env.BUCKET.put('youtube-instagram-links/'+item.id+'.json',JSON.stringify({links}));found+=links.length;}return found;}
function includeYoutubeInstagramLinks(rows,records){
const result=[...rows],byProfile=new Map();
for(const row of result){const key=curationKey(row);if(!byProfile.has(key))byProfile.set(key,[]);byProfile.get(key).push(row);}
for(const record of records)for(const link of record.links||[]){
const youtube=byProfile.get(curationKey({rede:'YouTube',url:'https://www.youtube.com/channel/'+link.youtubeChannelId}));if(!youtube?.length)continue;
const anchor=youtube[0],personId=anchor.personId||'youtube:'+link.youtubeChannelId;for(const r of youtube)r.personId=personId;
const url='https://www.instagram.com/'+link.username+'/',key=curationKey({rede:'Instagram',url}),existing=byProfile.get(key);
if(existing?.length){for(const r of existing)if(!r.categoryReviewed){r.personId=personId;r.nome=anchor.nome;r.identityConfirmed=true;}continue;}
const row={nome:anchor.nome,originalName:link.username,categoria:anchor.categoria,categorias:anchor.categorias,entityType:anchor.entityType,personId,rede:'Instagram',url,data:'',seguidores:null,collectionPending:true,identityConfirmed:true,sourceUrl:link.sourceUrl,provider:'Link no perfil do YouTube'};result.push(row);byProfile.set(key,[row]);
}return result;}
async function enqueueYoutubeInstagramLinks(env){const profiles=await readAll(env.BUCKET,'ig-profiles/'),records=await readAll(env.BUCKET,'youtube-instagram-links/'),byName=new Map(profiles.map(p=>[p.username.toLowerCase(),p]));let added=0;for(const link of records.flatMap(r=>r.links||[])){const username=String(link.username||'').toLowerCase();if(!/^[a-z0-9._]{1,30}$/.test(username))continue;let profile=byName.get(username);if(!profile){const selected=(link.categorias||[]).filter(c=>categories.includes(c));profile={username,nome:link.nome||username,categoria:selected[0]||'Artistas',categorias:selected.length?selected:['Artistas'],sourceUrl:link.sourceUrl,identityConfirmed:true,identityEvidence:'official-youtube-instagram-link',collectionState:'queued',queuedAt:new Date().toISOString()};profiles.push(profile);byName.set(username,profile);added++;}profile.linkedYoutubeChannelIds=[...new Set([profile.linkedYoutubeChannelId,...(profile.linkedYoutubeChannelIds||[]),link.youtubeChannelId].filter(Boolean))];}await saveRegistry(env.BUCKET,'ig-profiles',profiles);return {profiles,added};}
async function refreshYoutubeInstagramLinks(env){
const date=igDate(),key='ig-link-refresh/'+date+'.json',previous=await env.BUCKET.get(key),state=previous?await previous.json():{date,checked:[],linkedChannels:[],links:0,withoutLink:0,failed:[]},channels=await readAll(env.BUCKET,'channels/'),all=new Map(channels.filter(c=>/^UC[\w-]{22}$/.test(c.selector?.id||'')).map(c=>[c.selector.id,{...c,id:c.selector.id}])),done=new Set(state.checked),batch=[...all.values()].filter(c=>!done.has(c.id)).slice(0,50);
if(batch.length){const response=await youtubeFetch(env,'channels',{part:'snippet',id:batch.map(c=>c.id).join(',')}),details=new Map((response.items||[]).map(c=>[c.id,c]));let next=0;await Promise.all(Array.from({length:Math.min(8,batch.length)},async()=>{while(next<batch.length){const c=batch[next++],item=details.get(c.id);if(!item){state.failed.push({channelId:c.id,nome:c.nome,error:'Canal indisponível na consulta ao YouTube.'});state.checked.push(c.id);continue;}item.aboutLinks=await findYoutubeAboutInstagram(env,item);const found=officialChannelInstagramLinks(item);if(found.length){const count=await saveYoutubeInstagramLinks(env,[item],all);state.links+=count;state.linkedChannels.push(c.id);}else{const cached=await env.BUCKET.get('ig-youtube-about-v2/'+date+'-'+c.id+'.json');if(!cached)state.failed.push({channelId:c.id,nome:c.nome,error:'Não foi possível ler os links públicos do perfil do canal.'});else state.withoutLink++;}state.checked.push(c.id);}}));}
state.total=all.size;state.remaining=[...all.keys()].filter(id=>!state.checked.includes(id)).length;state.updatedAt=new Date().toISOString();await env.BUCKET.put(key,JSON.stringify(state));return {date,total:state.total,checked:state.checked.length,linkedChannels:state.linkedChannels.length,links:state.links,withoutLink:state.withoutLink,remaining:state.remaining,failed:state.failed};
}
function youtubeAboutInstagram(html){
const match=String(html).match(/(?:var\s+ytInitialData\s*=|window\["ytInitialData"\]\s*=)\s*/);if(!match)return [];
const start=match.index+match[0].length;let depth=0,quoted=false,escaped=false,end=start;
for(;end<html.length;end++){const c=html[end];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){end++;break;}}
let root;try{root=JSON.parse(html.slice(start,end));}catch{return [];}
const found=new Set();function links(value){if(typeof value==='string'){let s=value;for(let i=0;i<2;i++)try{const d=decodeURIComponent(s);if(d===s)break;s=d;}catch{break;}for(const u of instagramLinks(s))found.add(u);}else if(value&&typeof value==='object')for(const v of Object.values(value))links(v);}
function walk(value){if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if(['channelExternalLinkViewModel','aboutChannelViewModel','channelAboutFullMetadataRenderer'].includes(k))links(v);else walk(v);}}walk(root);return [...found];
}
async function findYoutubeAboutInstagram(env,item){
if(!/^UC[\w-]{22}$/.test(item.id))return [];const key='ig-youtube-about-v2/'+igDate()+'-'+item.id+'.json',cached=await env.BUCKET.get(key);if(cached)return (await cached.json()).links||[];
const url='https://www.youtube.com/channel/'+item.id+'/about';try{const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html','Accept-Language':'pt-BR,pt;q=0.9'}});if(!response.ok||!['youtube.com','www.youtube.com','m.youtube.com'].includes(new URL(response.url||url).hostname))throw Error('Página pública indisponível');const reader=response.body.getReader(),decoder=new TextDecoder();let html='',size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4500000)break;html+=decoder.decode(value,{stream:true});}}finally{await reader.cancel();}const links=youtubeAboutInstagram(html).map(username=>({username,sourceUrl:url}));await env.BUCKET.put(key,JSON.stringify({links}));return links;}catch{return [];}
}
function instagramNameVariants(name){const clean=identityName(name),words=clean.split(' ').filter(Boolean),compact=words.join('');if(compact.length<5)return [];const bases=[compact,words.join('.'),words.join('_')];if(words.includes('e'))bases.push(words.filter(w=>w!=='e').join(''));return [...new Set([...bases,...bases.flatMap(b=>[b+'oficial',b+'.oficial',b+'_oficial']),compact+'official',compact+'music'])].filter(s=>/^[a-z0-9._]{1,30}$/.test(s));}
async function findWebsiteInstagram(env,item){
const cacheKey='ig-website-links/'+igDate()+'-'+item.id+'.json',cached=await env.BUCKET.get(cacheKey);if(cached)return (await cached.json()).links||[];
const urls=[];for(const m of String(item.snippet?.description||'').matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gi)){try{const value=m[0].replace(/[),;.!]+$/,'').replace(/^http:/,'https:'),url=publicSourceUrl(value.startsWith('www.')?'https://'+value:value),u=new URL(url);if(/(^|\.)(youtu\.be|youtube\.com|instagram\.com|facebook\.com|fb\.com|twitter\.com|x\.com|tiktok\.com|spotify\.com|whatsapp\.com|wa\.me|google\.com|apple\.com)$/.test(u.hostname))continue;if(!urls.includes(url))urls.push(url);}catch{}}
const links=[];for(const url of urls.slice(0,2)){try{const page=await sourceHtml(url),plain=identityName(page.html.replace(/<[^>]*>/g,' ')),name=identityName(item.snippet?.title);if(name.length<3||!plain.includes(name))continue;for(const username of instagramLinks(page.html.replace(/&amp;/g,'&').replace(/\\\//g,'/')))if(!links.some(x=>x.username===username))links.push({username,sourceUrl:page.url});}catch{}}
await env.BUCKET.put(cacheKey,JSON.stringify({links}));return links;
}
function sameTalentIdentity(a,b){const blocked=/\b(fa|fas|fan|fans|cover|covers|tributo|tribute|homenagem|cortes|clips|clipes|noticias)\b/i;if(blocked.test(String(a).normalize('NFD').replace(/[\u0300-\u036f]/g,''))||blocked.test(String(b).normalize('NFD').replace(/[\u0300-\u036f]/g,'')))return false;const x=identityName(a),y=identityName(b);if(!x||!y)return false;if(x===y)return true;const duo=s=>s.split(' e ').map(x=>x.trim()).sort();const u=duo(x),v=duo(y);return u.length===2&&v.length===2&&u.every((p,i)=>p&&p===v[i]);}
// Explicit associations reviewed against official channels; follower counts always come from Meta.
const confirmedTalentLinks=[
 {nome:'Giuliana Mafra',username:'giulianamafra',youtubeChannelId:'UCcO3pf47GO1rxL4tlWEs5Ow',categorias:['Influenciadores'],identitySource:'https://link.me/giulianamafra',instagramPortugueseSource:'https://link.me/giulianamafra'},
 {nome:'Natiruts',username:'natirutsoficial',youtubeChannelId:'UCfguI5bxcFwOjuD3qti4FAw',categorias:['Cantores']},
 {nome:'Anitta',username:'anitta',youtubeChannelId:'UCqjjyPUghDSSKFBABM_CXMw',categorias:['Cantores'],identitySource:'https://linktr.ee/anitta.links',portugueseSource:'https://www.youtube.com/watch?v=PSB7uxRtpaU'},
 {
  nome:'Larissa Manoela',username:'larissamanoela',youtubeChannelId:'UCUswnfUeQPODX5xlGn8ND9w',categorias:['Artistas'],
  identitySource:'https://www.youtube.com/channel/UCUswnfUeQPODX5xlGn8ND9w',
  portugueseSource:'https://www.youtube.com/channel/UCUswnfUeQPODX5xlGn8ND9w',
  instagramPortugueseSource:'https://imginn.com/p/De9rb_ztc2z/'
 },
 {
  nome:'Felipe Neto',username:'felipeneto',youtubeChannelId:'UCV306eHqgo0LvBf3Mh36AHg',categorias:['Influenciadores'],
  identitySource:'https://www.youtube.com/watch?v=bgIA5DZwV4s',
  instagramPortugueseSource:'https://www.estrelando.com.br/foto/2025/02/02/felipe-neto-anuncia-noivado-com-juliane-carvalho-nunca-tive-tanta-certeza-de-algo-na-minha-vida-331363'
 },
 {
  nome:'CazéTV',username:'cazetv',youtubeChannelId:'UCZiYbVptd3PVPf4f6eR6UaQ',categorias:['Artistas','Influenciadores'],
  identitySource:'https://linktr.ee/VemPraCazeTV',
  instagramPortugueseSource:'https://gondola.cc/posts/31761374-cazetv-instagram'
 },
 {
  nome:'Emilly Vick',username:'emillyvickof',youtubeChannelId:'UC63iwP6BtIjxB6xn1GKR6Lw',categorias:['Cantores','Influenciadores'],
  identitySource:'https://linktr.ee/EmillyVick',
  instagramPortugueseSource:'https://viralist.ai/instagram/creators/emillyvickof'
 }
];
function associateTalentRows(rows,registry){const links=[...registry.filter(p=>p.username&&(p.linkedYoutubeChannelId||p.linkedYoutubeChannelIds?.length)).flatMap(p=>[...new Set([p.linkedYoutubeChannelId,...(p.linkedYoutubeChannelIds||[])].filter(Boolean))].map(id=>({nome:p.nome,username:p.username,youtubeChannelId:id}))),...confirmedTalentLinks],lookup=new Map();for(const link of links){lookup.set(curationKey({rede:'Instagram',url:'https://www.instagram.com/'+link.username+'/'}),link);lookup.set(curationKey({rede:'YouTube',url:'https://www.youtube.com/channel/'+link.youtubeChannelId}),link);}return rows.map(r=>{if(r.personId)return r;const link=lookup.get(curationKey(r));return link?{...r,nome:link.nome,personId:'verified-instagram:'+link.username.toLowerCase(),identityConfirmed:true}:r;});}

const REGISTERED_REVIEW_KEY='indexes/registered-network-review.json',REGISTERED_REVIEW_REPORT='registered-network-review/last-run.json';
const REGISTERED_CHANNELS_PER_REVIEW=36,REGISTERED_YOUTUBE_SEARCHES_PER_REVIEW=4;
async function registeredReviewState(bucket){const o=await bucket.get(REGISTERED_REVIEW_KEY);return o?await o.json():{checks:{},lastRun:null};}
async function reviewRegisteredNetworks(env){
 const bucket=env.BUCKET,leaseKey='registered-network-review/lease.json',lease=await bucket.get(leaseKey);
 if(lease&&(await lease.json()).expiresAt>Date.now())return {paused:true,reason:'Revisão em andamento.'};
 const onlyIf=new Headers(lease?{'If-Match':lease.httpEtag||lease.etag}:{'If-None-Match':'*'});
 if(!await bucket.put(leaseKey,JSON.stringify({expiresAt:Date.now()+180000}),{onlyIf}))return {paused:true,reason:'Revisão já reservada.'};
 try{
  const [channels,instagram,state]=await Promise.all([readAll(bucket,'channels/'),readAll(bucket,'ig-profiles/'),registeredReviewState(bucket)]);
  const now=Date.now(),blocked=await blockIndex(bucket),byHandle=new Map(instagram.map(p=>[p.username.toLowerCase(),p])),pool=[...new Map(channels.filter(c=>/^UC[\w-]{22}$/.test(c.selector?.id||'')).map(c=>[c.selector.id,c])).entries()];
  const eligible=pool.filter(([id])=>now-(state.checks[id]?.at||0)>90*86400000&&(state.checks[id]?.retryAt||0)<=now).sort(([a],[b])=>(state.checks[a]?.at||0)-(state.checks[b]?.at||0));
  if(state.retryAfter>now)return {paused:true,retryAfter:new Date(state.retryAfter).toISOString(),...state.lastRun};
  const report={registeredYoutube:pool.length,registeredInstagram:instagram.length,checked:0,linksInstagram:0,linksSpotify:0,unavailable:0,paused:false,at:new Date(now).toISOString()};
  for(let i=0;i<Math.min(REGISTERED_CHANNELS_PER_REVIEW,eligible.length)&&!report.paused&&Date.now()-now<45000;i+=3){
   await Promise.all(eligible.slice(i,i+3).map(async([id,c])=>{
    const url='https://www.youtube.com/channel/'+id,old=state.checks[id]||{};
    try{
     const response=await fetch(url+'/about',{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Accept:'text/html'}});
     if([403,429].includes(response.status)){report.paused=true;state.retryAfter=now+3600000;return;}
     if(!response.ok)throw Error('Página indisponível');
     const html=await response.text();if(!spotifyYoutubeMetadata(html,url))throw Error('Identidade do canal indisponível');
     const spotify=spotifyYoutubeIdentity(html,url,c.nome),handles=youtubeAboutInstagram(html),username=handles.length===1?handles[0]:null,ig=username&&byHandle.get(username);
     const compact=s=>identityName(s).replace(/[\s_.]/g,''),sameHandle=username&&compact(c.nome)===compact(username);
     if(username&&!isBlockedProfile({username,rede:'Instagram'},blocked)&&(ig?sameTalentIdentity(c.nome,ig.nome||ig.username)&&![ig.linkedYoutubeChannelId,...(ig.linkedYoutubeChannelIds||[])].filter(Boolean).some(x=>x!==id):sameHandle)){
      const key='youtube-instagram-links/'+id+'.json',record=await bucket.get(key),links=record?(await record.json()).links||[]:[];
      if(!links.length){await bucket.put(key,JSON.stringify({links:[{username,nome:c.nome,youtubeChannelId:id,categorias:c.categorias||[c.categoria],sourceUrl:url+'/about',foundAt:report.at}]}));report.linksInstagram++;}
     }
     const artistId=spotify?.artistId&&(c.categorias||[c.categoria]).includes('Cantores')?spotify.artistId:null;
     if(artistId&&old.artistId!==artistId)report.linksSpotify++;
     state.checks[id]={at:now,artistId};report.checked++;
    }catch{state.checks[id]={...old,retryAt:now+86400000};report.unavailable++;}
   }));
  }
  report.reviewed=pool.filter(([id])=>state.checks[id]?.at).length;report.remaining=pool.length-report.reviewed;state.lastRun=report;
  await bucket.put(REGISTERED_REVIEW_KEY,JSON.stringify(state));return report;
 }finally{await bucket.delete(leaseKey);}
}
function prioritizeCategories(selected,profiles){return [...selected].sort((a,b)=>profiles.filter(p=>talentCategories(p).includes(a)).length-profiles.filter(p=>talentCategories(p).includes(b)).length||categories.indexOf(a)-categories.indexOf(b));}
async function completeYoutubeLinks(env){
const report={checked:0,added:0,associated:0,failed:[],warnings:[]};if(!await youtubeKey(env))return report;
const date=igDate(),[channels,profiles,records,blocked]=await Promise.all([readAll(env.BUCKET,'channels/'),readAll(env.BUCKET,'ig-profiles/'),readAll(env.BUCKET,'youtube-instagram-links/'),blockIndex(env.BUCKET)]),known=new Map(channels.map(c=>[c.selector?.id||c.id,c]));
const associations=new Map([...records.flatMap(r=>r.links||[]),...confirmedTalentLinks].filter(r=>known.has(r.youtubeChannelId)).map(r=>[r.youtubeChannelId,r.username.toLowerCase()]));
const linked=new Set(associations.values());
const candidates=profiles.filter(p=>p.username&&!linked.has(p.username.toLowerCase())&&![p.linkedYoutubeChannelId,...(p.linkedYoutubeChannelIds||[])].some(id=>known.has(id))&&identityName(p.nome).length>=3&&suggestedEntity(p.nome)!=='organization').sort((a,b)=>a.username.localeCompare(b.username));
const progress=await env.BUCKET.get('cross-network/youtube-progress.json'),state=progress?await progress.json():{},quotaKey='base-budget/'+date+'.json',q=await env.BUCKET.get(quotaKey),budget=q?await q.json():{calls:0};
const rows=[];
const offset=Math.max(0,candidates.findIndex(p=>p.username.localeCompare(state.after||'')>0));
for(let i=0;i<candidates.length&&i<30&&report.checked<REGISTERED_YOUTUBE_SEARCHES_PER_REVIEW&&budget.calls<YOUTUBE_SEARCH_BUDGET&&(budget.reviewCalls||0)<YOUTUBE_REVIEW_SEARCH_RESERVE;i++){
const p=candidates[(offset+i)%candidates.length],attempt='cross-network/youtube-attempts/'+p.username+'.json',old=await env.BUCKET.get(attempt);state.after=p.username;if(old&&(await old.json()).date===date)continue;
try{budget.calls++;budget.reviewCalls=(budget.reviewCalls||0)+1;await env.BUCKET.put(quotaKey,JSON.stringify(budget));report.checked++;const search=await youtubeFetch(env,'search',{part:'snippet',type:'channel',q:p.nome,maxResults:'5',relevanceLanguage:'pt',safeSearch:'moderate'}),ids=(search.items||[]).map(x=>x.id?.channelId).filter(Boolean);if(!ids.length)continue;
const details=await youtubeFetch(env,'channels',{part:'snippet,statistics',id:ids.join(',')});
const username=p.username.toLowerCase();
const matches=(details.items||[]).filter(item=>/^UC[\w-]{22}$/.test(item.id||'')&&!isBlockedProfile({id:item.id,rede:'YouTube'},blocked)&&sameTalentIdentity(item.snippet?.title,p.nome)&&officialChannelInstagramLinks(item).length===1&&officialChannelInstagramLinks(item)[0]===username&&(!associations.has(item.id)||associations.get(item.id)===username));
if(matches.length!==1)continue;
const item=matches[0],followers=Number(item.statistics?.subscriberCount),existing=known.get(item.id);if(!existing&&(channels.length>=BASE_LIMIT||item.statistics?.hiddenSubscriberCount||!Number.isFinite(followers)))continue;
const cats=talentCategories(p),c=existing||{id:item.id,nome:p.nome,categoria:cats[0],categorias:cats,url:'https://www.youtube.com/channel/'+item.id,selector:{id:item.id},description:item.snippet.description||'',categorySuggested:true,discoveredAt:new Date().toISOString(),discoverySource:'instagram-official-link'};
if(!existing){channels.push(c);known.set(item.id,c);rows.push({nome:c.nome,categoria:c.categoria,categorias:cats,rede:'YouTube',data:date,seguidores:followers,url:c.url,channelId:item.id,provider:'YouTube Data API',rounded:true,collectedAt:new Date().toISOString(),categorySuggested:true});report.added++;}
await saveYoutubeInstagramLinks(env,[item],known);associations.set(item.id,username);linked.add(username);report.associated++;
}catch(e){report.failed.push({username:p.username,error:e.message});break;}finally{await env.BUCKET.put(attempt,JSON.stringify({date}));}}
await env.BUCKET.put('cross-network/youtube-progress.json',JSON.stringify(state));if(rows.length){await saveRegistry(env.BUCKET,'channels',channels);await saveDay(env.BUCKET,date,rows);}report.remaining=candidates.filter(p=>!linked.has(p.username.toLowerCase())).length;return report;
}
async function completeRegisteredNetworkReview(env,url){
 const review=await reviewRegisteredNetworks(env);if(review.paused)return review;
 let youtube;try{youtube=await completeYoutubeLinks(env);}catch(e){youtube={error:e.message};}
 // Use the existing Spotify lease, identity checks and hourly budget for the extra batch.
 let spotify;try{
  let response=await spotifyPublicApi(new Request(url,{method:'POST',body:JSON.stringify({mode:'new',comparisonOnly:true,limit:5})}),env),batch=await response.json();
  if(!batch.paused&&!batch.error&&batch.requested===0){response=await spotifyPublicApi(new Request(url,{method:'POST',body:JSON.stringify({mode:'new',verifiedOnly:true,limit:5})}),env);batch=await response.json();}
  spotify={requested:batch.requested||0,collected:batch.collected||0,paused:!!batch.paused,retryAfter:batch.retryAfter,failed:batch.failed||[],...(batch.error?{error:batch.error}:{})};
 }catch(e){spotify={error:e.message};}
 const result={...review,youtube,spotify};await env.BUCKET.put(REGISTERED_REVIEW_REPORT,JSON.stringify(result));return result;
}
