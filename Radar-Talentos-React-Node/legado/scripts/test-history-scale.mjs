import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=['worker/api.js','worker/curation.js','worker/coverage.js'].map(p=>fs.readFileSync(p,'utf8').replace(/export /g,'')).join('\n');
const ctx=vm.createContext({URL,Map,Set,Date,Intl,crypto:globalThis.crypto});
vm.runInContext(source,ctx);
const rows=[],records=[];
for(let i=0;i<1500;i++){
 const id='UC'+String(i).padStart(22,'0');
 for(let d=1;d<=15;d++)rows.push({nome:'Talento '+i,rede:'YouTube',url:'https://www.youtube.com/channel/'+id,data:'2026-10-'+String(d).padStart(2,'0'),seguidores:100000+d,categorias:['Artistas']});
 records.push({links:[{youtubeChannelId:id,username:'artista'+i}]});
}
ctx.rows=rows;ctx.records=records;
const start=performance.now();
const result=vm.runInContext('includeYoutubeInstagramLinks(rows,records)',ctx,{timeout:5000});
assert.equal(result.length,24000);
assert.equal(result.filter(r=>r.rede==='Instagram').length,1500);
assert.equal(result.find(r=>r.rede==='Instagram').seguidores,null);
assert.equal(vm.runInContext('includeYoutubeInstagramLinks(rows,records).length',ctx),24000);
console.log('History join: 22,500 snapshots + 1,500 official links, '+Math.round(performance.now()-start)+' ms; pending links preserved without fabricated counts');
