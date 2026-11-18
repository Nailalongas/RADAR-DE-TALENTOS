'use strict';
const $=id=>document.getElementById(id),form=$('filters'),field=n=>form.elements.namedItem(n),fmt=n=>Number(n).toLocaleString('pt-BR');
const day=d=>new Date(d).toISOString().slice(0,10);
field('start').value=day(Date.now()-30*864e5);
field('end').value=day(Date.now()+90*864e5);
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
async function get(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||`Consulta indisponível (HTTP ${r.status})`);return r.json()}
function options(select,rows,blank){const old=select.value;select.replaceChildren(new Option(blank,''),...rows.map(r=>new Option(r.name,r.id)));if([...select.options].some(o=>o.value===old))select.value=old}
function table(id,headers,rows){const target=$(id);if(!target)return;if(!rows.length){target.replaceChildren(el('p','Nenhum registro neste recorte.'));return}const t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',h)));head.append(tr);t.append(head);const body=el('tbody');for(const row of rows){const tr=el('tr');for(const v of row){const td=el('td');td.append(v instanceof Node?v:document.createTextNode(String(v??'—')));tr.append(td)}body.append(tr)}t.append(body);target.replaceChildren(t)}

const regionColors={Sudeste:'#42c7b5',Sul:'#45a5dd',Nordeste:'#c69ee9','Centro-Oeste':'#e8b65b',Norte:'#7d9cb8'};
function bars(id,rows,{showPct=false,colorMap=null,barColor='#45c6b1'}={}){
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
  const note=el('p',geo?.states?'Mapa da Base Geográfica Nacional. Hotspots multicamada: eventos únicos observados.':'Malha territorial não carregada. Execute a sincronização geográfica.');
  note.textContent+=` ${fmt(geo?.total??0)} municípios cadastrados; ${fmt(geo?.coordinates??0)} com coordenadas.`;
  target.append(note);
  const w=680/zoomLevel,h=570/zoomLevel,vx=(680-w)/2,vy=(570-h)/2;
  const s=svg('svg',{viewBox:`${vx} ${vy} ${w} ${h}`,class:'national-map',role:'img','aria-label':'Mapa nacional de eventos'});
  const values=new Map(r.byState.map(x=>[x.name,x.value])),max=Math.max(1,...values.values());
  for(const f of geo?.states?.features??[]){
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    const d=polys.flatMap(poly=>poly.map(ring=>ring.map((p,i)=>(i?'L':'M')+project(p).join(' ')).join(' ')+'Z')).join(' '),uf=f.properties.uf,v=values.get(uf);
    const p=svg('path',{d,fill:v?`rgba(37,198,179,${0.18+0.55*v/max})`:'#233e3c',stroke:'#75928a','stroke-width':'1','fill-rule':'evenodd'});
    const title=svg('title');title.textContent=`${uf}: ${fmt(v??0)} eventos`;p.append(title);
    p.addEventListener('click',()=>{field('uf').value=field('uf').value===uf?'':uf;search()});
    s.append(p);
  }
  if(r.origin){
    const a=r.origin.lat*Math.PI/180,b=r.origin.lon*Math.PI/180,d=r.radius/6371;
    const points=Array.from({length:97},(_,i)=>{
      const t=i/96*2*Math.PI,lat=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(t)),lon=b+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(lat));
      return project([lon*180/Math.PI,lat*180/Math.PI]).join(',');
    }).join(' ');
    s.append(svg('polygon',{points,fill:'#50c7df','fill-opacity':'0.10',stroke:'#5ac9ed','stroke-width':'1.6','stroke-dasharray':'5 3'}));
  }
  const maxCity=Math.max(1,...r.places.map(p=>p.value));
  const topCities=new Set(r.places.slice(0,8).map(p=>p.code));
  for(const p of r.places.filter(p=>p.lat!=null)){
    const [cx,cy]=project([p.lon,p.lat]),ratio=Math.sqrt(p.value/maxCity);
    const rOuter=7+17*ratio,rMid=4+9*ratio,rCore=2.2+4*ratio;
    const g=svg('g');
    g.append(
      svg('circle',{cx,cy,r:rOuter,fill:'#25c6b3',opacity:'0.16'}),
      svg('circle',{cx,cy,r:rMid,fill:'#eabf38',opacity:'0.42'}),
      svg('circle',{cx,cy,r:rCore,fill:'#ff694b',opacity:'0.95'})
    );
    const t=svg('title');t.textContent=`${p.name} / ${p.uf}: ${fmt(p.value)}`;g.append(t);
    if(topCities.has(p.code)){
      const label=svg('text',{x:cx+rCore+4,y:cy+3,'font-size':'10',fill:'#ffffff','font-weight':'700'});
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

function renderPlatformDonut(byPlatform){
  const target=$('platform-donut');if(!target)return;target.replaceChildren();
  const active=(byPlatform||[]).filter(p=>p.value>0).slice(0,6);
  if(!active.length){target.append(el('p','Sem anúncios no recorte.'));return;}
  const palette=['#e35b50','#d25ca7','#35c779','#4ab8cc','#e4b85e','#a78bfa'];
  const sum=active.reduce((a,b)=>a+b.value,0),circ=2*Math.PI*29;
  const s=svg('svg',{viewBox:'0 0 80 80',class:'donut-svg'});
  let offsetLen=0;
  active.forEach((item,idx)=>{
    const dash=(item.value/sum)*circ,color=palette[idx%palette.length];
    s.append(svg('circle',{
      cx:'40',cy:'40',r:'29',fill:'none',stroke:color,'stroke-width':'11',
      'stroke-dasharray':`${dash} ${circ-dash}`,'stroke-dashoffset':String(-offsetLen),
      transform:'rotate(-90 40 40)'
    }));
    offsetLen+=dash;
  });
  const leg=el('div');leg.className='donut-legend';
  active.forEach((item,idx)=>{
    const row=el('div');row.className='donut-legend-item';
    const left=el('div');left.className='donut-legend-left';
    const sw=el('span');sw.className='donut-swatch';sw.style.background=palette[idx%palette.length];
    left.append(sw,el('span',item.name));
    row.append(left,el('strong',`${fmt(item.value)} (${Math.round(item.value/sum*100)}%)`));
    leg.append(row);
  });
  target.append(s,leg);
}

function renderModalityPivot(byModalityRegion){
  const target=$('modality-pivot');if(!target)return;
  const cols=['Sul','Sudeste','Nordeste','Centro-Oeste','Norte'];
  const modSet=[...new Set((byModalityRegion||[]).map(x=>x.name))];
  if(!modSet.length){target.replaceChildren(el('p','Nenhum registro neste recorte.'));return;}
  const lookup=new Map((byModalityRegion||[]).map(x=>[`${x.name}|${x.region}`,x.value]));
  const maxPerCol=Object.fromEntries(cols.map(c=>[c,Math.max(0,...modSet.map(m=>lookup.get(`${m}|${c}`)||0))]));
  const rows=modSet.map(m=>{
    let totalMod=0;
    const cells=cols.map(c=>{
      const v=lookup.get(`${m}|${c}`)||0;
      totalMod+=v;
      const span=el('span',fmt(v));
      if(v>0&&v===maxPerCol[c])span.className='pivot-leader';
      return span;
    });
    return [m,...cells,fmt(totalMod)];
  });
  table('modality-pivot',['Modalidade',...cols,'Total'],rows);
}

async function search(keepPage=false){
  if(!keepPage)offset=0;
  const n=++request;
  const message=$('message');
  message.className='';message.textContent='Consultando…';
  try{
    const p=new URLSearchParams([...new FormData(form)].filter(([,v])=>v!==''));
    p.set('offset',String(offset));
    const r=await get('/api/events/trends?'+p);
    if(n!==request)return;
    lastResult=r;
    message.textContent=r.total?'Dados encontrados. '+r.notice:'Nenhum evento encontrado. Verifique o período, a base geográfica e as fontes na central.';
    const k=$('kpis');k.replaceChildren();
    const topMod=r.ranking?.[0];
    const kpiData=[
      ['Artistas monitorados',fmt(r.artists.length),'#4fa9e4',`${fmt(r.withArtists)} eventos com atração`],
      ['Eventos publicados',fmt(r.total),'#a78bfa','Eventos únicos deduplicados'],
      ['Anúncios associados',fmt(r.listings),'#45c6b1','Publicações nas ticketeiras'],
      ['Cidades monitoradas',fmt(r.places.length),'#e4b85e',r.radius!=null?`Raio ativo: ${r.radius} km`:'Território nacional'],
      ['Modalidades em alta',topMod?topMod.name:'—','#45c6b1',topMod?`${fmt(topMod.value)} eventos no recorte`:'Sem eventos']
    ];
    for(const [label,value,dotColor,sub] of kpiData){
      const d=el('div');d.className='kpi';
      const dot=el('span');dot.className='kpi-dot';dot.style.background=dotColor;
      d.append(el('span',label),el('strong',value),el('small',sub),dot);
      k.append(d);
    }
    bars('artist-bars',r.artists.slice(0,8).map((a,i)=>({name:`${i+1}. ${a.name}`,value:a.value})),{barColor:'#45c6b1'});
    table('artists',['Artista / atração','Eventos','Cidades','Plataformas'],r.artists.map(a=>{
      const b=el('button',a.name);b.type='button';b.className='link';
      b.addEventListener('click',()=>{field('artist').value=a.name;search()});
      return[b,a.value,a.cities,a.platforms];
    }));
    table('modalities',['Modalidade','Eventos','Período anterior','Variação observada'],r.ranking.map(a=>[a.name,a.value,a.previous,a.growth_pct==null?'—':a.growth_pct.toFixed(1)+'%']));
    bars('modality-bars',r.ranking.slice(0,8),{barColor:'#4f9bd3'});
    renderModalityPivot(r.byModalityRegion);
    table('modality-regions',['Região','Modalidade','Eventos únicos'],r.byModalityRegion.map(a=>[a.region,a.name,a.value]));
    bars('submodalities',r.subcategories,{barColor:'#45c6b1'});
    bars('regions',r.byRegion,{showPct:true,colorMap:regionColors});
    bars('states',r.byState.slice(0,10),{barColor:'#45a5dd'});
    bars('cities',r.byCity.slice(0,15),{barColor:'#4f9bd3'});
    renderPlatformDonut(r.byPlatform);
    bars('platforms',r.byPlatform.filter(x=>x.value>0),{barColor:'#a78bfa'});
    bars('calendar',r.seasonality,{barColor:'#e4b85e'});
    table('events',['Evento','Atrações','Cidade','Realização','Modalidade','Fontes'],r.items.map(e=>{
      const links=el('div');
      for(const source of e.sources){
        const a=el('a',source.platform_id+' · '+source.status);
        a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';
        links.append(a,el('br'));
      }
      return[e.title,e.artists.join(', ')||'Não informada',e.city_name+'/'+e.uf,e.event_date,e.modality_name,links];
    }));
    total=r.total;
    $('page').textContent=r.total?`${fmt(offset+1)}–${fmt(Math.min(offset+r.pageSize,r.total))} de ${fmt(r.total)}`:'0 eventos';
    $('prev').disabled=offset===0;
    $('next').disabled=offset+r.pageSize>=r.total;
    map(r);
  }catch(e){
    if(n===request){message.className='error';message.textContent=e.message+' — resultados anteriores não atualizados.'}
  }
}

document.querySelectorAll('.preset-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const p=btn.dataset.preset;
    for(const k of ['artist','modality','submodality','platform','region','uf','city','center','radius'])field(k).value='';
    subs();
    if(p==='shows-pr'){field('modality').value='shows';field('uf').value='PR';}
    else if(p==='shows-sc'){field('modality').value='shows';field('uf').value='SC';}
    else if(p==='festivais-se'){field('modality').value='festivais';field('region').value='Sudeste';}
    else if(p==='corridas-sul'){field('modality').value='corridas';field('region').value='Sul';}
    else if(p==='cwb200'){
      options(field('center'),[{id:'4106902',name:'Curitiba / PR'}],'Sem raio');
      field('center').value='4106902';field('radius').value='200';
    }
    search();
  });
});

$('clear-filters')?.addEventListener('click',()=>{
  for(const k of ['artist','modality','submodality','platform','region','uf','city','center','radius'])field(k).value='';
  subs();
  search();
});

$('export-csv')?.addEventListener('click',()=>{
  if(!lastResult?.items?.length)return;
  const header='evento;atracoes;cidade;uf;data;modalidade\n';
  const body=lastResult.items.map(e=>`"${e.title}";"${e.artists.join(', ')}";"${e.city_name}";${e.uf};${e.event_date};"${e.modality_name}"`).join('\n');
  const blob=new Blob([header+body],{type:'text/csv;charset=utf-8'});
  const a=el('a');a.href=URL.createObjectURL(blob);a.download='radar-eventos.csv';a.click();
});

$('zoom-in')?.addEventListener('click',()=>{zoomLevel=Math.min(3,zoomLevel*1.25);if(lastResult)map(lastResult)});
$('zoom-out')?.addEventListener('click',()=>{zoomLevel=Math.max(1,zoomLevel/1.25);if(lastResult)map(lastResult)});
$('zoom-reset')?.addEventListener('click',()=>{zoomLevel=1;if(lastResult)map(lastResult)});

form.addEventListener('submit',e=>{e.preventDefault();search()});
$('all-periods').addEventListener('click',()=>{field('start').value='1900-01-01';field('end').value='2199-12-31';search()});
$('prev').addEventListener('click',()=>{offset=Math.max(0,offset-100);search(true)});
$('next').addEventListener('click',()=>{if(offset+100<total){offset+=100;search(true)}});

async function status(){
  try{
    const data=await get('/api/operations/status'),platforms=await get('/api/events/platforms');
    $('worker').textContent=(data.workerRecent?'Agendador ativo. ':'Agendador sem atividade recente. ')+data.notice;
    table('sources',['Fonte','Última importação','Lotes','Estado da coleta','Resumo'],platforms.map(p=>{
      const jobs=data.jobs.filter(j=>j.kind==='events'&&j.provider===p.id&&j.enabled);
      return[p.name,p.last_import||'—',p.imports,jobs.length?jobs.map(j=>j.state??'Aguardando').join(', '):'Não habilitada',jobs.map(j=>j.summary??'').join('; ')];
    }));
    table('audience-jobs',['Mídia','Tarefa','Estado','Última coleta','Resumo'],data.jobs.filter(j=>j.kind==='audience').map(j=>[j.provider,j.id,j.enabled?(j.state??'Aguardando'):'Não habilitada',j.finished_at??'—',j.summary??'—']));
    const a=$('alerts');a.replaceChildren();
    for(const x of data.alerts.filter(x=>['collection','trend'].includes(x.kind)))a.append(el('p',x.day+' · '+x.message+' — '+x.subject));
    if(!a.children.length)a.append(el('p','Nenhum alerta de tendência ou coleta.'));
  }catch(e){$('worker').textContent=e.message}
}
let wasSyncing=false;
$('refresh').addEventListener('click',async()=>{await status();await conflicts()});
async function conflicts(){try{table('conflicts',['Fonte','ID externo','Título atualizado','Data proposta','Observação'],(await get('/api/events/conflicts')).map(r=>[r.platform_id,r.external_id,r.proposed_title,r.event_date,r.observed_on]))}catch(e){$('conflicts').textContent=e.message}}
$('sync').addEventListener('click',async()=>{
  const b=$('sync');b.disabled=true;$('sync-msg').textContent='Solicitando sincronização…';
  try{
    const r=await fetch('/api/operations/sync',{method:'POST',headers:{'X-Radar-Action':'sync'}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(d.error||`Não foi possível iniciar (HTTP ${r.status})`);
    wasSyncing=true;await poll();
  }catch(e){$('sync-msg').textContent=e.message;b.disabled=false}
});
async function poll(){
  try{
    const r=await get('/api/operations/status');
    $('sync').disabled=r.syncing;
    if(r.syncing){wasSyncing=true;$('sync-msg').textContent='Sincronização em execução. Acompanhe os estados na central.';}
    else if(wasSyncing){
      wasSyncing=false;
      $('sync-msg').textContent=r.lastSync?.error??(r.lastSync?.runs?.length?'Sincronização encerrada. Confira os resultados por fonte.':'Nenhuma tarefa elegível: consulte os limites, horários e últimas execuções.');
      await status();await conflicts();await search();
    }
  }catch(e){$('sync').disabled=false;$('sync-msg').textContent=e.message}
}
setInterval(status,60000);setInterval(poll,3000);conflicts();
(async()=>{
  try{
    const [p,m,g]=await Promise.all([get('/api/events/platforms'),get('/api/radar/modalities'),get('/api/radar/geography')]);
    mods=m;geo=g;
    if($('geo-badge')&&geo?.total)$('geo-badge').textContent=`Base Geográfica: ${fmt(geo.total)} municípios • 27 UFs`;
    options(field('platform'),p,'Todas');
    options(field('modality'),m,'Todas');
    subs();
    await search();
  }catch(e){$('message').textContent=e.message}
  await status();
})();
