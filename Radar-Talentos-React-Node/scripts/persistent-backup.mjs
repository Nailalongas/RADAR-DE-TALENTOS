import {openDatabase} from '../server/src/database/index.mjs';
import {openDiscovery} from '../server/src/discovery/engine.mjs';
import {backupDatabase} from '../server/src/backup.mjs';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const base=resolve(process.argv[2]??process.env.RADAR_BACKUP_DIR??'data/backups');
mkdirSync(base,{recursive:true,mode:0o700});
const root=resolve(base,new Date().toISOString().replace(/[:.]/g,'-'));
mkdirSync(root,{recursive:false,mode:0o700});
const radar=openDatabase();try{const discovery=openDiscovery();try{backupDatabase(radar,resolve(root,'radar.sqlite'));backupDatabase(discovery,resolve(root,'discovery.sqlite'));console.log('Dois backups verificados: '+root);}finally{discovery.close();}}finally{radar.close();}
