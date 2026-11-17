import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {databasePath} from '../server/src/database/index.mjs';
import {backupDatabase} from '../server/src/backup.mjs';
const file=databasePath();if(file===':memory:'||!existsSync(file))throw Error('Banco existente não encontrado; não há dados para copiar');
const dest=process.argv[2]??`data/backups/radar-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`;const db=new DatabaseSync(file,{readOnly:true});try{db.exec('PRAGMA busy_timeout=5000');console.log('Backup verificado: '+backupDatabase(db,dest));}finally{db.close();}
