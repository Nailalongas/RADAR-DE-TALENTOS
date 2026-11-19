import {dailyBackup} from './backup.mjs';
import {openDiscovery} from './discovery/engine.mjs';
import {resolve} from 'node:path';
export function backupBoth(radar,dir,day,keep){
  const discovery=openDiscovery();try{return [dailyBackup(radar,resolve(dir,'radar'),day,keep),dailyBackup(discovery,resolve(dir,'discovery'),day,keep)].filter(Boolean);}finally{discovery.close();}
}
