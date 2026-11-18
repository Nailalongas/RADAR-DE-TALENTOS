import {readFile} from 'node:fs/promises';
import {openDatabase} from '../server/src/database/index.mjs';
import {importRegionalReport} from '../server/src/regional-dashboard.mjs';
const file=process.argv[2];if(!file)throw Error('Uso: npm run regional:import -- relatorio.json');const db=openDatabase();try{console.log(importRegionalReport(db,JSON.parse(await readFile(file,'utf8'))));}finally{db.close();}
