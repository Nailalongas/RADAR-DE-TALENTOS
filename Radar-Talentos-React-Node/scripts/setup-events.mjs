import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {eventsOnlyConfig} from '../server/src/event-config.mjs';
const file=process.env.RADAR_OPERATIONS_CONFIG??'config/operations.json';
for(const p of ['data/inbox','data/secrets','data/backups'])await mkdir(p,{recursive:true});
let config;try{config=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;config=JSON.parse(await readFile('config/operations.example.json','utf8'));await writeFile(file,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});}
const [id,reference]=process.argv.slice(2);
if(id){const job=config.jobs.find(j=>j.id===id&&j.kind==='events');if(!job||!['ticketmaster','sympla'].includes(job.adapter))throw Error('Ativação rápida: ticketmaster ou sympla. Para outras fontes, configure o JSON conforme o manual.');if(!reference?.trim())throw Error('Informe a referência da autorização de uso.');if(!process.env[job.tokenEnv])throw Error(`Configure a variável de ambiente ${job.tokenEnv} antes de ativar.`);job.enabled=true;job.authorizationRef=reference;eventsOnlyConfig(config);await writeFile(file,JSON.stringify(config,null,2)+'\n',{mode:0o600});}
console.log('Configuração:',file);console.log('Fontes de eventos habilitadas:',eventsOnlyConfig(config).jobs.filter(j=>j.kind==='events'&&j.enabled).map(j=>j.id).join(', ')||'nenhuma');
