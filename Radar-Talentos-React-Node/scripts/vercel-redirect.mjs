// Executar somente após validar o backend externo. Redirecionamento conserva o caminho.
import {readFileSync,writeFileSync} from 'node:fs';
const u=new URL(process.argv[2]??'');if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.port||u.hostname.endsWith('.vercel.app')||['localhost','127.0.0.1'].includes(u.hostname))throw Error('Informe o domínio HTTPS público do novo servidor (sem caminho)');
const config=JSON.parse(readFileSync('vercel.json','utf8'));
if(config.redirects)throw Error('Já existem redirecionamentos. Revisar manualmente.');
delete config.rewrites;config.redirects=[{source:'/:path*',destination:u.origin+'/:path*',permanent:false}];
writeFileSync('vercel.json',JSON.stringify(config,null,2)+'\n');console.log('Redirecionamento temporário preparado; revisar e publicar.');
