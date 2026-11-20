import {existsSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
export function requirePersistentPair(env=process.env){
  if(env.VERCEL||env.AWS_LAMBDA_FUNCTION_NAME)throw Error('SQLite local não permitido em ambiente serverless');
  if(env.RADAR_PERSISTENT_REQUIRED!=='1')return;
  const root=resolve(env.RADAR_DATA_DIR||'/app/data');
  for(const [key,name] of [['RADAR_DATABASE_PATH','radar.sqlite'],['DISCOVERY_DB','discovery.sqlite']]){
    if(!env[key]||resolve(env[key])!==resolve(root,name)||!existsSync(env[key])||!statSync(env[key]).isFile())throw Error('Banco persistente ausente ou caminho incorreto: '+key+'; executar a importação inicial');
  }
  if(!existsSync(resolve(root,'.radar-persistent-v1')))throw Error('Volume não homologado; executar a importação inicial');
}
export function ensurePersistentPath(path,key,env=process.env){
  requirePersistentPair(env);
  if(env.RADAR_PERSISTENT_REQUIRED==='1'&&resolve(path)!==resolve(env[key]))throw Error('Caminho fora do volume configurado');
}
