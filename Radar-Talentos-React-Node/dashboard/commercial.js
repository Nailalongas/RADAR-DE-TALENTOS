'use strict';
const form=document.querySelector('#commercial-filters'),msg=document.querySelector('#message'),rows=document.querySelector('#commercial-rows'),profile=document.querySelector('#commercial-profile'),chart=document.querySelector('#commercial-chart'),other=document.querySelector('#commercial-other'),strategic=document.querySelector('#strategic-strip');
const metrics={YouTube:['subscribers','views','likes','comments'],Instagram:['followers','views','likes','comments'],Spotify:['monthly_listeners','followers','streams'],TikTok:['followers','views','likes','comments']};
const labels={subscribers:'Inscritos',views:'Visualizações',likes:'Curtidas',comments:'Comentários',followers:'Seguidores',monthly_listeners:'Ouvintes mensais',streams:'Reproduções'};
const sizes={small:'Pequeno porte',medium:'Médio porte',large:'Grande porte',unknown:'Indisponível'};
const number=v=>v==null?'—':v.toLocaleString('pt-BR',{maximumFractionDigits:1});
const signed=v=>v==null?'—':(v>0?'+':'')+number(v);
let token=0,detailToken=0,activeParams=null,selectedArtist=null,cityToken=0,lastResponse=null;

function el(tag,text,parent){const x=document.createElement(tag);if(text!=null)x.textContent=text;if(parent)parent.append(x);return x;}
function updateMetrics(){form.elements.metric.replaceChildren();for(const m of metrics[form.elements.network.value]){const o=el('option',labels[m],form.elements.metric);o.value=m;}}
async function get(params){const r=await fetch('/api/commercial?'+params,{cache:'no-store'});if(!r.ok)throw Error('API indisponível');return r.json();}

function kpis(d,extra={}){
  const root=document.querySelector('#commercial-kpis');root.replaceChildren();
  const rev=d.items.filter(x=>x.size==='small'&&x.growth_pct!=null).sort((a,b)=>b.growth_pct-a.growth_pct)[0]??d.items.find(x=>x.growth_pct!=null);
  const lastObs=extra.lastCollected??d.items.map(x=>x.observed_on).filter(Boolean).sort().at(-1)??d.end;
  const topNetLabel=extra.topNetwork?`${extra.topNetwork.network} (${signed(extra.topNetwork.growth_pct)}%)`:d.network;
  const cards=[
    ['Artistas monitorados',number(d.total),`${d.growing} em crescimento`],
    ['Histórico comparável',number(d.comparable),`${d.total-d.comparable} sem base anterior`],
    ['Artista revelação',rev?rev.name:'—',rev?`${sizes[rev.size]} · ${signed(rev.growth_pct)}%`:'Porte pequeno'],
    ['Mídia em destaque',topNetLabel,extra.risingCity?`Praça: ${extra.risingCity.name}/${extra.risingCity.uf}`:'No recorte selecionado'],
    ['Cidade em ascensão',extra.risingCity?`${extra.risingCity.name}/${extra.risingCity.uf}`:'Selecionar artista',extra.risingCity?`${extra.risingCity.network} · ${signed(extra.risingCity.growth_pct)}%`:'Comparativo municipal'],
    ['Última coleta',lastObs,'Observação verificada']
  ];
  for(const [title,val,sub] of cards){
    const x=el('div',null,root);x.className='kpi';
    el('span',title,x);el('strong',String(val),x);
    if(sub)el('small',sub,x);
  }
}

function draw(history){
  chart.replaceChildren();
  if(!history||history.length<2){el('p','Histórico insuficiente para gráfico.',chart);return;}
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 400 120');svg.setAttribute('role','img');svg.setAttribute('aria-label','Evolução histórica do indicador');
  const values=history.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),lo=Date.parse(history[0].date),hi=Date.parse(history.at(-1).date);
  const points=history.map(x=>[15+370*(Date.parse(x.date)-lo)/Math.max(1,hi-lo),102-84*(x.value-min)/Math.max(1,max-min)]);
  const poly=document.createElementNS(ns,'polyline');
  poly.setAttribute('points',points.map(p=>p.join(',')).join(' '));poly.setAttribute('fill','none');poly.setAttribute('stroke','#c084fc');poly.setAttribute('stroke-width','2.5');
  svg.append(poly);
  for(let i=0;i<points.length;i++){
    const c=document.createElementNS(ns,'circle');
    c.setAttribute('cx',points[i][0]);c.setAttribute('cy',points[i][1]);c.setAttribute('r','3');c.setAttribute('fill','#d8b4fe');
    const title=document.createElementNS(ns,'title');title.textContent=history[i].date+' — '+number(history[i].value);
    c.append(title);svg.append(c);
  }
  chart.append(svg);
  el('small',`Evolução (${history[0].date} → ${history.at(-1).date}): ${number(values[0])} → ${number(values.at(-1))}`,chart);
}

function renderStrategicStrip(d,a){
  if(!strategic)return;
  strategic.replaceChildren();
  const activeNet=d.national.find(x=>x.network===activeParams.get('network'))??d.national.find(x=>x.item);
  const w7=activeNet?.windows?.[7],w30=activeNet?.windows?.[30],w90=activeNet?.windows?.[90];
  const fmtWin=w=>w&&w.growth_pct!=null?`${signed(w.growth_pct)}% (${signed(w.growth)})`:w?number(w.value):'—';
  const pills=[
    ['Crescimento 7 dias',fmtWin(w7)],
    ['Crescimento 30 dias',fmtWin(w30)],
    ['Crescimento 90 dias',fmtWin(w90)],
    ['Mídia em destaque',d.topNetwork?`${d.topNetwork.network} (${signed(d.topNetwork.growth_pct)}%)`:'—'],
    ['Cidade em ascensão',d.risingCity?`${d.risingCity.name}/${d.risingCity.uf} (${signed(d.risingCity.growth_pct)}%)`:'—'],
    ['Última coleta',d.lastCollected??a.observed_on??'—']
  ];
  for(const [k,v] of pills){
    const box=el('div',null,strategic);box.className='strategic-pill';
    el('span',k,box);el('strong',v,box);
  }
}

async function selectArtist(a){
  const id=++detailToken;selectedArtist=a;
  document.querySelector('#city-scope option[value="artist"]').disabled=false;
  for(const tr of rows.children)tr.setAttribute('aria-selected',String(tr.dataset.artist===a.id));
  loadArtistCards(a,id);
  if(document.querySelector('#city-scope').value==='artist')loadCities();
  profile.replaceChildren();other.replaceChildren();
  const box=el('div',null,profile);box.className='profile-header-box';
  const left=el('div',null,box),right=el('div',null,box);
  el('h3',a.name,left);
  el('p',[sizes[a.size],...(a.modalities?.length?a.modalities:['Modalidade geral'])].join(' · '),left);
  el('small',`Última coleta: ${a.observed_on} · Base (${activeParams.get('days')}d): ${a.baseline_on??'indisponível'} · Fonte: ${a.source}`,left);
  el('strong',`${number(a.value)} ${labels[activeParams.get('metric')]}`,right);
  const deltaP=el('p',`Variação (${activeParams.get('days')}d): ${signed(a.growth)} (${a.growth_pct==null?'—':signed(a.growth_pct)+'%'})`,right);
  deltaP.className=a.growth>0?'positive':a.growth<0?'negative':'';
  try{
    const u=new URL(a.url);
    if(u.protocol==='https:'){const link=el('a','Perfil oficial ↗',right);link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';}
  }catch{}
  draw(a.history);
  el('p','Consultando demais indicadores...',other);
  const jobs=Object.entries(metrics).flatMap(([network,ms])=>ms.map(metric=>({network,metric})));
  const results=await Promise.allSettled(jobs.map(async j=>({...j,data:await get(new URLSearchParams({...j,talent:a.id,days:activeParams.get('days'),end:activeParams.get('end')}))})));
  if(id!==detailToken)return;
  other.replaceChildren();
  for(const z of results){
    if(z.status!=='fulfilled')continue;
    const {network,metric,data}=z.value;const r=data.items[0];
    if(r)el('p',`${network} · ${labels[metric]}: ${number(r.value)} (${r.observed_on})`,other);
  }
  if(!other.children.length)el('p','Nenhum outro indicador disponível.',other);
  if(results.some(z=>z.status==='rejected'))el('small','Parte das consultas falhou.',other);
}

async function load(){
  const current=++token;++detailToken;++cityToken;selectedArtist=null;activeParams=null;
  document.querySelector('#city-scope').value='all';
  document.querySelector('#city-scope option[value="artist"]').disabled=true;
  document.querySelector('#network-cards').replaceChildren();
  document.querySelector('#city-cards').replaceChildren();
  if(strategic)strategic.replaceChildren();
  document.querySelector('#city-status').textContent='Aguardando consulta...';
  rows.replaceChildren();profile.replaceChildren();chart.replaceChildren();other.replaceChildren();
  el('p','Selecione um artista no ranking.',profile);
  msg.textContent='Consultando dados...';
  try{
    const p=new URLSearchParams(new FormData(form));
    const d=await get(p);
    if(current!==token)return;
    p.set('end',d.end);activeParams=p;lastResponse=d;
    kpis(d);loadCities();
    if(form.elements.modality.options.length===1)for(const m of d.modalities){const o=el('option',m.name,form.elements.modality);o.value=m.id;}
    msg.textContent=d.total?`${d.total} artistas monitorados em ${d.network} (${d.start} a ${d.end}). ${d.comparable} com histórico comparável.`:'Nenhum dado disponível para estes filtros.';
    for(const [idx,a] of d.items.entries()){
      const tr=el('tr',null,rows),td=el('td',null,tr),b=el('button',`${idx+1}. ${a.name}`,td);
      tr.dataset.artist=a.id;b.type='button';b.className='artist-link';b.onclick=()=>selectArtist(a);
      el('small',[sizes[a.size],...(a.modalities??[])].join(' · '),td);
      el('td',number(a.value),tr);
      const tdDelta=el('td',signed(a.growth),tr);
      const tdPct=el('td',a.growth_pct==null?'—':signed(a.growth_pct)+'%',tr);
      if(a.growth>0){tdDelta.className='positive';tdPct.className='positive';}
      else if(a.growth<0){tdDelta.className='negative';tdPct.className='negative';}
    }
    if(d.items.length)selectArtist(d.items[0]);
    if(!d.items.length){const td=el('td','Sem registros.',el('tr',null,rows));td.colSpan=4;}
  }catch{
    if(current===token){
      document.querySelector('#commercial-kpis').replaceChildren();
      msg.textContent='Backend indisponível. Não foi possível consultar o banco.';
      document.querySelector('#city-status').textContent='Consulta indisponível.';
    }
  }
}

const regionalLabels={...labels,reach:'Alcance',listeners:'Ouvintes'};
const choices={};
function card(root,title){const x=el('article',null,root);x.className='insight-card';el('h4',title,x);return x;}
async function insights(p){const r=await fetch('/api/commercial/insights?'+p,{cache:'no-store'});if(!r.ok)throw Error('Consulta de detalhes indisponível');return r.json();}
function paramsFor(scope,artist){const p=new URLSearchParams(activeParams);p.set('scope',scope);if(artist)p.set('talent',artist.id);return p;}

async function loadArtistCards(a,id){
  const root=document.querySelector('#network-cards');root.replaceChildren();
  el('p','Consultando quatro mídias...',root);
  try{
    const d=await insights(paramsFor('artist',a));
    if(id!==detailToken)return;
    if(lastResponse)kpis(lastResponse,d);
    renderStrategicStrip(d,a);
    root.replaceChildren();
    for(const n of d.national){
      const x=card(root,n.network),v=n.item,geo=d.regional.find(g=>g.network===n.network);
      el('small',labels[n.metric],x);
      el('strong',number(v?.value),x);
      if(v){
        const delta=el('p',v.growth==null?'Sem histórico comparável':signed(v.growth)+' · '+(v.growth_pct==null?'% indisponível':signed(v.growth_pct)+'%'),x);
        delta.className=v.growth>0?'positive':v.growth<0?'negative':'';
        if(n.windows){
          const wb=el('div',null,x);wb.className='win-badges';
          for(const w of [7,30,90]){
            const wi=n.windows[w];
            if(wi&&wi.growth_pct!=null)el('span',`${w}d: ${signed(wi.growth_pct)}%`,wb).className='win-badge';
          }
        }
        el('small',`${v.baseline_on??'Sem base'} → ${v.observed_on} · ${v.source}`,x);
      }else el('p','Sem observação nacional no período.',x);
      if(geo?.report){
        const c=geo.cities[0],r=geo.report;
        el('small','Cidade principal · '+regionalLabels[r.metric],x);
        if(c)el('p',`${c.name} / ${c.uf} · ${number(c.value)}`,x);
        const leader=geo.cityGrowth?.leaders[0];
        if(leader){
          el('small','Cidade em crescimento',x);
          const growth=el('p',`${leader.name} / ${leader.uf} · ${signed(leader.growth)}`+(leader.growth_pct==null?'':` (${signed(leader.growth_pct)}%)`),x);
          growth.className='positive';
        }else el('small',geo.cityGrowth?'Sem aumento nas cidades comparáveis.':'Sem histórico municipal comparável.',x);
        el('small',`${r.period_start} a ${r.period_end} · ${r.quality==='verified'?'Verificado':'Estimado'}`,x);
      }else el('small','Sem relatório municipal no período.',x);
    }
  }catch{
    if(id===detailToken){root.replaceChildren();el('p','Não foi possível carregar os cards.',root);}
  }
}

async function loadCities(){
  if(!activeParams)return;
  const seq=++cityToken,root=document.querySelector('#city-cards'),status=document.querySelector('#city-status'),scope=document.querySelector('#city-scope').value,p=paramsFor(scope,scope==='artist'?selectedArtist:null);
  p.set('region',document.querySelector('#city-region').value);
  for(const [n,m] of Object.entries(choices))if(m)p.set('metric_'+n,m);
  root.replaceChildren();status.textContent='Consultando cidades...';
  try{
    const d=await insights(p);
    if(seq!==cityToken)return;
    status.textContent=(d.scope==='artist'?d.artist.name:'Todos os artistas com dados')+' · '+d.start+' a '+d.end+' · soma entre artistas não representa pessoas únicas.';
    for(const g of d.regional){
      const x=card(root,g.network),r=g.report;
      const select=el('select',null,x);select.setAttribute('aria-label','Indicador municipal '+g.network);
      const opt=el('option','Indicador automático',select);opt.value='';
      for(const m of g.choices){const o=el('option',regionalLabels[m]??m,select);o.value=m;}
      if(choices[g.network]&&!g.choices.includes(choices[g.network])){
        const o=el('option',(regionalLabels[choices[g.network]]??choices[g.network])+' (sem dados)',select);o.value=choices[g.network];
      }
      select.value=choices[g.network]??'';
      select.onchange=()=>{choices[g.network]=select.value;loadCities();};
      if(!r){el('p','Nenhum relatório municipal disponível no recorte.',x);continue;}
      el('small',regionalLabels[r.metric]+' · '+r.period_start+' a '+r.period_end,x);
      el('strong',number(g.total),x);
      el('small',g.municipalities+' cidades · '+g.talents+' artistas · '+(r.quality==='verified'?'Verificado':'Estimado')+' · '+r.source,x);
      const list=el('ol',null,x);list.className='city-list';
      for(const c of g.cities){
        const li=el('li',null,list),line=el('div',null,li);line.className='city-line';
        el('span',c.name+' / '+c.uf,line);
        el('span',number(c.value)+(g.total>0?' ('+number(c.value/g.total*100)+'%)':''),line);
        const bar=el('progress',null,li);bar.max=Math.max(1,g.cities[0].value);bar.value=c.value;bar.setAttribute('aria-label',c.name+' '+number(c.value));
      }
      if(g.regions.length)el('small','Região líder: '+g.regions[0].name+' · '+number(g.regions[0].value),x);
      if(d.scope==='artist'){
        if(g.cityGrowth){
          el('h4','Cidades com aumento observado',x);
          el('small','Base: '+g.cityGrowth.previousStart+' a '+g.cityGrowth.previousEnd+' · '+g.cityGrowth.comparable+' cidades comparáveis',x);
          for(const c of g.cityGrowth.leaders){
            const gp=el('p',c.name+' / '+c.uf+' · '+signed(c.growth)+(c.growth_pct==null?'':' ('+signed(c.growth_pct)+'%)'),x);
            gp.className='positive';
          }
          if(!g.cityGrowth.leaders.length)el('small','Nenhum aumento nas cidades comparáveis.',x);
        }else el('small','Sem histórico municipal comparável.',x);
      }
    }
  }catch{
    if(seq===cityToken)status.textContent='Não foi possível consultar as cidades.';
  }
}

document.querySelector('#city-scope').onchange=loadCities;
document.querySelector('#city-region').onchange=loadCities;
form.elements.network.onchange=()=>{updateMetrics();load();};
form.onsubmit=e=>{e.preventDefault();load();};
updateMetrics();load();
