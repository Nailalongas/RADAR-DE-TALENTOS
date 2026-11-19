import {attachTalentCategories} from './talent-taxonomy.mjs';
import {randomUUID} from 'node:crypto';
const text=(v,k,max=500)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Campo obrigatório: '+k);return v.trim();};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const transaction=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};

function checkAnomaly(prevValue,newValue,maxRatio=10){
 if(!Number.isFinite(maxRatio)||maxRatio<=1)return;
 if(prevValue>=100){
  if(newValue===0||newValue>prevValue*maxRatio||newValue<prevValue/maxRatio){
   throw Error('Variação suspeita detectada; revisão manual obrigatória');
  }
 }
}

function mirrorToCommercial(db,account,item,source,authorizationRef){
 const ref=typeof authorizationRef==='string'&&authorizationRef.trim()?authorizationRef.trim():(account.identity_source||'registro-nacional');
 const cleanUrl=account.url.replace(/\/$/,'');
 db.prepare('INSERT INTO commercial_accounts(id,talent_id,network,url,identity_source) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(account.id,account.talent_id,account.network,cleanUrl,account.identity_source||ref);
 db.prepare('INSERT INTO commercial_snapshots(account_id,metric,observed_on,value,source,authorization_ref) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,metric,observed_on) DO UPDATE SET value=excluded.value,source=excluded.source,authorization_ref=excluded.authorization_ref').run(account.id,item.metric,item.observed_on,item.value,source,ref);
}

export function upsertMetricCurrent(db,{account_id,talent_id,network,metric,value=null,observed_on=null,collected_at=new Date().toISOString(),source='Fonte pendente',status='available',status_detail=''}){
 db.prepare(`INSERT INTO metric_current(account_id,talent_id,network,metric,value,observed_on,collected_at,source,status,status_detail)
  VALUES(?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(account_id,metric) DO UPDATE SET
   value=CASE WHEN excluded.value IS NOT NULL AND (metric_current.observed_on IS NULL OR excluded.observed_on>=metric_current.observed_on) THEN excluded.value ELSE metric_current.value END,
   observed_on=CASE WHEN excluded.observed_on IS NOT NULL AND (metric_current.observed_on IS NULL OR excluded.observed_on>=metric_current.observed_on) THEN excluded.observed_on ELSE metric_current.observed_on END,
   collected_at=excluded.collected_at,
   source=excluded.source,
   status=excluded.status,
   status_detail=excluded.status_detail`).run(account_id,talent_id,network,metric,value,observed_on,collected_at,source,status,status_detail);
}

export function recordAccountCollectionStatus(db,accountId,status,errorMessage=null,timestamp=new Date().toISOString()){
 if(!accountId)return;
 const acc=db.prepare('SELECT id,talent_id,network FROM social_accounts WHERE id=?').get(accountId);
 if(!acc)return;
 const state=status==='succeeded'?'collected':status==='failed'?'error':status==='paused'?'paused':'queued';
 db.prepare('UPDATE social_accounts SET collection_state=? WHERE id=?').run(state,accountId);
 db.prepare('INSERT INTO collection_runs(id,account_id,status,started_at,finished_at,error_message,created_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),accountId,status,timestamp,timestamp,errorMessage,timestamp);
 if(status==='failed'){
  db.prepare("UPDATE metric_current SET status='error',status_detail=?,collected_at=? WHERE account_id=?").run(errorMessage||'Falha de coleta',timestamp,accountId);
 }
}

function insertSnapshots(db,rows,{accountId=null,network=null,day=null,allowIntradayUpdate=false,maxChangeRatio=10,syncCommercial=false,authorizationRef=null}={}){
 if(!Array.isArray(rows)||rows.length>100000)throw Error('Lista de métricas inválida');
 let inserted=0;const keys=new Set();
 for(const item of rows){
  const id=text(item.account_id,'account_id'),metric=text(item.metric,'metric'),source=text(item.source,'source');
  const a=db.prepare('SELECT a.id,a.talent_id,a.network,a.url,a.identity_confirmed,a.identity_source,t.blocked FROM social_accounts a JOIN talents t ON t.id=a.talent_id WHERE a.id=?').get(id);
  if(!a||accountId&&id!==accountId||network&&a.network!==network||item.network!==a.network)throw Error('Conta ou rede incompatível');
  if(accountId&&(!a.identity_confirmed||a.blocked))throw Error('Conta inativa ou não confirmada');
  if(a.network==='Spotify'&&metric==='followers'){
   db.prepare("INSERT OR IGNORE INTO network_metrics(network,metric) VALUES('Spotify','followers')").run();
  }
  if(!date(item.observed_on)||day&&item.observed_on>day||!Number.isSafeInteger(item.value)||item.value<0||!db.prepare('SELECT 1 FROM network_metrics WHERE network=? AND metric=?').get(a.network,metric))throw Error('Métrica inválida');
  const intraday=Boolean(allowIntradayUpdate||item.intraday===true);
  const key=JSON.stringify([id,metric,item.observed_on,intraday?item.collected_at??'':'' ]);
  if(!intraday&&keys.has(JSON.stringify([id,metric,item.observed_on])))throw Error('Métrica duplicada no lote');
  if(intraday&&keys.has(key))throw Error('Métrica duplicada no lote');
  keys.add(intraday?key:JSON.stringify([id,metric,item.observed_on]));
  const collected=item.collected_at??new Date().toISOString();
  if(typeof collected!=='string'||isNaN(Date.parse(collected)))throw Error('Data de coleta inválida');

  const verifyAnomaly=Boolean(intraday||item.validateAnomaly===true);
  if(verifyAnomaly){
   const prior=db.prepare('SELECT value FROM metric_snapshots WHERE account_id=? AND metric=? AND source=? AND observed_on<=? ORDER BY observed_on DESC, id DESC LIMIT 1').get(id,metric,source,item.observed_on);
   if(prior)checkAnomaly(prior.value,item.value,item.maxChangeRatio??maxChangeRatio);
  }

  const old=db.prepare('SELECT value,source,collected_at FROM metric_snapshots WHERE account_id=? AND metric=? AND observed_on=?').get(id,metric,item.observed_on);
  if(old){
   if(!intraday){
    if(old.value!==item.value||old.source!==source)throw Error('Histórico divergente; revisar antes de importar');
    continue;
   }
   if(old.source!==source)throw Error('Histórico divergente; revisar antes de importar');
   if(Date.parse(collected)<Date.parse(old.collected_at))throw Error('Coleta anterior à fotografia já registrada no dia');
   if(old.value===item.value&&old.collected_at===collected)continue;
   db.prepare('UPDATE metric_snapshots SET value=?,collected_at=? WHERE account_id=? AND metric=? AND observed_on=?').run(item.value,collected,id,metric,item.observed_on);
   upsertMetricCurrent(db,{account_id:id,talent_id:a.talent_id,network:a.network,metric,value:item.value,observed_on:item.observed_on,collected_at:collected,source,status:'available',status_detail:'Atualizado'});
   if(syncCommercial)mirrorToCommercial(db,a,item,source,authorizationRef);
   inserted++;
   continue;
  }
  db.prepare('INSERT INTO metric_snapshots(account_id,network,metric,observed_on,value,source,collected_at) VALUES(?,?,?,?,?,?,?)').run(id,a.network,metric,item.observed_on,item.value,source,collected);
  upsertMetricCurrent(db,{account_id:id,talent_id:a.talent_id,network:a.network,metric,value:item.value,observed_on:item.observed_on,collected_at:collected,source,status:'available',status_detail:'Atualizado'});
  if(syncCommercial)mirrorToCommercial(db,a,item,source,authorizationRef);
  inserted++;
 }
 if(accountId&&rows.length>0){
  recordAccountCollectionStatus(db,accountId,'succeeded',null,rows[rows.length-1].collected_at??new Date().toISOString());
 }
 return inserted;
}

export function importNationalMetrics(db,rows,options,onCommit=null){
 return transaction(db,()=>{
  const n=insertSnapshots(db,rows,options);
  onCommit?.(n);
  return n;
 });
}

export function importRegistry(db,input,options={}){
 if(!input||!Array.isArray(input.talents??[])||!Array.isArray(input.accounts??[])||!Array.isArray(input.snapshots??[]))throw Error('Cadastro inválido');
 return transaction(db,()=>{
  let talents=0,accounts=0;const ids=new Set();
  for(const r of input.talents??[]){
   const id=text(r.id,'id'),name=text(r.name,'name'),type=r.entity_type??'person',blocked=r.blocked??0;
   if(ids.has(id)||!['person','organization'].includes(type)||![0,1].includes(blocked))throw Error('Talento inválido ou duplicado');
   ids.add(id);
   const old=db.prepare('SELECT name,entity_type,blocked FROM talents WHERE id=?').get(id);
   if(old&&(old.name!==name||old.entity_type!==type||r.blocked!==undefined&&old.blocked!==blocked))throw Error('Talento existente divergente; nenhuma alteração automática');
   if(!old){db.prepare('INSERT INTO talents(id,name,entity_type,blocked) VALUES(?,?,?,?)').run(id,name,type,blocked);talents++;}
   attachTalentCategories(db,id,r.categories??[]);
   if(!Array.isArray(r.modalities??[]))throw Error('Modalidades inválidas');
   for(const mod of r.modalities??[]){
    const m=typeof mod==='string'?{id:mod}:mod;
    db.prepare('INSERT OR IGNORE INTO talent_modalities VALUES(?,?)').run(id,m.id);
    if(m.submodality_id!=null)db.prepare('INSERT OR IGNORE INTO talent_submodalities VALUES(?,?,?)').run(id,m.id,m.submodality_id);
   }
  }
  ids.clear();
  for(const r of input.accounts??[]){
   const id=text(r.id,'account.id'),talent=text(r.talent_id,'talent_id'),network=r.network,url=new URL(text(r.url,'url',2000)),external=r.external_id==null?null:text(r.external_id,'external_id'),confirmed=r.identity_confirmed??0,source=r.identity_source??null;
   if(ids.has(id)||!['YouTube','Instagram','Spotify'].includes(network)||url.protocol!=='https:'||url.username||url.password||![0,1].includes(confirmed))throw Error('Conta inválida ou duplicada');
   ids.add(id);
   if(confirmed)text(source,'identity_source');
   const old=db.prepare('SELECT * FROM social_accounts WHERE id=?').get(id);
   if(old){
    if(old.talent_id!==talent||old.network!==network||old.url!==r.url||old.external_id!==external)throw Error('Identidade divergente; associação existente preservada');
    if(!old.identity_confirmed&&confirmed)db.prepare('UPDATE social_accounts SET identity_confirmed=1,identity_source=? WHERE id=?').run(source,id);
    continue;
   }
   db.prepare('INSERT INTO social_accounts(id,talent_id,network,url,external_id,identity_confirmed,identity_source,content_language) VALUES(?,?,?,?,?,?,?,?)').run(id,talent,network,r.url,external,confirmed,source,r.content_language??null);
   accounts++;
  }
  const snapshots=insertSnapshots(db,input.snapshots??[],options);
  return {talents,accounts,snapshots};
 });
}
