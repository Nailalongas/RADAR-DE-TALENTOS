import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {openDatabase} from '../server/src/database/index.mjs';
import {eventQuery} from '../server/src/events.mjs';
test('amostra rastreável importa sem duplicar e sem declarar cobertura ou audiência',()=>{
 const dir=mkdtempSync(join(tmpdir(),'radar-observed-'));
 const path=join(dir,'radar.sqlite');try{
 const env={...process.env,RADAR_DATABASE_PATH:path};for(let i=0;i<2;i++)execFileSync(process.execPath,['--experimental-sqlite','scripts/load-observed.mjs'],{env,stdio:'pipe'});
 const db=openDatabase(path);try{
 const query=(extra='')=>eventQuery(db,'/api/events/trends',new URLSearchParams('start=2026-11-18&end=2026-11-18&basis=first_seen&'+extra));const r=query();
 assert.equal(r.total,19);assert.equal(r.listings,21);assert.equal(r.artists.length,15);assert.equal(r.byRegion.length,5);assert.equal(query('center=4106902&radius=50').total,4);
 assert.equal(db.prepare('SELECT count(*) n FROM regional_audience').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM operation_event_observations').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM event_listings WHERE published_on IS NOT NULL').get().n,0);
 assert.equal(eventQuery(db,'/api/events/platforms',new URLSearchParams()).reduce((n,p)=>n+p.manual_records,0),21);
 }finally{db.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
