import {createHash} from 'node:crypto';
import {FilterError,distanceKm} from './radar.mjs';
const fail=m=>{throw new FilterError(m)};
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const norm=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const required=(s,k)=>{if(typeof s!=='string'||!s.trim()||s.length>2000)fail('Campo inválido: '+k);return s.trim()};
const rules=[['corridas',/\b(corrida de rua|corrida infantil|corrida (?:de )?\d+ ?km|maratona|trail run|meia maratona)\b/],['humor',/\b(stand up|standup|show de humor)\b/],['infantil',/\b(infantil|espetaculo infantil)\b/],['teatro',/\b(teatro|peca teatral|musical|ballet)\b/],['palestras',/\b(palestra|congresso|workshop|imersao|curso)\b/],['gastronomia',/\b(gastronomia|gastronomico|degustacao)\b/],['feiras',/\b(feira|exposicao|expo)\b/],['esportes',/\b(triatlo|ciclismo|futebol|jiu jitsu)\b/],['festivais',/\b(festival|festa)\b/],['shows',/\b(show|concerto|sertanejo|pagode|rock)\b/],['experiencias',/\b(experiencia|turismo)\b/]];
export function classifyEvent(title){const matches=rules.filter(([,r])=>r.test(norm(title)));return matches.length===1?matches[0][0]:'outros'}
// Infer only one explicitly identifiable subcategory; multi-distance races, mixed genres
// and ambiguous titles stay unclassified rather than counting as one arbitrary segment.
const subRules={
 shows:[['Sertanejo',/\bsertanejo\b/],['Rock',/\brock\b/],['Pagode',/\bpagode\b/],['Samba',/\bsamba\b/],['MPB',/\bmpb\b/],['Gospel',/\bgospel\b/],['Forró',/\bforro\b/],['Pop',/\bpop\b/],['Funk',/\bfunk\b/]],
 humor:[['Stand-up',/\b(stand up|standup)\b/],['Improvisação',/\bimprovisacao\b/],['Shows humorísticos',/\bshow de humor\b/]],
 teatro:[['Musical',/\bmusical\b/],['Ballet',/\b(ballet|bale)\b/],['Ópera',/\bopera\b/],['Drama',/\bdrama\b/]],
 corridas:[['5 km',/\b5 ?km\b/],['10 km',/\b10 ?km\b/],['Meia maratona',/\b(meia maratona|21 ?km)\b/],['Maratona',/\b(maratona|42 ?km)\b/],['Trail run',/\btrail run\b/],['Corrida infantil',/\bcorrida infantil\b/]],
 esportes:[['Ciclismo',/\bciclismo\b/],['Triatlo',/\btriatlo\b/],['Lutas',/\b(jiu jitsu|boxe|lutas)\b/],['Futebol',/\bfutebol\b/]],
 palestras:[['Liderança',/\blideranca\b/],['Vendas',/\bvendas\b/],['Finanças',/\b(financas|investimentos)\b/],['Saúde',/\bsaude\b/],['Tecnologia',/\btecnologia\b/]],
 gastronomia:[['Cerveja',/\bcerveja\b/],['Vinho',/\bvinho\b/],['Degustações',/\bdegustacao\b/]],
 feiras:[['Tecnologia',/\btecnologia\b/],['Geek',/\bgeek\b/],['Automóveis',/\b(automoveis|carros)\b/]]
};
export function classifySubmodality(db,title,modality){
 const text=norm(title),matches=(subRules[modality]??[]).filter(([name,re])=>re.test(name==='Maratona'?text.replace(/\bmeia maratona\b/g,''):text));
 if(matches.length!==1)return null;return db.prepare('SELECT id FROM submodalities WHERE modality_id=? AND name=?').get(modality,matches[0][0])?.id??null;
}
export function importEvents(db,{platform,observed_on,source,items},onCommit=null){
 if(!db.prepare('SELECT 1 FROM ticket_platforms WHERE id=?').get(platform??''))fail('Plataforma inválida'); if(!date(observed_on)||!Array.isArray(items))fail('Importação inválida');source=required(source,'source');
 db.exec('BEGIN IMMEDIATE');try{for(const raw of items){const title=required(raw.title,'title'),venue=required(raw.venue,'venue'),external=required(raw.external_id,'external_id'),url=required(raw.url,'url');let u;try{u=new URL(url)}catch{fail('URL inválida')}if(u.protocol!=='https:'||u.username||u.password)fail('URL inválida');if(!date(raw.event_date)||raw.published_on!=null&&(!date(raw.published_on)||raw.published_on>observed_on))fail('Datas inválidas');
 const city=required(raw.municipality_code,'municipality_code');if(!db.prepare('SELECT 1 FROM municipalities WHERE code=?').get(city))fail('Município desconhecido: '+city);
 const modality=raw.modality_id??classifyEvent(title);const classification=raw.modality_id?'provided':modality==='outros'?'unknown':'rule';const sub=raw.submodality_id===undefined?classifySubmodality(db,title,modality):raw.submodality_id;
 const id=createHash('sha256').update(JSON.stringify([norm(title),city,norm(venue),raw.event_date])).digest('hex');
 const old=db.prepare('SELECT * FROM event_listings WHERE platform_id=? AND external_id=?').get(platform,external);if(old&&old.event_id!==id)fail('Identidade alterada: revisar '+external+' antes de importar');
 db.prepare(`INSERT INTO events VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET modality_id=excluded.modality_id,submodality_id=excluded.submodality_id,classification=excluded.classification WHERE excluded.classification='provided' AND events.classification!='provided'`).run(id,title,city,venue,raw.event_date,modality,sub,classification);
 db.prepare(`INSERT INTO event_listings VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(platform_id,external_id) DO UPDATE SET first_seen=min(first_seen,excluded.first_seen),last_seen=max(last_seen,excluded.last_seen),published_on=coalesce(event_listings.published_on,excluded.published_on),status=CASE WHEN excluded.last_seen>=last_seen THEN excluded.status ELSE status END,url=CASE WHEN excluded.last_seen>=last_seen THEN excluded.url ELSE url END`).run(platform,external,id,url,observed_on,observed_on,raw.published_on??null,raw.status??'listed');
 }db.prepare('INSERT INTO event_imports(platform_id,observed_on,records,source) VALUES (?,?,?,?)').run(platform,observed_on,items.length,source);onCommit?.(items.length);db.exec('COMMIT');return items.length;}catch(e){db.exec('ROLLBACK');throw e;}
}
export function eventQuery(db,path,p){
 if(path==='/api/events/platforms')return db.prepare('SELECT p.*,max(i.observed_on) last_import,count(i.id) imports FROM ticket_platforms p LEFT JOIN event_imports i ON i.platform_id=p.id GROUP BY p.id ORDER BY p.name').all();
 if(path!=='/api/events/trends')return undefined;
 const get=k=>p.get(k)||'',start=get('start'),end=get('end'),basis=get('basis')||'first_seen',platform=get('platform'),mod=get('modality'),sub=get('submodality'),region=get('region'),uf=get('uf'),city=get('city'),center=get('center'),radius=get('radius');
 if(!date(start)||!date(end)||start>end||!['first_seen','published_on','event_date'].includes(basis))fail('Período ou base temporal inválidos');
 if(region&&!['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].includes(region))fail('Região inválida');if(uf&&!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf))fail('UF inválida');
 if(platform&&!db.prepare('SELECT 1 FROM ticket_platforms WHERE id=?').get(platform))fail('Plataforma inválida');if(mod&&!db.prepare('SELECT 1 FROM modalities WHERE id=?').get(mod))fail('Modalidade inválida');if(sub&&!db.prepare('SELECT 1 FROM submodalities WHERE id=? AND (?=\'\' OR modality_id=?)').get(sub,mod,mod))fail('Submodalidade inválida');
 const lookup=c=>db.prepare('SELECT * FROM municipalities WHERE code=?').get(c);if(city&&!lookup(city))fail('Município inválido');const origin=center?lookup(center):null;if((center||radius)&&(!origin||origin.lat==null||radius===''||!Number.isFinite(+radius)||+radius<0||+radius>10000))fail('Raio inválido');
 const rows=db.prepare(`SELECT e.*,m.name city_name,m.uf,m.region,m.lat,m.lon,mo.name modality_name,s.name submodality_name,min(l.first_seen) first_seen,min(l.published_on) published_on,count(*) listings FROM events e JOIN municipalities m ON m.code=e.municipality_code JOIN modalities mo ON mo.id=e.modality_id LEFT JOIN submodalities s ON s.id=e.submodality_id JOIN event_listings l ON l.event_id=e.id WHERE (?='' OR l.platform_id=?) GROUP BY e.id`).all(platform,platform).filter(r=>(!mod||r.modality_id===mod)&&(!sub||String(r.submodality_id)===sub)&&(!region||r.region===region)&&(!uf||r.uf===uf)&&(!city||r.municipality_code===city));
 let excludedCoordinates=0;const scoped=rows.filter(r=>{if(!origin)return true;if(r.lat==null){excludedCoordinates++;return false}return distanceKm(origin,r)<=+radius});
 const selected=scoped.filter(r=>r[basis]&&r[basis]>=start&&r[basis]<=end);const days=(Date.parse(end)-Date.parse(start))/86400000+1;const shift=(s,n)=>new Date(Date.parse(s)+n*86400000).toISOString().slice(0,10);const previous=scoped.filter(r=>r[basis]&&r[basis]>=shift(start,-days)&&r[basis]<start);
 const agg=(rs,key)=>{const m=new Map();for(const r of rs){const n=key(r);m.set(n,(m.get(n)||0)+1)}return [...m].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name))};
 const prior=new Map(agg(previous,r=>r.modality_name).map(r=>[r.name,r.value]));const current=agg(selected,r=>r.modality_name);for(const name of prior.keys())if(!current.some(r=>r.name===name))current.push({name,value:0});const ranking=current.map(r=>({...r,previous:prior.get(r.name)??0,growth_pct:prior.get(r.name)?(r.value/prior.get(r.name)-1)*100:null}));
 const byPlatform=db.prepare('SELECT id platform_id,name FROM ticket_platforms').all().filter(p=>!platform||p.platform_id===platform).map(p=>{const ids=new Set(db.prepare('SELECT event_id FROM event_listings WHERE platform_id=?').all(p.platform_id).map(x=>x.event_id));return {name:p.name,value:selected.filter(r=>ids.has(r.id)).length}}).sort((a,b)=>b.value-a.value);
 const places=agg(selected,r=>r.municipality_code).map(p=>{const r=lookup(p.name);return {...r,value:p.value}});return {total:selected.length,listings:selected.reduce((n,r)=>n+r.listings,0),ranking,byPlatform,subcategories:agg(selected,r=>r.modality_name+' / '+(r.submodality_name??'Não classificado')),byRegion:agg(selected,r=>r.region),byState:agg(selected,r=>r.uf),monthly:agg(selected,r=>r[basis].slice(0,7)).sort((a,b)=>a.name.localeCompare(b.name)),seasonality:agg(selected,r=>r.event_date.slice(0,7)).sort((a,b)=>a.name.localeCompare(b.name)),places,origin,radius:origin?+radius:null,excludedCoordinates,missingDates:scoped.filter(r=>!r[basis]).length,items:selected.sort((a,b)=>b[basis].localeCompare(a[basis])).slice(0,100),notice:'Eventos únicos observados, não vendas. Crescimento depende da cobertura de coleta; primeira detecção não é data oficial de publicação.'};
}
