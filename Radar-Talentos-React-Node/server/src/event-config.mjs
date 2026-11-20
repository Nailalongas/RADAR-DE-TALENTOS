import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateConfig} from './operations.mjs';
const defaultConfigPath=fileURLToPath(new URL('../../config/operations.json',import.meta.url));
const fallbackConfigPath=fileURLToPath(new URL('../../config/operations.example.json',import.meta.url));
async function loadRawConfig(file){
  try{return JSON.parse(await readFile(file,'utf8'));}
  catch(err){if(err?.code==='ENOENT'&&(file==='config/operations.json'||file===defaultConfigPath))return JSON.parse(await readFile(fallbackConfigPath,'utf8'));throw err;}
}
export function eventsOnlyConfig(raw){if(!raw||!Array.isArray(raw.jobs))throw Error('Configuração inválida');return validateConfig({...raw,jobs:raw.jobs.filter(j=>['events','alerts'].includes(j.kind)).map(j=>j.kind==='alerts'?{...j,queries:[]}:j)});}
export async function readEventConfig(file=process.env.RADAR_OPERATIONS_CONFIG??defaultConfigPath){return eventsOnlyConfig(await loadRawConfig(file));}
export function dashboardConfig(raw){if(!raw||!Array.isArray(raw.jobs))throw Error('Configuração inválida');return validateConfig({...raw,jobs:raw.jobs.filter(j=>['events','alerts'].includes(j.kind)||raw.enableRegionalAudience===true&&j.kind==='audience'||raw.enableCommercial===true&&j.kind==='metrics'&&j.commercial===true).map(j=>j.kind==='alerts'?{...j,queries:[]}:j)});}
export async function readDashboardConfig(file=process.env.RADAR_OPERATIONS_CONFIG??defaultConfigPath){return dashboardConfig(await loadRawConfig(file));}
