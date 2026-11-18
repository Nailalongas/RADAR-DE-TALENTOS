import {readFile} from 'node:fs/promises';
import {openDatabase} from '../server/src/database/index.mjs';
import {importCommercial} from '../server/src/commercial.mjs';
const file=process.argv[2];if(!file)throw Error('Uso: npm run commercial:import -- arquivo.json');const db=openDatabase();try{console.log({imported:importCommercial(db,JSON.parse(await readFile(file,'utf8')))});}finally{db.close();}
