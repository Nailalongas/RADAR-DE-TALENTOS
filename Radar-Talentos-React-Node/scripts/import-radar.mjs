import { readFile } from 'node:fs/promises';
import { openDatabase } from '../server/src/database/index.mjs';
import { seedBundledMunicipalities } from '../server/src/radar.mjs';

const [kind,file,version]=process.argv.slice(2);
if (kind === 'seed-ibge') {
  const db = openDatabase();
  try {
    const count = seedBundledMunicipalities(db, version || '2026-11-17');
    console.log(`${count} municípios oficiais do IBGE com coordenadas WGS84 carregados.`);
  } finally {
    db.close();
  }
  process.exit(0);
}

if(!['ibge','coordinates','audience','classifications'].includes(kind)||!file) throw Error('Uso: npm run radar:import -- seed-ibge | ibge|coordinates|audience|classifications arquivo.json [versão]');
const rows=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,'')); if(!Array.isArray(rows)||!rows.length) throw Error('JSON deve ser um array não vazio');
const db=openDatabase(); const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const coords=r=>Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&Math.abs(r.lat)<=90&&Math.abs(r.lon)<=180;
const ufRegions={AC:'Norte',AP:'Norte',AM:'Norte',PA:'Norte',RO:'Norte',RR:'Norte',TO:'Norte',AL:'Nordeste',BA:'Nordeste',CE:'Nordeste',MA:'Nordeste',PB:'Nordeste',PE:'Nordeste',PI:'Nordeste',RN:'Nordeste',SE:'Nordeste',DF:'Centro-Oeste',GO:'Centro-Oeste',MT:'Centro-Oeste',MS:'Centro-Oeste',ES:'Sudeste',MG:'Sudeste',RJ:'Sudeste',SP:'Sudeste',PR:'Sul',RS:'Sul',SC:'Sul'};
let n=0; const seen=new Set();
try { db.exec('BEGIN IMMEDIATE'); for(const r of rows){ n++; let key;
 if(kind==='ibge') {const uf=r.microrregiao?.mesorregiao?.UF?.sigla??r['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla; const code=String(r.id); if(!nonempty(version)||!/^\d{7}$/.test(code)||!nonempty(r.nome)||!ufRegions[uf]) throw Error('Registro IBGE inválido ou versão ausente'); key=code; db.prepare(`INSERT INTO municipalities(code,name,uf,region,source,version) VALUES(?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,uf=excluded.uf,region=excluded.region,version=excluded.version`).run(code,r.nome,uf,ufRegions[uf],'IBGE Localidades',version); }
 if(kind==='coordinates'){key=String(r.code);if(!coords(r)||!nonempty(r.source)||!nonempty(r.version)) throw Error('Coordenadas ou proveniência inválidas'); if(!db.prepare('UPDATE municipalities SET lat=?,lon=?,coordinate_source=?,coordinate_version=? WHERE code=?').run(r.lat,r.lon,r.source,r.version,key).changes) throw Error('Município inexistente');}
 if(kind==='audience'){key=JSON.stringify([r.talent_id,r.network,r.metric,r.municipality_code,r.period_start,r.period_end,r.source]);if(!date(r.period_start)||!date(r.period_end)||r.period_start>r.period_end||!Number.isSafeInteger(r.value)||r.value<0||!nonempty(r.source)||!nonempty(r.report_ref)||!nonempty(r.collected_at)||isNaN(Date.parse(r.collected_at))) throw Error('Audiência inválida'); db.prepare(`INSERT INTO regional_audience VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(talent_id,network,metric,municipality_code,period_start,period_end,source) DO UPDATE SET value=excluded.value,report_ref=excluded.report_ref,quality=excluded.quality,collected_at=excluded.collected_at`).run(r.talent_id,r.network,r.metric,String(r.municipality_code),r.period_start,r.period_end,r.value,r.source,r.report_ref,r.quality,r.collected_at);}
 if(kind==='classifications'){key=JSON.stringify([r.talent_id,r.modality_id,r.submodality_id??null]);db.prepare('INSERT OR IGNORE INTO talent_modalities VALUES(?,?)').run(r.talent_id,r.modality_id); if(r.submodality_id!=null)db.prepare('INSERT OR IGNORE INTO talent_submodalities VALUES(?,?,?)').run(r.talent_id,r.modality_id,r.submodality_id);}
 if(seen.has(key))throw Error('Duplicidade no arquivo'); seen.add(key);
 } db.exec('COMMIT'); console.log(`${n} registros processados (${kind})`);
} catch(e){db.exec('ROLLBACK');throw Error(`Importação cancelada na linha ${n}: ${e.message}`);} finally{db.close();}
