import {readFileSync} from 'node:fs';
import {openDatabase} from '../server/src/database/index.mjs';
import {importEvents} from '../server/src/events.mjs';
const file=process.argv[2];if(!file)throw new Error('Uso: npm run events:import -- arquivo.json');const db=openDatabase();try{console.log('Registros importados:',importEvents(db,JSON.parse(readFileSync(file,'utf8'))));}finally{db.close()}
