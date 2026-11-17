import {readFile} from 'node:fs/promises';
import {openDatabase} from '../server/src/database/index.mjs';
import {importAudience,fetchYouTubeReport} from '../server/src/audience.mjs';
const [mode,file]=process.argv.slice(2);if(!['report','cities','youtube'].includes(mode)||!file)throw Error('Uso: npm run audience:import -- report|cities|youtube arquivo.json');
const input=JSON.parse(await readFile(file,'utf8'));const db=openDatabase();try{
 if(mode==='cities'){
  if(!Array.isArray(input)||!input.length)throw Error('Mapa vazio');db.exec('BEGIN IMMEDIATE');try{for(const r of input){if(!['YouTube','Instagram','Spotify'].includes(r.network)||typeof r.external_city!=='string'||!r.external_city.trim()||typeof r.evidence!=='string'||!r.evidence.trim())throw Error('Mapeamento inválido');db.prepare('INSERT INTO audience_city_map VALUES(?,?,?,?) ON CONFLICT(network,external_city) DO UPDATE SET municipality_code=excluded.municipality_code,evidence=excluded.evidence').run(r.network,r.external_city,String(r.municipality_code),r.evidence);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}console.log(`${input.length} mapeamentos`);
 }else{
  let report=input;if(mode==='youtube'){
   const a=db.prepare("SELECT external_id FROM social_accounts WHERE id=? AND network='YouTube' AND identity_confirmed=1").get(input.account_id);if(!a?.external_id||typeof input.authorization_ref!=='string'||!input.authorization_ref.trim()||typeof input.report_ref!=='string'||!input.report_ref.trim())throw Error('Canal confirmado e referências obrigatórios');
   const rows=await fetchYouTubeReport({channel:a.external_id,token:process.env.YOUTUBE_ACCESS_TOKEN,start:input.period_start,end:input.period_end});report={...input,network:'YouTube',metric:'views',quality:'verified',coverage:'partial',rows};
  }console.log(JSON.stringify(importAudience(db,report),null,2));
 }
}finally{db.close();}
