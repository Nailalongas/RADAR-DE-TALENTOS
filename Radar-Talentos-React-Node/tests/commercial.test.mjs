import test from 'node:test';import assert from 'node:assert/strict';import {openDatabase} from '../server/src/database/index.mjs';import {importCommercial,commercialQuery} from '../server/src/commercial.mjs';import {dashboardConfig} from '../server/src/event-config.mjs';import {runOperations,localDay} from '../server/src/operations.mjs';import {createRadarServer} from '../server/src/app.mjs';
const batch={authorization_ref:'fixture',artists:[{id:'a',name:'Artista teste',modalities:['shows'],accounts:[{id:'a-tk',network:'TikTok',url:'https://www.tiktok.com/@teste',identity_source:'fixture',snapshots:[{metric:'followers',observed_on:'2026-09-01',value:100,source:'fixture'},{metric:'followers',observed_on:'2026-10-01',value:200,source:'fixture'}]}]},{id:'b',name:'Outro teste',accounts:[{id:'b-tk',network:'TikTok',url:'https://www.tiktok.com/@outro',identity_source:'fixture',snapshots:[{metric:'followers',observed_on:'2026-10-01',value:100000,source:'fixture'}]}]}]};
const query=(db,extra={})=>commercialQuery(db,new URLSearchParams({network:'TikTok',end:'2026-10-01',days:'30',...extra}));
test('oportunidades: crescimento, porte, modalidade, ausência e idempotência',()=>{const db=openDatabase(':memory:');try{assert.equal(importCommercial(db,batch,{day:'2026-10-01'}),3);assert.equal(importCommercial(db,batch,{day:'2026-10-01'}),0);const d=query(db);assert.equal(d.items[0].name,'Artista teste');assert.equal(d.items[0].growth_pct,100);assert.equal(d.items[1].growth,null);assert.equal(d.comparable,1);assert.equal(query(db,{size:'large'}).items.length,1);assert.equal(query(db,{modality:'shows'}).items.length,1);assert.equal(query(db,{network:'YouTube'}).total,0);assert.throws(()=>query(db,{days:'4'}));}finally{db.close()}});
test('importação comercial atômica rejeita histórico divergente e perfil inválido',()=>{const db=openDatabase(':memory:');try{const b=structuredClone(batch);b.artists[1].accounts[0].url='https://evil.example';assert.throws(()=>importCommercial(db,b,{day:'2026-10-01'}));assert.equal(db.prepare('SELECT count(*) n FROM talents').get().n,0);importCommercial(db,batch,{day:'2026-10-01'});const c=structuredClone(batch);c.artists[0].accounts[0].snapshots[0].value=999;assert.throws(()=>importCommercial(db,c,{day:'2026-10-01'}));assert.equal(query(db).items[0].growth,100);}finally{db.close()}});
test('feed comercial TikTok automatizado e API',async()=>{const db=openDatabase(':memory:');const day=localDay();const j={id:'commercial-tiktok',kind:'metrics',commercial:true,provider:'TikTok',adapter:'https',url:'https://example.org/feed',enabled:true,scope:'fixture',authorizationRef:'fixture'};const config=dashboardConfig({enableCommercial:true,jobs:[j],allowedHosts:['example.org']});const data=structuredClone(batch);for(const a of data.artists)for(const account of a.accounts)for(const s of account.snapshots)s.observed_on=day;data.artists[0].accounts[0].snapshots.shift();const server=createRadarServer({database:db,eventsOnly:true,combinedDashboard:true});try{assert.equal((await runOperations(db,config,{fetcher:async()=>new Response(JSON.stringify(data))}))[0].state,'success');assert.equal((await runOperations(db,config,{fetcher:async()=>new Response(JSON.stringify(data))})).length,0);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;assert.equal((await fetch(base+'/commercial.html')).status,200);const r=await fetch(base+'/api/commercial?network=TikTok&end='+day);assert.equal(r.status,200);assert.equal((await r.json()).total,2);assert.equal((await fetch(base+'/api/commercial?network=invalid')).status,400);}finally{if(server.listening)await new Promise(r=>server.close(r));db.close()}});
test('Todas as mídias: consulta simultânea de Instagram, YouTube, Spotify e TikTok, crescimento consolidado normalizado sem somar métricas incompatíveis e rede de maior crescimento',()=>{
 const db=openDatabase(':memory:');
 try{
  importCommercial(db,{
   authorization_ref:'fixture-4-midias',
   artists:[
    {
     id:'art-1',
     name:'Artista Multi Rede',
     modalities:['shows'],
     accounts:[
      {id:'a1-ig',network:'Instagram',url:'https://www.instagram.com/art1',identity_source:'fixture',snapshots:[{metric:'followers',observed_on:'2026-09-01',value:10000,source:'ig'},{metric:'followers',observed_on:'2026-10-01',value:12000,source:'ig'}]},
      {id:'a1-yt',network:'YouTube',url:'https://www.youtube.com/@art1',identity_source:'fixture',snapshots:[{metric:'subscribers',observed_on:'2026-09-01',value:50000,source:'yt'},{metric:'subscribers',observed_on:'2026-10-01',value:55000,source:'yt'}]},
      {id:'a1-sp',network:'Spotify',url:'https://open.spotify.com/artist/art1',identity_source:'fixture',snapshots:[{metric:'monthly_listeners',observed_on:'2026-09-01',value:20000,source:'sp'},{metric:'monthly_listeners',observed_on:'2026-10-01',value:26000,source:'sp'}]},
      {id:'a1-tk',network:'TikTok',url:'https://www.tiktok.com/@art1',identity_source:'fixture',snapshots:[{metric:'followers',observed_on:'2026-09-01',value:8000,source:'tk'},{metric:'followers',observed_on:'2026-10-01',value:12000,source:'tk'}]}
     ]
    },
    {
     id:'art-2',
     name:'Artista Segunda Posição',
     modalities:['shows'],
     accounts:[
      {id:'a2-ig',network:'Instagram',url:'https://www.instagram.com/art2',identity_source:'fixture',snapshots:[{metric:'followers',observed_on:'2026-09-01',value:10000,source:'ig'},{metric:'followers',observed_on:'2026-10-01',value:11000,source:'ig'}]},
      {id:'a2-yt',network:'YouTube',url:'https://www.youtube.com/@art2',identity_source:'fixture',snapshots:[{metric:'subscribers',observed_on:'2026-09-01',value:10000,source:'yt'},{metric:'subscribers',observed_on:'2026-10-01',value:12000,source:'yt'}]}
     ]
    }
   ]
  },{day:'2026-10-01'});
  const allRes=commercialQuery(db,new URLSearchParams({network:'all',metric:'consolidated_growth',days:'30',end:'2026-10-01'}));
  assert.equal(allRes.network,'all');
  assert.equal(allRes.network_label,'Todas as mídias');
  assert.equal(allRes.metric,'consolidated_growth');
  assert.deepEqual(allRes.included_networks,['Instagram','YouTube','Spotify','TikTok']);
  assert.ok(allRes.networks_status.every(n=>n.included&&n.status==='Incluído na consulta'));
  assert.equal(allRes.total,2);
  const top=allRes.items[0];
  assert.equal(top.id,'art-1');
  // Crescimento individual: IG +20%, YT +10%, SP +30%, TK +50% -> média normalizada = 27.5%
  assert.equal(top.networks.Instagram.growth_pct,20);
  assert.equal(top.networks.YouTube.growth_pct,10);
  assert.equal(top.networks.Spotify.growth_pct,30);
  assert.equal(top.networks.TikTok.growth_pct,50);
  assert.equal(top.top_network,'TikTok');
  assert.equal(top.top_network_growth_pct,50);
  assert.equal(top.growth_pct,27.5);
  // Não soma seguidores + inscritos + ouvintes mensais
  assert.notEqual(top.value,12000+55000+26000+12000);
  assert.equal(top.value,12000);
 }finally{
  db.close();
 }
});
