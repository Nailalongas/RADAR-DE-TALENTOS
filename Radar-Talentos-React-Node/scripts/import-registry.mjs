import {readFile} from 'node:fs/promises';
import {openDatabase} from '../server/src/database/index.mjs';
import {importRegistry} from '../server/src/registry.mjs';
const file=process.argv[2];if(!file)throw Error('Uso: npm run registry:import -- cadastro.json');const input=JSON.parse(await readFile(file,'utf8'));const db=openDatabase();try{console.log(JSON.stringify(importRegistry(db,input)));}finally{db.close();}
