'use strict';
const $=id=>document.getElementById(id),form=$('filters'),field=n=>form.elements.namedItem(n),fmt=n=>Number(n??0).toLocaleString('pt-BR');
const signedPct=v=>v==null?'—':(v>0?'+':'')+Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const signedNum=v=>v==null?'—':(v>0?'+':'')+fmt(Math.round(v));
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e};

const UF_META={
  AC:{name:'Acre',region:'Norte'},AL:{name:'Alagoas',region:'Nordeste'},AP:{name:'Amapá',region:'Norte'},AM:{name:'Amazonas',region:'Norte'},
  BA:{name:'Bahia',region:'Nordeste'},CE:{name:'Ceará',region:'Nordeste'},DF:{name:'Distrito Federal',region:'Centro-Oeste'},ES:{name:'Espírito Santo',region:'Sudeste'},
  GO:{name:'Goiás',region:'Centro-Oeste'},MA:{name:'Maranhão',region:'Nordeste'},MT:{name:'Mato Grosso',region:'Centro-Oeste'},MS:{name:'Mato Grosso do Sul',region:'Centro-Oeste'},
  MG:{name:'Minas Gerais',region:'Sudeste'},PA:{name:'Pará',region:'Norte'},PB:{name:'Paraíba',region:'Nordeste'},PR:{name:'Paraná',region:'Sul'},
  PE:{name:'Pernambuco',region:'Nordeste'},PI:{name:'Piauí',region:'Nordeste'},RJ:{name:'Rio de Janeiro',region:'Sudeste'},RN:{name:'Rio Grande do Norte',region:'Nordeste'},
  RS:{name:'Rio Grande do Sul',region:'Sul'},RO:{name:'Rondônia',region:'Norte'},RR:{name:'Roraima',region:'Norte'},SC:{name:'Santa Catarina',region:'Sul'},
  SP:{name:'São Paulo',region:'Sudeste'},SE:{name:'Sergipe',region:'Nordeste'},TO:{name:'Tocantins',region:'Norte'}
};
const REGIONS=['Sul','Sudeste','Nordeste','Centro-Oeste','Norte'];

let geo=null,request=0,multiCityMode=true;
const selectedCities=new Set();
const muniByCode=new Map();

async function get(path){
  const r=await fetch(path,{cache:'no-store'});
  if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||`Consulta indisponível (HTTP ${r.status})`);
  return r.json();
}

function options(select,rows,blank){
  const old=select.value;
  const frag=document.createDocumentFragment();
  frag.append(new Option(blank,''));
  for(const r of rows)frag.append(new Option(r.name,r.id));
  select.replaceChildren(frag);
  if([...select.options].some(o=>o.value===old))select.value=old;
}

function populateStates(){
  const reg=field('region').value;
  const ufs=Object.entries(UF_META)
    .filter(([,meta])=>!reg||meta.region===reg)
    .map(([uf,meta])=>({id:uf,name:`${uf} — ${meta.name}`}));
  const curUf=field('uf').value;
  options(field('uf'),ufs,reg?`Todos (${reg})`:'Todos');
  if(curUf&&(!reg||UF_META[curUf]?.region===reg))field('uf').value=curUf;
  else field('uf').value='';
}

function populateMunicipalities(){
  if(!geo?.municipalities?.length)return;
  const reg=field('region').value;
  const uf=field('uf').value;
  const filtered=geo.municipalities
    .filter(m=>(!reg||m.region===reg)&&(!uf||m.uf===uf))
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.uf.localeCompare(b.uf));
  const items=filtered.map(m=>({id:m.code,name:`${m.name} / ${m.uf}`}));
  const blankLabel=uf?`Todos de ${uf} (${items.length})`:reg?`Todos do ${reg} (${items.length})`:`Todos (${items.length})`;
  options(field('city'),items,blankLabel);
  options(field('center'),items,'Sem raio');
  if(selectedCities.size===1){
    const only=[...selectedCities][0];
    if([...field('city').options].some(o=>o.value===only))field('city').value=only;
  }else if(selectedCities.size===0){
    field('city').value='';
  }
}

function table(id,headers,rows){
  const target=$(id);
  if(!target)return;
  if(!rows.length){target.replaceChildren(el('p','Nenhum registro neste recorte.'));return;}
  const t=el('table'),head=el('thead'),tr=el('tr');
  headers.forEach(h=>tr.append(el('th',h)));
  head.append(tr);t.append(head);
  const body=el('tbody');
  for(const row of rows){
    const tr=el('tr');
    for(const v of row){
      const td=el('td');
      td.append(v instanceof Node?v:document.createTextNode(String(v??'—')));
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(body);target.replaceChildren(t);
}

function bars(id,rows,formatRight=null){
  const target=$(id);
  if(!target)return;
  target.replaceChildren();
  if(!rows.length){target.append(el('p','Sem registros neste recorte.'));return;}
  const max=Math.max(1,...rows.map(r=>Math.max(0,Number(r.value)||0)));
  for(const r of rows){
    const line=el('div',null,'bar');
    const p=el('progress');p.max=max;p.value=Math.max(0,Number(r.value)||0);
    const labelRight=formatRight?formatRight(r):fmt(r.value);
    line.append(el('span',r.name),p,el('span',labelRight));
    target.append(line);
  }
}

function svg(tag,attrs={}){
  const e=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
  return e;
}
const project=([lon,lat])=>[20+(lon+75)*15,20+(6-lat)*13];

function onSelectCityFromMap(m,evt){
  const code=String(m.code);
  const additive=multiCityMode||evt?.ctrlKey||evt?.metaKey||evt?.shiftKey;
  if(additive){
    if(selectedCities.has(code))selectedCities.delete(code);
    else selectedCities.add(code);
  }else{
    if(selectedCities.size===1&&selectedCities.has(code))selectedCities.clear();
    else{selectedCities.clear();selectedCities.add(code);}
  }
  if(selectedCities.size===1){
    const only=[...selectedCities][0];
    if(![...field('city').options].some(o=>o.value===only)){
      field('city').append(new Option(`${m.name} / ${m.uf}`,only));
    }
    field('city').value=only;
  }else{
    field('city').value='';
  }
  search();
}

function onSelectUfFromMap(uf){
  if(field('uf').value===uf){
    field('uf').value='';
  }else{
    field('uf').value=uf;
    if(UF_META[uf])field('region').value=UF_META[uf].region;
  }
  selectedCities.clear();
  populateStates();
  field('uf').value=field('uf').value|| (uf===field('uf').value?'':uf);
  populateMunicipalities();
  search();
}

function map(r){
  const target=$('map');target.replaceChildren();
  const note=el('p',geo?.states?'Base Geográfica Nacional: clique em um estado para filtrar a UF ou clique em um ou vários municípios para comparar totais individuais e consolidados.':'Malha territorial não carregada.');
  note.textContent+=` ${fmt(geo?.total??0)} municípios cadastrados; ${fmt(geo?.coordinates??0)} com coordenadas.`;
  target.append(note);
  const s=svg('svg',{viewBox:'0 0 680 570',preserveAspectRatio:'xMidYMid meet',role:'img','aria-label':'Mapa nacional de artistas e audiência'});
  if(window.renderRadarMunicipalMesh){
    window.renderRadarMunicipalMesh(s,target,geo,r,onSelectCityFromMap,onSelectUfFromMap);
  }
  const maxCity=Math.max(1,...r.places.map(p=>p.value));
  const selSet=new Set(r.explicitCities??[]);
  for(const p of r.places.filter(p=>p.lat!=null)){
    const isSel=selSet.has(String(p.code));
    const [cx,cy]=project([p.lon,p.lat]);
    const c=svg('circle',{
      cx,cy,
      r:isSel?7+10*Math.sqrt(p.value/maxCity):3+9*Math.sqrt(p.value/maxCity),
      fill:isSel?'#facc15':'#eab308',
      stroke:isSel?'#ffffff':'#fef08a',
      'stroke-width':isSel?'2':'1',
      'fill-opacity':isSel?.95:.82,
      class:'city-bubble'
    });
    const t=svg('title');
    t.textContent=`${p.name} / ${p.uf}: ${fmt(p.value)} (${p.talentsCount} artistas · Destaque: ${p.topArtist})`;
    c.append(t);
    c.addEventListener('click',e=>{e.stopPropagation();onSelectCityFromMap(p,e);});
    s.append(c);
  }
  target.insertBefore(s,target.querySelector('.radius-summary'));
}

function renderCategoryCards(r){
  const k=$('kpis');k.replaceChildren();
  if(field('category').options.length<=1){
    options(field('category'),r.categories.map(c=>({id:c.id,name:c.label})),'Todas');
  }
  field('category').value=r.selectedCategory||'';

  for(const c of r.categories){
    const active=String(r.selectedCategory)===String(c.id);
    const btn=el('button',null,'kpi kpi-card category-card');
    btn.type='button';
    btn.setAttribute('aria-pressed',String(active));
    btn.append(el('span',c.label),el('strong',fmt(c.count)),el('small',active?'Filtro ativo (clique p/ todas)':'Artistas no recorte'));
    btn.addEventListener('click',()=>{
      field('category').value=active?'':c.id;
      search();
    });
    k.append(btn);
  }

  const totalActive=!r.selectedCategory;
  const totalBtn=el('button',null,'kpi kpi-card category-card total-card');
  totalBtn.type='button';
  totalBtn.setAttribute('aria-pressed',String(totalActive));
  totalBtn.append(el('span','Total de talentos'),el('strong',fmt(r.totalTalents)),el('small',totalActive?'Todas as categorias':'Ver todas as categorias'));
  totalBtn.addEventListener('click',()=>{
    field('category').value='';
    search();
  });
  k.append(totalBtn);
}

function renderMediaCards(r){
  const host=$('media-cards');host.replaceChildren();
  for(const m of r.mediaSummary){
    const active=m.network===r.network;
    const card=el('button',null,'media-mini-card');
    card.type='button';
    card.dataset.net=m.network;
    card.setAttribute('aria-pressed',String(active));
    const head=el('div',null,'media-mini-head');
    head.append(el('strong',m.network),el('span',signedPct(m.avgGrowthPct),'media-growth-badge'));
    const line1=el('div',`${m.primaryLabel}: ${fmt(m.primaryValue)}`,'media-mini-metric');
    const line2=el('div',`${m.secondaryLabel}: ${fmt(m.secondaryValue)}`,'media-mini-sub');
    const line3=el('small',`Audiência regional: ${fmt(m.regionalAudience)}`);
    card.append(head,line1,line2,line3);
    card.addEventListener('click',()=>{
      field('network').value=m.network;
      field('network').dispatchEvent(new Event('change',{bubbles:true}));
    });
    host.append(card);
  }
}

function renderFilterBreadcrumb(r){
  const bar=$('filter-summary');bar.replaceChildren();
  const parts=[
    r.selectedCategoryName||'Todas',
    r.network,
    r.region||'Brasil inteiro',
    r.uf?`${r.uf} (${UF_META[r.uf]?.name||r.uf})`:'Todos os estados',
    selectedCities.size===0?'Todos os municípios':selectedCities.size===1?(muniByCode.get([...selectedCities][0])?.name||'1 município'):`${selectedCities.size} municípios selecionados`,
    `${r.days} dias`
  ];
  if(r.origin&&r.radius!=null)parts.push(`Raio: ${fmt(r.radius)} km de ${r.origin.name}/${r.origin.uf}`);
  bar.append(el('span',parts.join(' · '),'breadcrumb-text'));

  if(selectedCities.size>0){
    const chips=el('div',null,'city-chips');
    for(const code of selectedCities){
      const m=muniByCode.get(code);
      const chip=el('button',`${m?`${m.name}/${m.uf}`:code} ×`,'city-chip');
      chip.type='button';
      chip.title='Remover município da seleção';
      chip.addEventListener('click',()=>{
        selectedCities.delete(code);
        if(selectedCities.size===1)field('city').value=[...selectedCities][0];
        else field('city').value='';
        search();
      });
      chips.append(chip);
    }
    if(selectedCities.size>1){
      const clearBtn=el('button','Limpar cidades','city-chip clear-chip');
      clearBtn.type='button';
      clearBtn.addEventListener('click',()=>{
        selectedCities.clear();
        field('city').value='';
        search();
      });
      chips.append(clearBtn);
    }
    bar.append(chips);
  }
}

function renderLocalitiesPanel(r){
  const loc=r.selectedLocalities;
  const box=$('consolidated-box');box.replaceChildren();
  const c=loc.consolidated;
  const titleText=loc.isExplicit
    ?`Consolidado das ${c.citiesCount} localidade(s) selecionada(s)`
    :`Consolidado das ${c.citiesCount} principais cidades no recorte`;
  const card=el('div',null,'consolidated-card');
  card.append(
    el('strong',`${titleText}: ${fmt(c.audienceTotal)} em audiência (${r.network}) · ${fmt(c.talentsCount)} artistas ativos`),
    el('small',`Instagram: ${fmt(c.byNetwork.Instagram)} · YouTube: ${fmt(c.byNetwork.YouTube)} · Spotify: ${fmt(c.byNetwork.Spotify)} · TikTok: ${fmt(c.byNetwork.TikTok)}`)
  );
  box.append(card);

  table('localities-table',
    ['Município / UF','Região','Artistas','Audiência ('+r.network+')','% Consolidado','Instagram','YouTube','Spotify','TikTok','Artista líder'],
    loc.items.map(item=>{
      const isSel=selectedCities.has(String(item.code));
      const btn=el('button',`${item.name} / ${item.uf}`+(isSel?' ✓':''));
      btn.type='button';btn.className='link';
      btn.addEventListener('click',e=>onSelectCityFromMap(item,e));
      return[
        btn,
        item.region,
        fmt(item.talentsCount),
        fmt(item.audience),
        item.sharePct.toFixed(1)+'%',
        fmt(item.byNetwork.Instagram),
        fmt(item.byNetwork.YouTube),
        fmt(item.byNetwork.Spotify),
        fmt(item.byNetwork.TikTok),
        item.topArtist
      ];
    })
  );
}

async function search(){
  const n=++request;
  const message=$('message');
  message.className='';
  message.textContent='Consultando inteligência de artistas…';
  try{
    const p=new URLSearchParams();
    for(const key of ['category','network','region','uf','days','center','radius','artist']){
      const val=field(key)?.value?.trim()||'';
      if(val!=='')p.set(key,val);
    }
    if(selectedCities.size>0){
      p.set('cities',[...selectedCities].join(','));
    }else if(field('city').value){
      p.set('city',field('city').value);
    }
    const r=await get('/api/radar/overview?'+p);
    if(n!==request)return;

    message.textContent=`${fmt(r.artists.length)} artistas monitorados no recorte (${r.network} · janela de ${r.days} dias). ${r.notice}`;
    renderCategoryCards(r);
    renderMediaCards(r);
    renderFilterBreadcrumb(r);

    bars('regions',r.artistsByRegion,x=>`${fmt(x.talentsCount)} artistas · ${fmt(x.audience)}`);
    bars('category-growth',r.categoryGrowth,x=>`${signedPct(x.growth_pct)} (${x.talentsCount})`);
    bars('cities',r.places.slice(0,12).map(x=>({name:`${x.name} / ${x.uf}`,value:x.value})));

    renderLocalitiesPanel(r);

    table('artists',
      ['Artista','Categoria',r.mediaSummary.find(m=>m.network===r.network)?.primaryLabel||'Indicador',`Crescimento (${r.days}d)`,'Variação abs.',`Audiência regional (${r.network})`,'Municípios','Cidade principal'],
      r.artists.map((a,idx)=>{
        const b=el('button',`${idx+1}. ${a.name}`);
        b.type='button';b.className='link';
        b.addEventListener('click',()=>{
          field('artist').value=field('artist').value===a.name?'':a.name;
          search();
        });
        const catBtn=el('button',a.category);
        catBtn.type='button';catBtn.className='link';
        catBtn.addEventListener('click',()=>{
          if(a.categoryId){field('category').value=field('category').value===String(a.categoryId)?'':String(a.categoryId);search();}
        });
        const pctSpan=el('span',signedPct(a.growth_pct),a.growth_pct>0?'positive':a.growth_pct<0?'negative':'');
        return[
          b,
          catBtn,
          fmt(a.primaryValue),
          pctSpan,
          signedNum(a.growth),
          fmt(a.regionalAudience),
          fmt(a.citiesCount),
          a.topCity
        ];
      })
    );

    map(r);
  }catch(e){
    if(n===request){
      message.className='error';
      message.textContent=e.message+' — resultados anteriores mantidos.';
    }
  }
}

options(field('region'),REGIONS.map(name=>({name,id:name})),'Brasil inteiro');
populateStates();

field('region').addEventListener('change',()=>{
  populateStates();
  selectedCities.clear();
  populateMunicipalities();
  search();
});

field('uf').addEventListener('change',()=>{
  const uf=field('uf').value;
  if(uf&&UF_META[uf]&&field('region').value!==UF_META[uf].region){
    field('region').value=UF_META[uf].region;
    populateStates();
    field('uf').value=uf;
  }
  selectedCities.clear();
  populateMunicipalities();
  search();
});

field('city').addEventListener('change',()=>{
  const c=field('city').value;
  if(!c){
    selectedCities.clear();
  }else if(multiCityMode){
    selectedCities.add(c);
  }else{
    selectedCities.clear();
    selectedCities.add(c);
  }
  search();
});

for(const name of ['category','network','days','center']){
  field(name)?.addEventListener('change',()=>search());
}

form.addEventListener('submit',e=>{e.preventDefault();search();});

const multiBtn=$('multi-city-toggle');
if(multiBtn){
  multiBtn.addEventListener('click',()=>{
    multiCityMode=!multiCityMode;
    multiBtn.setAttribute('aria-pressed',String(multiCityMode));
  });
}

function resetAllFilters(){
  field('category').value='';
  field('region').value='';
  field('uf').value='';
  field('city').value='';
  field('center').value='';
  field('radius').value='';
  field('artist').value='';
  selectedCities.clear();
  populateStates();
  populateMunicipalities();
  search();
}

$('reset-all')?.addEventListener('click',resetAllFilters);
window.onRadarResetMap=resetAllFilters;

(async()=>{
  try{
    geo=await get('/api/radar/geography');
    for(const m of geo?.municipalities??[])muniByCode.set(String(m.code),m);
    populateMunicipalities();
    await search();
  }catch(e){
    $('message').textContent=e.message;
  }
})();
