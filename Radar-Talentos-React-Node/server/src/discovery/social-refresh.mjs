import {createHash,randomUUID} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=c=>{throw new Error(c)};
const nonnegative=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const integer=v=>typeof v==='string'&&/^\d+$/.test(v)&&nonnegative(Number(v))?Number(v):undefined;
const envValue=(env,key)=>{if(!/^[A-Z][A-Z0-9_]*$/.test(key??'')||!env[key])fail('CREDENCIAL_AUSENTE');return env[key]};
async function request(url,token,fetcher){let r;try{r=await fetcher(url,{headers:token?{Authorization:`Bearer ${token}`}:{},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{fail('CONEXAO_FALHOU')};if(!r.ok)fail(`HTTP_${r.status}`);try{return await r.json()}catch{fail('RESPOSTA_INVALIDA')}}
export async function readProfile(profile,task,{env=process.env,fetcher=fetch}={}){
 const path=new URL(profile.url).pathname; const token=envValue(env,task.credential_env);let u,d,metrics={};
 switch(profile.network){
 case 'Instagram':{const handle=path.slice(1);if(!/^[a-zA-Z0-9._]{1,30}$/.test(handle)||!/^v\d+\.\d+$/.test(task.graph_version??'')||!/^\d+$/.test(task.ig_user_id??''))fail('CONFIG_INVALIDA');u=new URL(`https://graph.facebook.com/${task.graph_version}/${task.ig_user_id}`);u.searchParams.set('fields',`business_discovery.username(${handle}){id,username,followers_count}`);d=(await request(u,token,fetcher)).business_discovery;if(!d||d.username?.toLowerCase()!==handle.toLowerCase()||String(d.id)!==task.external_id)fail('IDENTIDADE_DIVERGENTE');metrics.followers=d.followers_count;break;}
 case 'YouTube':{if(!/^\/channel\/UC[A-Za-z0-9_-]{22}$/.test(path)||path.slice(9)!==task.external_id)fail('IDENTIDADE_DIVERGENTE');u=new URL('https://www.googleapis.com/youtube/v3/channels');u.search=new URLSearchParams({part:'statistics',id:task.external_id,key:token});d=(await request(u,null,fetcher)).items?.find(x=>x.id===task.external_id);if(!d)fail('IDENTIDADE_DIVERGENTE');if(d.statistics?.hiddenSubscriberCount===false)metrics.subscribers=integer(d.statistics.subscriberCount);metrics.views=integer(d.statistics?.viewCount);break;}
 case 'Spotify':{if(!/^\/artist\/[A-Za-z0-9]{22}$/.test(path)||path.slice(8)!==task.external_id)fail('IDENTIDADE_DIVERGENTE');u=new URL(`https://api.spotify.com/v1/artists/${task.external_id}`);d=await request(u,token,fetcher);if(d.id!==task.external_id)fail('IDENTIDADE_DIVERGENTE');metrics.followers=d.followers?.total;break;}
 case 'TikTok':{const handle=path.slice(2);if(!/^\/@[A-Za-z0-9._]+$/.test(path))fail('CONFIG_INVALIDA');u=new URL('https://open.tiktokapis.com/v2/user/info/');u.searchParams.set('fields','open_id,username,follower_count');d=await request(u,token,fetcher);if(d.error?.code!=='ok'||d.data?.user?.open_id!==task.external_id||d.data.user.username?.toLowerCase()!==handle.toLowerCase())fail('IDENTIDADE_DIVERGENTE');metrics.followers=d.data.user.follower_count;break;}
 default:fail('REDE_NAO_SUPORTADA');}
 const rows=Object.entries(metrics).filter(([,v])=>nonnegative(v));if(!rows.length)fail('METRICA_INDISPONIVEL');return rows;
}
// Uma execução por perfil/fonte/dia UTC. Não apaga histórico nem publica automaticamente.
export async function refresh(db,tasks,{env=process.env,fetcher=fetch,clock=()=>new Date()}={}){
 if(!Array.isArray(tasks)||tasks.length>500)fail('CONFIG_INVALIDA');const results=[];
 for(const task of tasks){if(task.enabled!==true)continue;const at=clock().toISOString();const day=at.slice(0,10);const p=db.prepare("SELECT p.*,c.status FROM profiles p JOIN candidates c ON c.id=p.candidate_id WHERE p.id=?").get(task.profile_id??'');const s=db.prepare('SELECT * FROM sources WHERE id=?').get(task.source_id??'');
 if(!p||!['approved','published'].includes(p.status)||!s?.enabled||!s.history_allowed||p.source_id!==s.id||!['youtube','licensed-file'].includes(s.kind)||!task.external_id||task.commercial_history_approved!==true||!Number.isFinite(Date.parse(task.authorization_expires_at))||Date.parse(task.authorization_expires_at)<=Date.parse(at)){results.push({profile:task.profile_id,status:'blocked'});continue;}
 const job=hash(['refresh',p.id,s.id,day].join('\0'));const claim=db.prepare('INSERT OR IGNORE INTO collection_jobs VALUES(?,?,?,?,?)').run(job,s.id,'refresh:'+p.id,at,'running');if(!claim.changes){results.push({profile:p.id,status:'skipped'});continue;}
 try{const values=await readProfile(p,task,{env,fetcher});const observed=clock().toISOString();db.exec('BEGIN IMMEDIATE');try{
 const valid=db.prepare("SELECT 1 FROM profiles p JOIN candidates c ON c.id=p.candidate_id JOIN sources s ON s.id=p.source_id WHERE p.id=? AND c.status IN ('approved','published') AND s.enabled=1 AND s.history_allowed=1").get(p.id);if(!valid||Date.parse(task.authorization_expires_at)<=Date.parse(observed))fail('AUTORIZACAO_EXPIRADA');
 for(const [metric,value] of values){const old=db.prepare('SELECT value FROM observations WHERE profile_id=? AND metric=? AND source_id=? ORDER BY observed_at DESC LIMIT 1').get(p.id,metric,s.id);if(old&&((old.value>0&&(value>old.value*10||value<old.value/10))||(old.value===0&&value>10000)))fail('VARIACAO_SUSPEITA');db.prepare('INSERT INTO observations VALUES(?,?,?,?,?,?,?)').run(hash([p.id,metric,observed,s.id].join('\0')),p.id,metric,value,observed,s.id,p.url);}
 db.prepare('UPDATE collection_jobs SET status=? WHERE id=?').run('success',job);db.prepare('INSERT INTO collection_logs VALUES(?,?,?,?,?,?)').run(randomUUID(),job,observed,'success',values.length,'Métricas observadas; sem publicação automática');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e}results.push({profile:p.id,status:'success',metrics:values.length});
 }catch(e){const code=/^(HTTP_\d{3}|[A-Z_]{3,40})$/.test(e.message)?e.message:'FALHA_INTERNA';db.prepare('UPDATE collection_jobs SET status=? WHERE id=?').run('failed',job);db.prepare('INSERT INTO collection_logs VALUES(?,?,?,?,?,?)').run(randomUUID(),job,clock().toISOString(),'failed',0,code);results.push({profile:p.id,status:'failed',code});}}
 return results;
}
