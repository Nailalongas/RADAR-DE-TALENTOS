import {readFile} from 'node:fs/promises';
import {openDiscovery} from '../server/src/discovery/engine.mjs';
import {refresh} from '../server/src/discovery/social-refresh.mjs';
const db=openDiscovery();try{const config=JSON.parse(await readFile(process.argv[2]??'config/discovery-refresh.json','utf8'));const results=await refresh(db,config.tasks);console.log(JSON.stringify(results,null,2));if(results.some(r=>['failed','blocked'].includes(r.status)))process.exitCode=1;}catch{console.error('Falha na configuração ou execução. Verifique os arquivos e logs.');process.exitCode=1;}finally{db.close()}
