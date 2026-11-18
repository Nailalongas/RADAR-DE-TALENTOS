import {readFile} from 'node:fs/promises';
import {validateConfig} from './operations.mjs';
export function eventsOnlyConfig(raw){if(!raw||!Array.isArray(raw.jobs))throw Error('Configuração inválida');return validateConfig({...raw,jobs:raw.jobs.filter(j=>['events','alerts'].includes(j.kind)).map(j=>j.kind==='alerts'?{...j,queries:[]}:j)});}
export async function readEventConfig(file=process.env.RADAR_OPERATIONS_CONFIG??'config/operations.json'){return eventsOnlyConfig(JSON.parse(await readFile(file,'utf8')));}
export function dashboardConfig(raw){if(!raw||!Array.isArray(raw.jobs))throw Error('Configuração inválida');return validateConfig({...raw,jobs:raw.jobs.filter(j=>['events','alerts'].includes(j.kind)||raw.enableRegionalAudience===true&&j.kind==='audience').map(j=>j.kind==='alerts'?{...j,queries:[]}:j)});}
export async function readDashboardConfig(file=process.env.RADAR_OPERATIONS_CONFIG??'config/operations.json'){return dashboardConfig(JSON.parse(await readFile(file,'utf8')));}
