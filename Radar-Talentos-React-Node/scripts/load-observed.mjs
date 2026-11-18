import {readFileSync} from 'node:fs';
import {openDatabase} from '../server/src/database/index.mjs';
import {importEvents} from '../server/src/events.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../samples/observed/'+name+'.json',import.meta.url),'utf8'));
const db=openDatabase();try{
 const rows=read('municipalities');
 db.exec('BEGIN IMMEDIATE');try{const ins=db.prepare('INSERT OR IGNORE INTO municipalities(code,name,uf,region,lat,lon,source,version,coordinate_source,coordinate_version) VALUES(?,?,?,?,?,?,?,?,?,?)');for(const r of rows)ins.run(r.code,r.name,r.uf,r.region,r.lat,r.lon,r.source,'amostra-2026-11-18',r.coordinate_source,'sede municipal aproximada');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 for(const name of ['sympla','eventim','ticketsports','ticket360']){const batch=read(name);const items=batch.items.filter(x=>!db.prepare('SELECT 1 FROM event_listings WHERE platform_id=? AND external_id=?').get(name,x.external_id));if(items.length)console.log(name,importEvents(db,{...batch,items}));else console.log(name,'já importado');}
 console.log('Amostra manual parcial; não é coleta contínua nem cobertura nacional.');
}finally{db.close();}
