import {openDatabase} from '../server/src/database/index.mjs';
import {importGeography,importMunicipalityCatalog,importMunicipalCoordinates} from '../server/src/geography.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
const year=args.find(x=>/^\d{4}$/.test(x))||'2025';
const offline=args.includes('--offline');
const dir=resolve('data/geography',year);
await mkdir(dir,{recursive:true});

const bundledMunicipalitiesPath=fileURLToPath(new URL('../src/domain/municipios-data.json',import.meta.url));
const bundledStatesPath=fileURLToPath(new URL('../src/domain/uf-malha.json',import.meta.url));

async function loadFromBundled(){
  const rawMuni=JSON.parse(await readFile(bundledMunicipalitiesPath,'utf8'));
  const rawStates=JSON.parse(await readFile(bundledStatesPath,'utf8'));
  const ufToCode={RO:11,AC:12,AM:13,RR:14,PA:15,AP:16,TO:17,MA:21,PI:22,CE:23,RN:24,PB:25,PE:26,AL:27,SE:28,BA:29,MG:31,ES:32,RJ:33,SP:35,PR:41,SC:42,RS:43,MS:50,MT:51,GO:52,DF:53};
  const states={
    type:'FeatureCollection',
    features:(rawStates.features||[]).map(f=>({
      ...f,
      properties:{...f.properties,codarea:f.properties?.codarea??ufToCode[f.properties?.uf]}
    }))
  };
  const municipalities=rawMuni.map(([code,name,uf,lat,lon])=>({
    id:code,
    nome:name,
    microrregiao:{mesorregiao:{UF:{sigla:uf}}},
    lat,
    lon
  }));
  return {municipalities,states};
}

async function load(name,url){
  const path=resolve(dir,name+'.json');
  if(offline&&existsSync(path))return JSON.parse(await readFile(path,'utf8'));
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const res=await fetch(url,{signal:AbortSignal.timeout(45000)});
      if(!res.ok)throw Error(`${name}: HTTP ${res.status}`);
      const text=await res.text();
      const data=JSON.parse(text);
      await writeFile(path,text);
      return data;
    }catch(e){
      last=e;
      if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));
    }
  }
  throw last;
}

const base=process.env.GEO_API_BASE||'';
const locUrl=process.env.GEO_LOCALITIES_URL||'';
const db=openDatabase();
try{
  if(!base||!locUrl||offline&&!existsSync(resolve(dir,'municipalities.json'))){
    const {municipalities,states}=await loadFromBundled();
    const version=`Localidades: ${new Date().toISOString().slice(0,10)}; malhas: ${year}`;
    console.log(importMunicipalityCatalog(db,municipalities,`Localidades: ${new Date().toISOString().slice(0,10)}`),'municípios cadastrados');
    if(!args.includes('--catalog-only')){
      console.log(importGeography(db,municipalities,states,version),'municípios');
      if(!args.includes('--no-coordinates')){
        db.exec('BEGIN IMMEDIATE');
        try{
          const stmt=db.prepare('UPDATE municipalities SET lat=?,lon=?,coordinate_source=?,coordinate_version=? WHERE code=? AND (lat IS NULL OR coordinate_source=?)');
          for(const m of municipalities){
            if(Number.isFinite(m.lat)&&Number.isFinite(m.lon)){
              stmt.run(m.lat,m.lon,'Malha Territorial — centro da caixa envolvente (aproximado)',year,m.id,'Malha Territorial — centro da caixa envolvente (aproximado)');
            }
          }
          db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
        for(const {uf,n} of db.prepare('SELECT uf,count(*) n FROM municipalities WHERE lat IS NOT NULL GROUP BY uf ORDER BY uf').all()){
          console.log(uf,n);
        }
      }
    }
  }else{
    const municipalities=await load('municipalities',locUrl);
    console.log(importMunicipalityCatalog(db,municipalities,`Localidades: ${new Date().toISOString().slice(0,10)}`),'municípios cadastrados');
    if(args.includes('--catalog-only'))process.exit(0);
    const states=await load('states',`${base}/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF&periodo=${year}`);
    console.log(importGeography(db,municipalities,states,`Localidades: ${new Date().toISOString().slice(0,10)}; malhas: ${year}`),'municípios');
    let errors=0;
    if(!args.includes('--no-coordinates')){
      for(const {uf} of db.prepare('SELECT DISTINCT uf FROM municipalities ORDER BY uf').all()){
        const codes=new Set(db.prepare('SELECT code FROM municipalities WHERE uf=?').all(uf).map(x=>x.code));
        const stateCode=[...codes][0].slice(0,2);
        try{
          const geo=await load('municipal-'+uf,`${base}/estados/${stateCode}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio&periodo=${year}`);
          console.log(uf,importMunicipalCoordinates(db,geo,year,codes));
        }catch(e){errors++;console.error(uf,e.message);}
      }
    }
    if(errors)process.exitCode=1;
  }
}finally{db.close();}
