import {readFileSync} from 'node:fs';
import {openDatabase} from '../server/src/database/index.mjs';
import {importCoverage} from '../server/src/opportunities.mjs';
if(!process.argv[2])throw Error('Uso: npm run events:coverage -- cobertura.json');
const db=openDatabase();try{console.log('Declarações:',importCoverage(db,JSON.parse(readFileSync(process.argv[2],'utf8'))))}finally{db.close()}
