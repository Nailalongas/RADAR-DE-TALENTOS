import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx=vm.createContext({URL,Response,Map,Set,Date,Intl,crypto:globalThis.crypto});
vm.runInContext(fs.readFileSync('worker/api.js','utf8').replace(/export /g,''),ctx);
const source=new Map([['youtube-instagram-links/a.json',{etag:'a1',value:{links:[{username:'ana'}]}}],['youtube-instagram-links/b.json',{etag:'b1',value:{links:[{username:'bia'}]}}]]);
let cache=null,reads=0;
ctx.bucket={
 list:async()=>({objects:[...source].map(([key,v])=>({key,etag:v.etag})),truncated:false}),
 get:async key=>{if(key.startsWith('indexes/'))return cache?{json:async()=>structuredClone(cache)}:null;reads++;const v=source.get(key);return v?{json:async()=>structuredClone(v.value)}:null;},
 put:async(key,body)=>{cache=JSON.parse(body);}
};
const run=()=>vm.runInContext("readAll(bucket,'youtube-instagram-links/')",ctx);
const names=rows=>Array.from(rows,r=>r.links[0].username);
assert.deepEqual(names(await run()),['ana','bia']);assert.equal(reads,2);
assert.deepEqual(names(await run()),['ana','bia']);assert.equal(reads,2,'unchanged links are read from index');
source.set('youtube-instagram-links/a.json',{etag:'a2',value:{links:[{username:'ana_nova'}]}});
source.delete('youtube-instagram-links/b.json');
source.set('youtube-instagram-links/c.json',{etag:'c1',value:{links:[{username:'carla'}]}});
assert.deepEqual(names(await run()),['ana_nova','carla']);assert.equal(reads,4);
ctx.bucket.put=async()=>{throw Error('temporary cache write failure')};
source.set('youtube-instagram-links/c.json',{etag:'c2',value:{links:[{username:'carla_nova'}]}});
assert.deepEqual(names(await run()),['ana_nova','carla_nova'],'cache failure cannot hide source records');
console.log('Link index reuses unchanged records and reflects additions, changes, deletions and cache-write failures');
