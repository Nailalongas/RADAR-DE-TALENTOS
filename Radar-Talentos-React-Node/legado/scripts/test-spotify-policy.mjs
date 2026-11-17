import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('worker/spotify-config.js','utf8');
let clock='2026-11-11T12:00:00Z',starts=0;const store=new Map();
class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}}
const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
const bucket={get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v,o)=>{if(o?.onlyIf?.get('If-None-Match')==='*'&&store.has(k))return null;store.set(k,v);return {etag:'test'};},delete:async k=>store.delete(k)};
function context(){const c=vm.createContext({Date:Clock,Intl,Request,Response,Headers,AbortSignal,TextDecoder,TextEncoder,URL,json,bytes:()=>new Uint8Array(),encryptionKey:async()=>({}),crypto:{subtle:{decrypt:async()=>new TextEncoder().encode('fake-test-token')}},readAll:async(b,p)=>[...store].filter(([k])=>k.startsWith(p)).map(([,v])=>JSON.parse(v)),fetch:async(u,o)=>{starts++;assert.match(u,/maxTotalChargeUsd=0.03/);assert.ok(JSON.parse(o.body).artists.length<=10);return json({data:{id:'run1'}});}});vm.runInContext(source,c);return c;}
store.set('config/apify-token.json','{}');store.set('channels/a.json',JSON.stringify({nome:'Artista A',categoria:'Cantores',contentLanguage:'pt'}));
const a=context(),b=context();
await Promise.all([a.spotifySyncApi(new Request('https://test/api/spotify/sync',{method:'POST'}),{BUCKET:bucket}),b.spotifySyncApi(new Request('https://test/api/spotify/sync',{method:'POST'}),{BUCKET:bucket})]);
assert.equal(starts,1,'atomic reservation prevents concurrent paid starts across isolates');
a.spotifyReadApify=async()=>({data:{status:'RUNNING'}});await a.spotifySyncApi(new Request('https://test',{method:'POST'}),{BUCKET:bucket});assert.equal(starts,1,'pending run never triggers another');
store.clear();clock='2026-11-06T12:00:00Z';let r=await context().spotifySyncApi(new Request('https://test',{method:'POST'}),{BUCKET:bucket});assert.match((await r.json()).reason,/1, 11 ou 21/);assert.equal(starts,1,'off-schedule request starts nothing');
store.clear();clock='2026-11-11T12:00:00Z';store.set('spotify/reservations/2026-11/a.json',JSON.stringify({maxChargeUsd:.09}));r=await context().spotifySyncApi(new Request('https://test',{method:'POST'}),{BUCKET:bucket});assert.match((await r.json()).reason,/Orçamento/);assert.equal(starts,1,'monthly reserved cap blocks start');
const candidate=context().spotifyCandidateBatch([{artistId:'abc',name:'Artista A',url:'https://open.spotify.com/artist/abc',date:'2026-11-01'}],[{nome:'Artista A',categoria:'Cantores'},{nome:'Nome divergente',categoria:'Cantores'},{nome:'Página',categoria:'Cantores',entityType:'organization'},{nome:'New Singer',categoria:'Cantores',contentLanguage:'en'},{nome:'Novo',categoria:'Cantores',contentLanguage:'pt'}],[{input:'Nome divergente'}]);
assert.deepEqual(Array.from(candidate.artists),['Novo','https://open.spotify.com/artist/abc'],'known links prioritized, mismatched inputs and foreign/organization candidates excluded');
console.log('PASS Spotify: schedule guard, atomic concurrency, monthly budget reservation, pending-run protection, candidate identity and priority');

const prioritized=context().spotifyCandidateBatch([{artistId:'abc',name:'Já completo',url:'https://open.spotify.com/artist/abc',date:'2026-11-01'}],Array.from({length:15},(_,i)=>({nome:'Artista '+i,categoria:'Cantores'})),[]);assert.equal(prioritized.missingSpotify,8);assert.equal(prioritized.refreshSpotify,1);assert.equal(prioritized.artists.length,9);console.log('PASS: 80% reserved for registered artists missing Spotify, deduplicated across registries');
