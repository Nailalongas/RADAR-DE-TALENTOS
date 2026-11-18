import {readFileSync} from 'node:fs';
import {openDatabase} from '../server/src/database/index.mjs';
import {reviewArtists} from '../server/src/events.mjs';
if(!process.argv[2])throw Error('Uso: npm run events:artists -- arquivo.json');
const db=openDatabase();try{console.log('Anúncios revisados:',reviewArtists(db,JSON.parse(readFileSync(process.argv[2],'utf8'))));}finally{db.close()}
