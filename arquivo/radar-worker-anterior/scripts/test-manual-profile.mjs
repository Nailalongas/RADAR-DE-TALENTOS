import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const db=new Map(),bucket={get:async k=>db.has(k)?{json:async()=>structuredClone(db.get(k))}:null,put:async(k,v)=>db.set(k,JSON.parse(v)),list:async()=>({objects:[],truncated:false})};
const ctx=vm.createContext({URL,Response,Date,Intl,Map,Set,crypto:globalThis.crypto,bucket});
vm.runInContext(['worker/profile-blocks.js','worker/taxonomy.js','worker/api.js','worker/manual-profile.js'].map(p=>fs.readFileSync(p,'utf8').replace(/export /g,'')).join('\n'),ctx);
vm.runInContext(`igRead=async()=>({});reserveInstagram=async()=>0;globalThis.saved=[];saveDay=async(b,d,r)=>saved.push(...r);youtubeFetch=async()=>({items:[{id:'UC1234567890123456789012',snippet:{description:'Cantora de samba e pagode'},statistics:{subscriberCount:'120000'}}]});`,ctx);
async function call(body){ctx.body=body;const r=await vm.runInContext(`manualProfileApi({json:async()=>body},{BUCKET:bucket})`,ctx);return r.json();}
const pending=await call({action:'preview',nome:'Pessoa pendente',url:'https://www.instagram.com/pendente/?igsh=abc'});
assert.equal(pending.profile.seguidores,null);assert.equal(pending.profile.collectionState,'paused');assert.equal(db.has('indexes/ig-profiles.json'),false,'Preview must not register');
await call({action:'confirm',draftId:pending.draftId,categorias:[],subcategorias:[]});assert.equal(db.get('indexes/ig-profiles.json')[0].classificationPending,true);assert.equal(ctx.saved.length,0,'No invented zero snapshot');
assert.equal((await call({action:'confirm',draftId:pending.draftId,categorias:[],subcategorias:[]})).existing,true);assert.equal(db.get('indexes/ig-profiles.json').length,1);
const found=await call({action:'preview',nome:'Cantora',url:'https://www.youtube.com/@cantora'});assert.equal(found.profile.seguidores,120000);assert.deepEqual(found.profile.categorias,['Cantores']);assert.ok(found.profile.subcategorias.includes('Cantores|Samba e pagode'));
await call({action:'confirm',draftId:found.draftId,categorias:['Cantores'],subcategorias:['Cantores|Samba e pagode']});assert.equal(ctx.saved[0].seguidores,120000);assert.equal(db.get('indexes/channels.json')[0].selector.id,'UC1234567890123456789012');
assert.equal((await call({action:'preview',nome:'Mesmo canal',url:'https://www.youtube.com/@outroalias'})).existing,true,'Resolved ID prevents alias duplication');
ctx.bad='https://www.instagram.com/reel/123';assert.throws(()=>vm.runInContext('manualLink(bad)',ctx),/perfil/);
ctx.bad='https://evil.example/@canal';assert.throws(()=>vm.runInContext('manualLink(bad)',ctx),/youtube/i);
console.log('Manual preview, pending without zero, confirmation, automatic categories, history and deduplication passed');
