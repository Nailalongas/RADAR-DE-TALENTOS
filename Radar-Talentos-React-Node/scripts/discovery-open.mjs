import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import {openDiscovery} from '../server/src/discovery/engine.mjs';
import {globalSearch,saveWikidata,importMusicBrainz} from '../server/src/discovery/global-search.mjs';
const [cmd,arg,country='BR',limit='100000']=process.argv.slice(2);const db=openDiscovery();try{let r;if(cmd==='search')r=await globalSearch(db,null,arg);else if(cmd==='save')r=await saveWikidata(db,arg);else if(cmd==='import-mb'){if(!arg)throw Error('Informe arquivo JSONL extraído do dump oficial');const lines=createInterface({input:createReadStream(arg),crlfDelay:Infinity});try{r=await importMusicBrainz(db,lines,{country:country==='ALL'?'':country,limit:Number(limit)});}finally{lines.close();}}else throw Error('Comandos: search "nome" | save QID | import-mb arquivo.jsonl [BR|ALL] [limite]');console.log(JSON.stringify(r,null,2));}catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}
