'use strict';
const el=(t,p={},...c)=>{const n=document.createElement(t);Object.entries(p).forEach(([k,v])=>k==='class'?n.className=v:n.setAttribute(k,v));c.flat().forEach(x=>n.append(x?.nodeType?x:document.createTextNode(String(x??''))));return n};
const svg=(t,p={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',t);Object.entries(p).forEach(([k,v])=>n.setAttribute(k,v));return n};
const fmt=n=>n==null?'Indisponível':Number(n).toLocaleString('pt-BR',{maximumFractionDigits:2});
const signed=n=>n==null?'—':`${n>0?'+':''}${fmt(n)}`;
const pct=n=>n==null?'Indisponível':`${n>0?'+':''}${Number(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
const form=document.getElementById('filters'),msg=document.getElementById('message');
let meta,geo,allMunicipalities=[],cityIndex=new Map(),selectedCities=new Set();

const DEFAULT_CATEGORIES=[
 {key:'cantores',label:'Cantores'},
 {key:'humoristas',label:'Humoristas'},
 {key:'palestrantes',label:'Palestrantes'},
 {key:'influenciadores',label:'Influenciadores'},
 {key:'teatro-musicais',label:'Teatro e musicais'},
 {key:'infantil-familia',label:'Infantil e família'},
 {key:'artistas',label:'Artistas'},
 {key:'gastronomia',label:'Gastronomia'}
];

async function api(u){
 const r=await fetch(u);
 const d=await r.json();
 if(!r.ok)throw Error(d.message||'Erro na API');
 return d;
}

function field(name){return form.elements.namedItem(name)}

function fill(select,items,allLabel,val=x=>x,lab=x=>x){
 const cur=select.value;
 select.replaceChildren();
 if(allLabel!=null)select.append(el('option',{value:''},allLabel));
 items.forEach(x=>select.append(el('option',{value:val(x)},lab(x))));
 if([...select.options].some(o=>o.value===cur))select.value=cur;
}

function fillMetrics(){
 const m=(meta?.metrics??[]).filter(x=>x.network===field('network').value);
 fill(field('metric'),m,null,x=>x.key,x=>x.label);
}

function fillCategories(){
 const cats=meta?.categories?.length?meta.categories:DEFAULT_CATEGORIES;
 fill(field('category'),cats,'Todas as categorias',x=>x.key,x=>`${x.label}${x.talentCount!=null?` (${fmt(x.talentCount)})`:''}`);
}

function fillSub(){
 const mod=field('modality').value;
 const subs=[...new Set((meta?.talents??[]).filter(t=>!mod||t.modality===mod).map(t=>t.submodality))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 fill(field('submodality'),subs,'Todas');
}

function filteredStates(){
 const region=field('region').value;
 return (meta?.states??[]).filter(s=>!region||s.region===region);
}

function fillStates(){
 const states=filteredStates();
 fill(field('uf'),states,'Todos',x=>x.uf,x=>`${x.uf} — ${x.name}`);
}

function filteredMunicipalities(){
 const region=field('region').value;
 const uf=field('uf').value;
 return allMunicipalities.filter(c=>(!region||c.region===region)&&(!uf||c.uf===uf));
}

function fillCities(){
 const cities=filteredMunicipalities();
 const cur=field('city').value;
 const select=field('city');
 select.replaceChildren(el('option',{value:''},`Todos os municípios (${fmt(cities.length)})`));
 const frag=document.createDocumentFragment();
 for(const c of cities){
  frag.append(el('option',{value:c.code},`${c.name} / ${c.uf}`));
 }
 select.append(frag);
 if(cur&&cities.some(c=>String(c.code)===String(cur)))select.value=cur;
}

function activeCityCodes(){
 const codes=new Set([...selectedCities]);
 const current=field('city').value;
 if(current)codes.add(String(current));
 return [...codes];
}

function renderSelectedCities(){
 const host=document.getElementById('selected-cities');
 if(!host)return;
 host.replaceChildren();
 const codes=activeCityCodes();
 if(!codes.length){
  host.append(el('span',{class:'map-selection-note'},'Nenhum município fixado. Selecione um município ou clique em "+ Incluir município no comparativo" para somar várias cidades.'));
  return;
 }
 for(const code of codes){
  const city=cityIndex.get(String(code));
  const label=city?`${city.name}/${city.uf}`:`Município ${code}`;
  const chip=el('button',{type:'button',class:'city-chip','data-city-code':code,title:'Remover município da seleção'},el('b',{},label),' ×');
  chip.addEventListener('click',()=>{
   selectedCities.delete(String(code));
   if(String(field('city').value)===String(code))field('city').value='';
   renderSelectedCities();
   load();
  });
  host.append(chip);
 }
}

function renderCategoryKpis(r){
 const host=document.getElementById('kpis');
 host.replaceChildren();
 const categories=(r.categories?.length?r.categories:(meta?.categories?.length?meta.categories:DEFAULT_CATEGORIES));
 const active=field('category').value;
 const totalCount=(meta?.talents??[]).length||categories.reduce((acc,c)=>acc+Number(c.talentCount||0),0);

 for(const cat of categories){
  const isActive=active===cat.key;
  const count=cat.talentCount??0;
  const card=el('button',{
   type:'button',
   class:`kpi category-kpi${isActive?' active':''}`,
   'data-category':cat.key,
   'aria-pressed':String(isActive)
  },
   el('span',{},cat.label),
   el('b',{},fmt(count)),
   el('small',{},count===1?'1 talento cadastrado':`${fmt(count)} talentos`)
  );
  card.addEventListener('click',()=>{
   field('category').value=isActive?'':cat.key;
   load();
  });
  host.append(card);
 }

 const allActive=!active;
 const totalCard=el('button',{
  type:'button',
  class:`kpi category-kpi${allActive?' active':''}`,
  'data-category':'',
  'aria-pressed':String(allActive)
 },
  el('span',{},'Total de talentos'),
  el('b',{},fmt(totalCount)),
  el('small',{},allActive?'Todas as categorias ativas':'Clique para limpar categoria')
 );
 totalCard.addEventListener('click',()=>{
  field('category').value='';
  load();
 });
 host.append(totalCard);
}

function renderScopeTotals(r){
 const host=document.getElementById('scope-totals');
 if(!host)return;
 host.replaceChildren();
 const scope=r.scopeTotal??{totalValue:0,talentCount:0,municipalityCount:0};
 const codes=activeCityCodes();
 const uf=field('uf').value;
 const region=field('region').value;
 const radius=field('radius').value;
 const locLabel=codes.length>1
  ?`${codes.length} municípios selecionados`
  :codes.length===1
   ?(cityIndex.get(codes[0])?`${cityIndex.get(codes[0]).name}/${cityIndex.get(codes[0]).uf}`:codes[0])
   :uf?`Estado ${uf}`:region?`Região ${region}`:'Brasil inteiro';
 const radiusNote=radius&&r.origin?`Raio de ${fmt(r.radius)} km a partir de ${r.origin.name}/${r.origin.uf}`:'Sem filtro de raio ativo';

 [
  ['Escopo geográfico',locLabel,radiusNote],
  [`Total ${r.metric?.label??'na mídia'} (${r.network})`,fmt(scope.totalValue),`${r.metric?.unit??'unidades'} somadas no recorte`],
  ['Talentos com audiência no recorte',fmt(scope.talentCount),`${fmt(r.comparableCount??0)} com histórico comparável em ${r.days??30} dias`],
  ['Municípios com dados no recorte',fmt(scope.municipalityCount),'Clique nas barras ou no mapa para isolar ou somar cidades']
 ].forEach(([title,val,sub])=>{
  host.append(el('div',{class:'scope-metric'},el('span',{},title),el('strong',{},val),el('small',{},sub)));
 });
}

function bars(target,items,unit,onSelect){
 target.replaceChildren();
 if(!items?.length){target.append(el('p',{},'Sem registros para os filtros informados.'));return}
 const max=Math.max(...items.map(x=>x.value),1);
 items.slice(0,12).forEach(x=>{
  const row=el('div',{class:'bar'},
   el('span',{},x.uf?`${x.name}/${x.uf}`:x.name),
   el('div',{class:'track'},el('div',{class:'fill',style:`width:${Math.max(3,x.value/max*100)}%`})),
   el('strong',{},`${fmt(x.value)}${unit?` ${unit}`:''}`)
  );
  if(onSelect){
   row.style.cursor='pointer';
   row.title='Clique para filtrar esta localidade';
   row.addEventListener('click',()=>onSelect(x));
  }
  target.append(row);
 });
}

function regionBars(target,r){
 target.replaceChildren();
 const audienceByRegion=new Map((r.byRegion??[]).map(x=>[x.name,x.value]));
 const talentByRegion=new Map((r.byRegionTalent??[]).map(x=>[x.name,x.talentCount]));
 const regions=['Sudeste','Nordeste','Sul','Centro-Oeste','Norte'].map(name=>({
  name,
  value:audienceByRegion.get(name)??0,
  talents:talentByRegion.get(name)??0
 })).filter(x=>x.value>0||x.talents>0);
 if(!regions.length){target.append(el('p',{},'Sem registros regionais para o recorte atual.'));return}
 const max=Math.max(...regions.map(x=>x.value),1);
 regions.forEach(x=>{
  const row=el('div',{class:'bar',style:'cursor:pointer',title:`Filtrar região ${x.name}`},
   el('span',{},`${x.name} (${fmt(x.talents)} talentos)`),
   el('div',{class:'track'},el('div',{class:'fill',style:`width:${Math.max(4,x.value/max*100)}%`})),
   el('strong',{},fmt(x.value))
  );
  row.addEventListener('click',()=>{
   field('region').value=field('region').value===x.name?'':x.name;
   field('uf').value='';
   field('city').value='';
   selectedCities.clear();
   fillStates();
   fillCities();
   renderSelectedCities();
   load();
  });
  target.append(row);
 });
}

const project=([lon,lat])=>[20+(lon+75)*15,20+(6-lat)*13];

function chooseState(uf){
 const state=(meta?.states??[]).find(s=>s.uf===uf);
 if(field('uf').value===uf){
  field('uf').value='';
 }else{
  if(state&&field('region').value&&field('region').value!==state.region)field('region').value='';
  fillStates();
  field('uf').value=uf;
 }
 field('city').value='';
 selectedCities.clear();
 fillCities();
 renderSelectedCities();
 load();
}

function chooseCity(code,additive=false){
 const strCode=String(code);
 const city=cityIndex.get(strCode);
 if(city){
  if(field('region').value&&field('region').value!==city.region)field('region').value='';
  fillStates();
  if(field('uf').value&&field('uf').value!==city.uf)field('uf').value=city.uf;
  fillCities();
 }
 if(additive){
  if(selectedCities.has(strCode))selectedCities.delete(strCode);
  else selectedCities.add(strCode);
 }else if(selectedCities.size>0){
  if(selectedCities.has(strCode))selectedCities.delete(strCode);
  else selectedCities.add(strCode);
 }else{
  field('city').value=String(field('city').value)===strCode?'':strCode;
 }
 renderSelectedCities();
 load();
}

function map(r){
 const target=document.getElementById('map');
 target.replaceChildren();
 const s=svg('svg',{viewBox:'0 0 680 570'});
 const activeUf=field('uf').value;
 const selected=new Set(activeCityCodes());
 if(typeof window.renderRadarMunicipalMesh==='function'&&geo?.municipalities?.length){
  window.renderRadarMunicipalMesh(s,target,geo,{...r,uf:activeUf,explicitCities:[...selected]},(m,ev)=>chooseCity(m.code,Boolean(ev?.shiftKey||ev?.ctrlKey||ev?.metaKey)),uf=>chooseState(uf));
  s.querySelectorAll('.state-path').forEach((path,idx)=>{
   const uf=geo?.states?.features?.[idx]?.properties?.uf;
   if(uf){
    path.setAttribute('data-uf',uf);
    if(activeUf===uf)path.classList.add('active-uf');
   }
  });
 }else{
  const values=new Map((r.byState??[]).map(x=>[x.name,x.value])),max=Math.max(1,...values.values());
  for(const f of geo?.states?.features??[]){
   const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
   const d=polys.flatMap(poly=>poly.map(ring=>ring.map((p,i)=>(i?'L':'M')+project(p).join(' ')).join(' ')+'Z')).join(' ');
   const uf=f.properties.uf,v=values.get(uf);
   const isSelectedUf=activeUf===uf;
   const p=svg('path',{
    d,
    'data-uf':uf,
    class:isSelectedUf?'active-uf':'',
    fill:isSelectedUf?'rgba(168,85,247,0.72)':v?`rgba(168,85,247,${.18+.62*v/max})`:'#1f1f25',
    stroke:isSelectedUf?'#e9d5ff':'#52525b',
    'stroke-width':isSelectedUf?'1.8':'1'
   });
   const t=svg('title');
   t.textContent=`${f.properties.name} (${uf}): ${v?fmt(v):'sem registro no filtro'} — clique para filtrar o estado`;
   p.append(t);
   p.addEventListener('click',()=>chooseState(uf));
   s.append(p);
  }
 }
 const pmax=Math.max(1,...(r.places??[]).map(x=>x.value));
 for(const p of r.places??[]){
  const [cx,cy]=project([p.lon,p.lat]);
  const isCitySelected=selected.has(String(p.code));
  const c=svg('circle',{
   cx,
   cy,
   'data-city':p.code,
   r:isCitySelected?Math.max(6,4+7*Math.sqrt(p.value/pmax)):3+6*Math.sqrt(p.value/pmax),
   fill:isCitySelected?'#facc15':'#eab308',
   stroke:isCitySelected?'#ffffff':'#09090b',
   'stroke-width':isCitySelected?'2':'1.2'
  });
  const t=svg('title');
  t.textContent=`${p.name}/${p.uf}: ${fmt(p.value)}${p.distanceKm!=null?` (${p.distanceKm} km)`:''} — clique para selecionar município`;
  c.append(t);
  c.addEventListener('click',e=>{
   e.stopPropagation();
   chooseCity(p.code,e.shiftKey||e.ctrlKey||e.metaKey);
  });
  s.append(c);
 }
 target.prepend(s);
}

function renderRankingRows(r){
 const tbody=document.getElementById('rows');
 tbody.replaceChildren();
 if(!r.rows?.length){
  tbody.append(el('tr',{},el('td',{colspan:'5'},'Sem registros de audiência para o recorte informado.')));
  return;
 }
 r.rows.forEach(x=>{
  const tr=el('tr',{style:'cursor:pointer',title:'Clique para abrir a ficha deste talento'},
   el('td',{},x.position),
   el('td',{},x.talentName),
   el('td',{},x.category?.label??x.modality),
   el('td',{},`${x.municipality}/${x.uf}`),
   el('td',{},`${fmt(x.value)} ${x.unit}`)
  );
  tr.addEventListener('click',()=>{
   field('talent').value=x.talentId;
   loadProfile(x.talentId);
  });
  tbody.append(tr);
 });
}

function renderGrowthRows(r){
 const tbody=document.getElementById('growth-rows');
 if(!tbody)return;
 tbody.replaceChildren();
 const leaders=r.growthLeaders??[];
 if(!leaders.length){
  tbody.append(el('tr',{},el('td',{colspan:'4'},'Sem histórico comparável suficiente neste recorte.')));
  return;
 }
 leaders.slice(0,25).forEach(item=>{
  const cls=item.growthPct>0?'growth-Positive':item.growthPct<0?'growth-Negative':'growth-Unknown';
  const tr=el('tr',{style:'cursor:pointer',title:'Clique para inspecionar a evolução deste talento'},
   el('td',{},item.talentName),
   el('td',{},item.category?.label??item.modality),
   el('td',{class:cls},signed(item.growth)),
   el('td',{class:cls},pct(item.growthPct))
  );
  tr.addEventListener('click',()=>{
   field('talent').value=item.talentId;
   loadProfile(item.talentId);
  });
  tbody.append(tr);
 });
}

function line(target,points,unit){
 target.replaceChildren();
 if(!points?.length){target.append(el('p',{},'Selecione um talento para visualizar a série temporal.'));return}
 const vals=points.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min);
 const coords=points.map((p,i)=>[25+i*(550/Math.max(1,points.length-1)),150-((p.value-min)/span)*120]);
 const s=svg('svg',{viewBox:'0 0 600 175'});
 s.append(svg('polyline',{fill:'none',stroke:'#a855f7','stroke-width':'3',points:coords.map(c=>c.join(',')).join(' ')}));
 coords.forEach(([cx,cy],i)=>{const c=svg('circle',{cx,cy,r:4,fill:'#eab308'});const t=svg('title');t.textContent=`${points[i].date}: ${fmt(points[i].value)} ${unit}`;c.append(t);s.append(c)});
 target.append(s);
}

async function loadProfile(explicitTalentId){
 const id=explicitTalentId||field('talent').value;
 const p=document.getElementById('profile');
 p.replaceChildren();
 if(!id){
  p.append(el('p',{},'Selecione um talento no ranking ou no filtro para abrir a ficha individual e a evolução temporal.'));
  line(document.getElementById('series-chart'),[]);
  bars(document.getElementById('network-chart'),[],'');
  return;
 }
 const d=await api(`/api/radar/talents/${encodeURIComponent(id)}?network=${encodeURIComponent(field('network').value)}&metric=${encodeURIComponent(field('metric').value)}`);
 p.append(
  el('h3',{},d.talent.name),
  el('p',{},`${d.talent.category?.label??d.talent.modality} · ${d.talent.submodality} · Base ${d.talent.homeCity}/${d.talent.homeUf} (${d.talent.homeRegion})`),
  el('div',{class:'accounts'},d.accounts.map(a=>el('div',{class:'account'},el('strong',{},a.network),' ',a.handle,' · ',a.status)))
 );
 line(document.getElementById('series-chart'),d.series,d.metric.unit);
 bars(document.getElementById('network-chart'),d.networkComparison.map(x=>({name:`${x.network} (${x.metric})`,value:x.value})),'');
}

function buildQueryParams(){
 const q=new URLSearchParams();
 for(const [k,v] of new FormData(form).entries()){
  if(String(v).trim())q.set(k,String(v).trim());
 }
 const cities=activeCityCodes();
 if(cities.length>1){
  q.set('cities',cities.join(','));
 }else if(cities.length===1){
  q.set('city',cities[0]);
 }
 return q;
}

async function load(){
 msg.textContent='Consultando base local de talentos e audiência...';
 try{
  const q=buildQueryParams();
  const r=await api(`/api/radar/ranking?${q}`);
  if(r.categories?.length)meta.categories=r.categories;
  renderCategoryKpis(r);
  renderScopeTotals(r);
  map(r);
  regionBars(document.getElementById('region-chart'),r);
  bars(document.getElementById('place-chart'),r.places,r.metric.unit,place=>chooseCity(place.code,false));
  renderRankingRows(r);
  renderGrowthRows(r);
  const firstTalent=field('talent').value||r.rows?.[0]?.talentId||r.growthLeaders?.[0]?.talentId||'';
  await loadProfile(firstTalent);
  msg.textContent=r.message||'';
 }catch(e){msg.textContent=e.message}
}

window.onRadarResetMap=()=>{
 field('region').value='';
 field('uf').value='';
 field('city').value='';
 field('radius').value='';
 selectedCities.clear();
 fillStates();
 fillCities();
 renderSelectedCities();
 load();
};

async function init(){
 const [metaRes,geoRes,muniRes]=await Promise.all([
  api('/api/radar/metadata'),
  api('/api/radar/geography'),
  api('/api/radar/municipalities')
 ]);
 meta=metaRes;
 geo=geoRes;
 allMunicipalities=muniRes.items??meta.municipalities??[];
 cityIndex=new Map(allMunicipalities.map(c=>[String(c.code),c]));

 fillCategories();
 fill(field('talent'),meta.talents,'Todos os talentos',x=>x.id,x=>`${x.name} (${x.category?.label??x.modality})`);
 fill(field('modality'),meta.modalities,'Todas');
 fillSub();
 fillStates();
 fillCities();
 fillMetrics();
 renderSelectedCities();

 field('network').addEventListener('change',()=>{fillMetrics();load()});
 field('category').addEventListener('change',()=>load());
 field('days').addEventListener('change',()=>load());
 field('modality').addEventListener('change',()=>{fillSub();load()});
 field('region').addEventListener('change',()=>{
  field('uf').value='';
  field('city').value='';
  selectedCities.clear();
  fillStates();
  fillCities();
  renderSelectedCities();
  load();
 });
 field('uf').addEventListener('change',()=>{
  field('city').value='';
  selectedCities.clear();
  fillCities();
  renderSelectedCities();
  load();
 });
 field('city').addEventListener('change',()=>{
  renderSelectedCities();
  load();
 });

 document.getElementById('add-city')?.addEventListener('click',()=>{
  const current=field('city').value;
  if(!current){
   msg.textContent='Selecione um município na lista ou clique em uma cidade do mapa para adicioná-la ao comparativo.';
   return;
  }
  selectedCities.add(String(current));
  renderSelectedCities();
  load();
 });

 document.getElementById('clear-cities')?.addEventListener('click',()=>{
  selectedCities.clear();
  field('city').value='';
  field('uf').value='';
  field('region').value='';
  field('radius').value='';
  fillStates();
  fillCities();
  renderSelectedCities();
  load();
 });

 form.addEventListener('submit',e=>{e.preventDefault();load()});
 await load();
}
init().catch(e=>{msg.textContent=e.message});
