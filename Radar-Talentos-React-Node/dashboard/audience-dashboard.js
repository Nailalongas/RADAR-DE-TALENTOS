'use strict';
const $=id=>document.getElementById(id),form=$('filters'),field=n=>form.elements.namedItem(n),fmt=n=>Number(n).toLocaleString('pt-BR');
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
async function get(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||`Consulta indisponível (HTTP ${r.status})`);return r.json()}
function options(select,rows,blank){const old=select.value;select.replaceChildren(new Option(blank,''),...rows.map(r=>new Option(r.name,r.id)));if([...select.options].some(o=>o.value===old))select.value=old}
function table(id,headers,rows){const target=$(id);if(!target)return;if(!rows.length){target.replaceChildren(el('p','Nenhum registro neste recorte.'));return}const t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',h)));head.append(tr);t.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr');for(const v of row){const td=el('td');td.append(v instanceof Node?v:document.createTextNode(String(v??'—')));tr.append(td)}body.append(tr)}t.append(body);target.replaceChildren(t)}

const regionColors={Sudeste:'#a855f7',Sul:'#c084fc',Nordeste:'#22c55e','Centro-Oeste':'#eab308',Norte:'#38bdf8'};
function bars(id,rows,{showPct=false,colorMap=null,barColor='#a855f7'}={}){
  const target=$(id);if(!target)return;target.replaceChildren();
  if(!rows.length){target.append(el('p','Sem registros.'));return;}
  const max=Math.max(1,...rows.map(r=>r.value)),sum=rows.reduce((a,b)=>a+b.value,0);
  for(const r of rows){
    const line=el('div');line.className='bar';
    const track=el('div');track.className='bar-track';
    const fill=el('div');fill.className='bar-fill';
    fill.style.width=`${Math.max(4,Math.round(r.value/max*100))}%`;
    fill.style.background=colorMap?.[r.name]||barColor;
    track.append(fill);
    const pct=showPct&&sum>0?` (${(r.value/sum*100).toFixed(1)}%)`:'';
    line.append(el('span',r.name),track,el('span',fmt(r.value)+pct));
    target.append(line);
  }
}

let geo=null,mods=[],request=0,offset=0,total=0,lastResult=null,zoomLevel=1;
const regions=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
options(field('region'),regions.map(name=>({name,id:name})),'Brasil inteiro');
options(field('uf'),'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(name=>({name,id:name})),'Todos');

function subs(){options(field('submodality'),mods.filter(m=>!field('modality').value||field('modality').value===m.id).flatMap(m=>m.submodalities.map(s=>({id:String(s.id),name:m.name+' / '+s.name}))),'Todas')}
field('modality').addEventListener('change',()=>{field('submodality').value='';subs()});

for(const [key,input] of [['city','city-search'],['center','center-search']]){
  let timer,seq=0;
  $(input).addEventListener('input',()=>{
    clearTimeout(timer);const n=++seq;
    timer=setTimeout(async()=>{
      try{
        const rows=await get('/api/events/municipalities?'+new URLSearchParams({q:$(input).value,uf:key==='city'?field('uf').value:''}));
        if(n!==seq)return;
        options(field(key),rows.map(r=>({id:r.code,name:r.name+' / '+r.uf})),key==='city'?'Todos':'Sem raio');
      }catch(e){$('message').textContent=e.message}
    },250);
  });
}

function svg(tag,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e}
const project=([lon,lat])=>[20+(lon+75)*15,20+(6-lat)*13];

function map(r){
  const target=$('map');if(!target)return;target.replaceChildren();
  const note=el('p',geo?.states?'Mapa da Base Geográfica Nacional. Hotspots multicamada: intensidade da métrica selecionada.':'Malha territorial não carregada. Execute a sincronização geográfica.');
  note.textContent+=` ${fmt(geo?.total??0)} municípios cadastrados; ${fmt(geo?.coordinates??0)} com coordenadas.`;
  target.append(note);
  const w=680/zoomLevel,h=570/zoomLevel,vx=(680-w)/2,vy=(570-h)/2;
  const s=svg('svg',{viewBox:`${vx} ${vy} ${w} ${h}`,class:'national-map',role:'img','aria-label':'Mapa nacional de audiência'});
  const values=new Map(r.byState.map(x=>[x.name,x.value])),max=Math.max(1,...values.values());
  for(const f of geo?.states?.features??[]){
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    const d=polys.flatMap(poly=>poly.map(ring=>ring.map((p,i)=>(i?'L':'M')+project(p).join(' ')).join(' ')+'Z')).join(' '),uf=f.properties.uf,v=values.get(uf);
    const p=svg('path',{d,fill:v?`rgba(168,85,247,${0.18+0.55*v/max})`:'#18181b',stroke:'#3f3f46','stroke-width':'1','fill-rule':'evenodd'});
    const title=svg('title');title.textContent=`${uf}: ${fmt(v??0)}`;p.append(title);
    p.addEventListener('click',()=>{field('uf').value=field('uf').value===uf?'':uf;search()});
    s.append(p);
  }
  if(r.origin){
    const a=r.origin.lat*Math.PI/180,b=r.origin.lon*Math.PI/180,d=r.radius/6371;
    const points=Array.from({length:97},(_,i)=>{
      const t=i/96*2*Math.PI,lat=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(t)),lon=b+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(lat));
      return project([lon*180/Math.PI,lat*180/Math.PI]).join(',');
    }).join(' ');
    s.append(svg('polygon',{points,fill:'#a855f7','fill-opacity':'0.12',stroke:'#c084fc','stroke-width':'1.8','stroke-dasharray':'5 3'}));
  }
  const maxCity=Math.max(1,...r.places.map(p=>p.value));
  const topCities=new Set(r.places.slice(0,8).map(p=>p.code));
  for(const p of r.places.filter(p=>p.lat!=null)){
    const [cx,cy]=project([p.lon,p.lat]),ratio=Math.sqrt(p.value/maxCity);
    const rOuter=6+18*ratio,rMid=3.5+9.5*ratio,rCore=2+4.2*ratio;
    const g=svg('g');
    g.append(
      svg('circle',{cx,cy,r:rOuter,fill:'#a855f7',opacity:'0.18'}),
      svg('circle',{cx,cy,r:rMid,fill:'#eab308',opacity:'0.45'}),
      svg('circle',{cx,cy,r:rCore,fill:'#ef4444',opacity:'0.95'})
    );
    const t=svg('title');t.textContent=`${p.name} / ${p.uf}: ${fmt(p.value)}`;g.append(t);
    if(topCities.has(p.code)){
      const label=svg('text',{x:cx+rCore+4,y:cy+3,'font-size':'10',fill:'#fafafa','font-weight':'700'});
      label.textContent=p.name;
      g.append(label);
    }
    g.addEventListener('click',()=>{
      options(field('city'),[{id:p.code,name:p.name+' / '+p.uf}],'Todos');
      field('city').value=p.code;
      search();
    });
    s.append(g);
  }
  target.append(s);
}

const names={views:'Visualizações',followers:'Seguidores',reach:'Alcance',listeners:'Ouvintes',streams:'Reproduções',subscribers:'Inscritos'};
let reports=[],activeReports=[],reportSeq=0;

function renderMediaDonut(){
  const target=$('media-donut');if(!target)return;target.replaceChildren();
  const netColors={YouTube:'#ef4444',Instagram:'#a855f7',Spotify:'#22c55e',TikTok:'#eab308'};
  const counts=['YouTube','Instagram','Spotify','TikTok'].map(net=>({
    name:net,
    color:netColors[net],
    value:reports.filter(r=>r.network===net).reduce((a,b)=>a+Number(b.records||0),0)
  })).filter(x=>x.value>0);
  if(!counts.length){target.append(el('p','Sem relatórios carregados.'));return;}
  const sum=counts.reduce((a,b)=>a+b.value,0),circ=2*Math.PI*29;
  const s=svg('svg',{viewBox:'0 0 80 80',class:'donut-svg'});
  let offsetLen=0;
  for(const item of counts){
    const dash=(item.value/sum)*circ;
    s.append(svg('circle',{
      cx:'40',cy:'40',r:'29',fill:'none',stroke:item.color,'stroke-width':'11',
      'stroke-dasharray':`${dash} ${circ-dash}`,'stroke-dashoffset':String(-offsetLen),
      transform:'rotate(-90 40 40)'
    }));
    offsetLen+=dash;
  }
  const leg=el('div');leg.className='donut-legend';
  for(const item of counts){
    const row=el('div');row.className='donut-legend-item';
    const left=el('div');left.className='donut-legend-left';
    const sw=el('span');sw.className='donut-swatch';sw.style.background=item.color;
    left.append(sw,el('span',item.name));
    row.append(left,el('strong',`${Math.round(item.value/sum*100)}%`));
    leg.append(row);
  }
  target.append(s,leg);
}

function syncPlatformChips(){
  const current=field('network').value;
  document.querySelectorAll('#platform-switcher .platform-chip, #top-media-switcher .top-media-pill').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.net===current);
  });
}

function params(){
  const r=activeReports[Number(field('report').value)];
  if(!r||field('report').value==='')return null;
  return new URLSearchParams({network:r.network,metric:r.metric,start:r.period_start,end:r.period_end,source:r.source,quality:r.quality});
}

async function reportChanged(){
  const seq=++reportSeq;request++;
  const p=params();
  field('talent').replaceChildren(new Option('Todos com dados',''));
  if(p){
    try{
      const rows=await get('/api/regional/talents?'+p);
      if(seq!==reportSeq)return;
      options(field('talent'),rows,'Todos com dados');
    }catch(e){
      if(seq===reportSeq)$('message').textContent=e.message;
      return;
    }
  }
  if(seq===reportSeq)await search();
}

function metricChanged(){
  activeReports=reports.filter(r=>r.network===field('network').value&&(!field('metric').value||r.metric===field('metric').value));
  field('report').replaceChildren(...activeReports.map((r,i)=>new Option(`${names[r.metric]??r.metric} · ${r.period_start} a ${r.period_end} · ${r.source} · ${r.quality==='verified'?'Verificado':'Estimado'}`,String(i))));
  if(!activeReports.length)field('report').append(new Option('Nenhum relatório disponível',''));
  return reportChanged();
}

function networkChanged(){
  syncPlatformChips();
  const keys=[...new Set(reports.filter(r=>r.network===field('network').value).map(r=>r.metric))];
  options(field('metric'),keys.map(id=>({id,name:names[id]??id})),'Todos disponíveis');
  if(keys.includes('views'))field('metric').value='views';
  else if(field('network').value==='Spotify'&&keys.includes('streams'))field('metric').value='streams';
  return metricChanged();
}

async function loadReports(){
  reports=await get('/api/regional/reports');
  table('coverage',['Mídia','Métrica','Início','Fim','Fonte','Qualidade','Registros','Artistas'],reports.map(r=>[r.network,names[r.metric]??r.metric,r.period_start,r.period_end,r.source,r.quality==='verified'?'Verificado':'Estimado',r.records,r.talents]));
  renderMediaDonut();
  await networkChanged();
}

async function search(keepPage=false){
  if(!keepPage)offset=0;
  const n=++request,p=params();
  const k=$('kpis');
  if(!p){
    $('message').textContent='Nenhum relatório municipal disponível para esta mídia. Importe uma fonte autorizada.';
    k.replaceChildren();
    for(const id of ['regions','states','cities','artist-bars'])bars(id,[]);
    table('artists',[],[]);
    map({byState:[],places:[]});
    $('page').textContent='Sem dados';
    $('prev').disabled=$('next').disabled=true;
    return;
  }
  $('message').textContent='Consultando…';
  try{
    for(const key of ['talent','modality','submodality','region','uf','city','center','radius'])
      if(field(key).value!=='')p.set(key,field(key).value);
    p.set('limit','100');
    p.set('offset',String(offset));
    const r=await get('/api/regional/ranking?'+p);
    if(n!==request)return;
    lastResult=r;
    const count=r.places.reduce((a,b)=>a+b.value,0);
    $('message').textContent=(r.total?'Dados sincronizados do relatório selecionado. ':'Nenhum registro neste recorte. ')+r.notice+(r.excludedCoordinates?` ${r.excludedCoordinates} registros sem coordenadas foram excluídos do raio.`:'');
    k.replaceChildren();
    const topReg=r.byRegion?.[0];
    const kpiItems=[
      ['Artistas monitorados',r.total?fmt(r.total):'—','#a855f7','Com audiência no recorte'],
      [names[r.metric]??r.metric,r.total?fmt(count):'—','#22c55e',`Mídia: ${r.network}`],
      ['Cidades analisadas',r.total?fmt(r.places.length):'—','#eab308',r.radius!=null?`Raio ativo: ${r.radius} km`:'Território nacional'],
      ['Região líder',topReg?topReg.name:'—','#c084fc',topReg&&count>0?`${(topReg.value/count*100).toFixed(1)}% da audiência`:'Sem registros'],
      ['Fontes sincronizadas',fmt(reports.length),'#22c55e','4 mídias habilitadas']
    ];
    for(const [label,val,dotColor,sub] of kpiItems){
      const box=el('div');box.className='kpi';
      const dot=el('span');dot.className='kpi-dot';dot.style.background=dotColor;
      box.append(el('span',label),el('strong',val),el('small',sub),dot);
      k.append(box);
    }
    bars('regions',r.byRegion,{showPct:true,colorMap:regionColors});
    bars('states',r.byState.slice(0,10),{barColor:'#c084fc'});
    bars('cities',r.places.slice(0,10).map(x=>({name:x.name+' / '+x.uf,value:x.value})),{barColor:'#22c55e'});
    bars('artist-bars',r.items.slice(0,8).map((a,i)=>({name:`${i+1}. ${a.name}`,value:a.value})),{barColor:'#a855f7'});
    table('artists',['Posição','Artista','Valor','Municípios','Fonte','Qualidade'],r.items.map(a=>{
      const b=el('button',a.name);b.type='button';b.className='link';
      b.addEventListener('click',()=>{field('talent').value=a.id;search()});
      return[a.rank,b,fmt(a.value),a.cities,a.source||'—',a.quality==='verified'?'Verificado':'Estimado'];
    }));
    total=r.total;
    $('page').textContent=total?`${offset+1}–${Math.min(offset+100,total)} de ${total}`:'Sem dados';
    $('prev').disabled=offset===0;
    $('next').disabled=offset+100>=total;
    map(r);
  }catch(e){
    if(n===request)$('message').textContent=e.message+' — resultados anteriores não atualizados.';
  }
}

document.querySelectorAll('#platform-switcher .platform-chip, #top-media-switcher .top-media-pill').forEach(btn=>{
  btn.addEventListener('click',()=>{
    field('network').value=btn.dataset.net;
    networkChanged();
  });
});

document.querySelectorAll('.preset-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const p=btn.dataset.preset;
    field('region').value='';field('uf').value='';field('city').value='';field('center').value='';field('radius').value='';
    if(p==='cwb200'){
      options(field('center'),[{id:'4106902',name:'Curitiba / PR'}],'Sem raio');
      field('center').value='4106902';field('radius').value='200';$('radius-slider').value='200';
    }else if(p==='sp150'){
      options(field('center'),[{id:'3550308',name:'São Paulo / SP'}],'Sem raio');
      field('center').value='3550308';field('radius').value='150';$('radius-slider').value='150';
    }else if(p==='sul')field('region').value='Sul';
    else if(p==='sudeste')field('region').value='Sudeste';
    else if(p==='nordeste')field('region').value='Nordeste';
    search();
  });
});

$('clear-filters')?.addEventListener('click',()=>{
  for(const k of ['talent','modality','submodality','region','uf','city','center','radius'])field(k).value='';
  subs();
  search();
});

$('export-csv')?.addEventListener('click',()=>{
  if(!lastResult?.items?.length)return;
  const header='posicao;artista;rede;metrica;valor;municipios\n';
  const body=lastResult.items.map(a=>`${a.rank};"${a.name}";${lastResult.network};${lastResult.metric};${a.value};${a.cities}`).join('\n');
  const blob=new Blob([header+body],{type:'text/csv;charset=utf-8'});
  const a=el('a');a.href=URL.createObjectURL(blob);a.download=`audiencia-${lastResult.network.toLowerCase()}.csv`;a.click();
});

$('zoom-in')?.addEventListener('click',()=>{zoomLevel=Math.min(3,zoomLevel*1.25);if(lastResult)map(lastResult)});
$('zoom-out')?.addEventListener('click',()=>{zoomLevel=Math.max(1,zoomLevel/1.25);if(lastResult)map(lastResult)});
$('zoom-reset')?.addEventListener('click',()=>{zoomLevel=1;if(lastResult)map(lastResult)});

/* ORIGAMID COMMAND PALETTE (CTRL+K) */
const modal=$('cmdk-modal'),cmdkInput=$('cmdk-input'),cmdkResults=$('cmdk-results');
function closeCmdk(){if(modal)modal.hidden=true;}
function openCmdk(){if(!modal)return;modal.hidden=false;cmdkInput.value='';renderCmdk('');cmdkInput.focus();}
async function renderCmdk(q){
  if(!cmdkResults)return;cmdkResults.replaceChildren();
  const term=q.trim().toLowerCase();
  const items=[];
  for(const net of ['Instagram','YouTube','Spotify','TikTok']){
    if(!term||net.toLowerCase().includes(term))items.push({label:`Mídia: ${net}`,tag:'Mídia',action:()=>{field('network').value=net;networkChanged();}});
  }
  for(const opt of [...field('talent').options].slice(1)){
    if(!term||opt.text.toLowerCase().includes(term))items.push({label:`Artista: ${opt.text}`,tag:'Artista',action:()=>{field('talent').value=opt.value;search();}});
  }
  for(const m of mods){
    if(!term||m.name.toLowerCase().includes(term))items.push({label:`Modalidade: ${m.name}`,tag:'Modalidade',action:()=>{field('modality').value=m.id;subs();search();}});
  }
  for(const reg of regions){
    if(!term||reg.toLowerCase().includes(term))items.push({label:`Região: ${reg}`,tag:'Região',action:()=>{field('region').value=reg;search();}});
  }
  if(term.length>=2){
    try{
      const cities=await get('/api/events/municipalities?'+new URLSearchParams({q:term}));
      for(const c of cities.slice(0,6)){
        items.push({label:`Raio 200 km de ${c.name} / ${c.uf}`,tag:'Perímetro',action:()=>{options(field('center'),[{id:c.code,name:`${c.name} / ${c.uf}`}],'Sem raio');field('center').value=c.code;field('radius').value='200';search();}});
      }
    }catch{}
  }
  for(const it of items.slice(0,12)){
    const btn=el('button');btn.type='button';btn.className='cmdk-item';
    const tag=el('span',it.tag);tag.className='cmdk-tag';
    btn.append(el('span',it.label),tag);
    btn.addEventListener('click',()=>{closeCmdk();it.action();});
    cmdkResults.append(btn);
  }
}
$('cmdk-open')?.addEventListener('click',openCmdk);
$('cmdk-close')?.addEventListener('click',closeCmdk);
modal?.addEventListener('click',e=>{if(e.target===modal)closeCmdk();});
cmdkInput?.addEventListener('input',()=>renderCmdk(cmdkInput.value));
window.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();modal?.hidden?openCmdk():closeCmdk();}
  else if(e.key==='Escape'&&modal&&!modal.hidden)closeCmdk();
});

form.addEventListener('submit',e=>{e.preventDefault();search()});
field('network').addEventListener('change',networkChanged);
field('report').addEventListener('change',reportChanged);
field('metric').addEventListener('change',metricChanged);
$('radius-slider').addEventListener('input',()=>{field('radius').value=$('radius-slider').value});
field('radius').addEventListener('input',()=>{if(field('radius').value!=='')$('radius-slider').value=field('radius').value});
$('reload').addEventListener('click',()=>loadReports().catch(e=>$('message').textContent=e.message));
$('prev').addEventListener('click',()=>{offset=Math.max(0,offset-100);search(true)});
$('next').addEventListener('click',()=>{if(offset+100<total){offset+=100;search(true)}});

(async()=>{
  try{
    [mods,geo]=await Promise.all([get('/api/radar/modalities'),get('/api/radar/geography')]);
    if($('geo-badge')&&geo?.total)$('geo-badge').textContent=`Base Geográfica Nacional (${fmt(geo.total)} municípios)`;
    options(field('modality'),mods,'Todas');
    subs();
    await loadReports();
  }catch(e){$('message').textContent=e.message}
})();
