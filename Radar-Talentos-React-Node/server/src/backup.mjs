import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,chmodSync,linkSync,copyFileSync,constants,unlinkSync,readdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export function backupDatabase(db,destination){
 const dest=resolve(destination),tmp=dest+'.'+randomUUID()+'.tmp';if(existsSync(dest))throw Error('Backup já existe');mkdirSync(dirname(dest),{recursive:true,mode:0o700});
 try{db.prepare('VACUUM INTO ?').run(tmp);const check=new DatabaseSync(tmp,{readOnly:true});try{if(check.prepare('PRAGMA quick_check').get().quick_check!=='ok'||check.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup inconsistente');}finally{check.close();}
  // Hard link publishes a fully verified snapshot without replacing an existing file; fallback to exclusive copy on Windows when hard links are restricted.
  try{linkSync(tmp,dest);}catch{copyFileSync(tmp,dest,constants.COPYFILE_EXCL);}try{chmodSync(dest,0o600);}catch{}return dest;
 }finally{if(existsSync(tmp)){try{chmodSync(tmp,0o600);}catch{}unlinkSync(tmp);}}
}
export function dailyBackup(db,dir,day,keep=14){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isInteger(keep)||keep<2||keep>365)throw Error('Retenção inválida');
 const root=resolve(dir),dest=resolve(root,`daily-${day}.sqlite`);if(existsSync(dest))return null;
 backupDatabase(db,dest);const cutoff=new Date(Date.parse(day+'T00:00:00Z')-(keep-1)*86400000).toISOString().slice(0,10);
 for(const f of readdirSync(root)){const m=/^daily-(\d{4}-\d{2}-\d{2})\.sqlite$/.exec(f);if(m&&m[1]<cutoff){try{chmodSync(resolve(root,f),0o666);}catch{}unlinkSync(resolve(root,f));}}
 return dest;
}
