import {cp,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['--check','dashboard/dashboard.js'],{stdio:'inherit'});
await mkdir('dist',{recursive:true});await cp('dashboard','dist',{recursive:true});console.log('Painel de eventos copiado para dist. O servidor Node continua obrigatório para banco e sincronização.');
