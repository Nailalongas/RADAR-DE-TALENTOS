const eventMapRegions = {
  Norte:['AC','AP','AM','PA','RO','RR','TO'],
  Nordeste:['AL','BA','CE','MA','PB','PE','PI','RN','SE'],
  'Centro-Oeste':['DF','GO','MT','MS'],
  Sudeste:['ES','MG','RJ','SP'],
  Sul:['PR','RS','SC']
};
const eventMapUF = Object.fromEntries(Object.entries({
  11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',
  31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF'
}));
const eventMapPilot = [
  {id:4106902,pibPerCapita2023:67691.3,nome:'Curitiba',population:1773718,pib:120000000000,pibApprox:true,slug:'pr/curitiba',venue:{name:'Pedreira Paulo Leminski',address:'Rua João Gava, 970, Abranches',type:'Espaço a céu aberto',capacity:25000,setup:'Público total aproximado',features:'Palco de 480 m²',url:'https://parquejaimelerner.com.br/pedreira-paulo-leminski/'},events:[{date:'2025-04-26',title:'Leve com Você',venue:'Pedreira Paulo Leminski',status:'Evento anunciado',url:'https://www.curitiba.pr.gov.br/noticias/ruas-da-regiao-da-pedreira-terao-bloqueios-para-show-da-banda-natiruts-em-curitiba/77066'}]},
  {id:3550308,pibPerCapita2023:93156.23,nome:'São Paulo',population:11451999,slug:'sp/sao-paulo',venue:{name:'Nubank Parque (antigo Allianz Parque)',address:'Av. Francisco Matarazzo, 1705, Água Branca',type:'Arena',capacity:55000,setup:'Shows, capacidade máxima divulgada',url:'https://palmeiras.com.br/nubank-parque/'},events:[{date:'2025-07-19',title:'Leve com Você',venue:'Allianz Parque',status:'Realizado',attendance:50000,attendanceNote:'Estimativa publicada pela cobertura do show',url:'https://portallineup.com.br/shows-no-brasil/natiruts-se-despede-de-sp-em-show-para-50-mil-pessoas-no-allianz-parque-veja-fotos/'}]},
  {id:4314902,pibPerCapita2023:78586.94,nome:'Porto Alegre',population:1332845,slug:'rs/porto-alegre',venue:{name:'Auditório Araújo Vianna',type:'Auditório',capacity:3146,setup:'Lugares sentados',url:'https://araujoviannaoficial.com.br/o-auditorio/'},events:[{date:'2025-03-15',title:'Leve com Você',venue:'Espaço D’Areia',status:'Evento anunciado',url:'https://www.uol.com.br/splash/noticias/estadao-conteudo/2024/11/21/natiruts-anuncia-novas-datas-da-turne-de-despedida.htm'}]}
];
const eventMapMetrics = {seguidores:'Seguidores',visualizacoes:'Visualizações',minutos_assistidos:'Minutos assistidos'};
const eventMapNumber = v => v == null ? 'Indisponível' : Number(v).toLocaleString('pt-BR');
const eventMapMoney = v => v == null ? 'Indisponível' : Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const eventMapUfFor = id => eventMapUF[String(id).slice(0,2)] || '';
let eventMapCitiesRequest, eventMapShapesRequest;
const eventMapEconomyRequests = new Map();

async function eventMapFetch(url) {
  const response = await fetch(url,{signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw Error('Fonte indisponível no momento.');
  return response.json();
}
async function eventMapEconomy(id) {
  if (eventMapEconomyRequests.has(id)) return eventMapEconomyRequests.get(id);
  const query = async table => {
    const data = await eventMapFetch('/api/event-map-geo?kind='+table+'&city='+id);
    return Object.fromEntries(data.map(v => {
      const entries=Object.entries(v.resultados?.[0]?.series?.[0]?.serie || {});
      const [year,raw]=entries.at(-1) || [];
      return [v.id,{year,value:raw != null && raw !== '' && Number.isFinite(Number(raw))?Number(raw):null}];
    }));
  };
  const requests = Promise.allSettled([query('4714'),query('5938')]).then(results => Object.assign({},...results.filter(r=>r.status==='fulfilled').map(r=>r.value)));
  eventMapEconomyRequests.set(id,requests);
  return requests;
}
function eventMapShapeMarkup(features, region) {
  const colors = ['#428e79','#c6853e','#9274b5','#367eac','#567f9a'];
  if (!features.length) {
    const tiles = [['','RR','','AP'],['AC','AM','PA','MA','PI','CE','RN'],['','RO','MT','TO','BA','PE','PB'],['','','MS','GO','DF','SE','AL'],['','','','SP','MG','ES'],['','','','PR','RJ'],['','','','SC'],['','','','RS']];
    return tiles.map((row,y)=>row.map((uf,x)=>{
      if(!uf)return '';
      const ri=Object.values(eventMapRegions).findIndex(states=>states.includes(uf));
      const left=24+x*46, top=12+y*40;
      const fill=region&&!eventMapRegions[region]?.includes(uf)?'#aabcc7':colors[ri];
      return `<g><path tabindex="0" role="button" data-uf="${uf}" aria-label="${uf}" fill="${fill}" d="M${left},${top}h41v34h-41Z"/><text x="${left+20}" y="${top+22}" fill="#fff" font-size="13" text-anchor="middle" pointer-events="none">${uf}</text></g>`;
    }).join('')).join('');
  }
  return features.map(feature => {
    const uf = eventMapUF[String(feature.properties?.codarea || feature.id)];
    if (!uf) return '';
    const ri = Object.values(eventMapRegions).findIndex(states=>states.includes(uf));
    const polygons = feature.geometry.type==='Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const path = polygons.flatMap(p=>p.map(ring=>'M'+ring.map(([lng,lat])=>((lng+75)*8.6).toFixed(1)+','+((6-lat)*8.6).toFixed(1)).join('L')+'Z')).join('');
    return '<path tabindex="0" role="button" data-uf="'+uf+'" aria-label="'+uf+'" fill="'+(region && !eventMapRegions[region]?.includes(uf)?'#aabcc7':colors[ri])+'" fill-rule="evenodd" d="'+path+'"><title>'+uf+'</title></path>';
  }).join('');
}
const eventMapEntry = '<button type="button" id="openEventMap" aria-controls="eventMap" aria-expanded="false">Mapa de audiência e potencial de eventos</button><section id="eventMap" hidden></section>';
function bindEventMap(person) {
  const button = $('#openEventMap');
  if (button) button.onclick = () => openEventMap(person,button);
}
async function openEventMap(person, button) {
  const panel = $('#eventMap');
  panel.hidden = !panel.hidden;
  button.setAttribute('aria-expanded', String(!panel.hidden));
  if (panel.hidden || panel.dataset.loaded) return;
  panel.dataset.loaded = 'true';
  requestAnimationFrame(()=>{if(!panel.hidden)panel.scrollIntoView({block:'start'});});
  panel.innerHTML = '<p role="status">Preparando relatório de audiência…</p>';
  const identity = person.key || (person.rows?.find(r=>r.personId) ? 'id:'+person.rows.find(r=>r.personId).personId : personKey(person.nome));
  const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
  const endpoint = 'event-map?talent='+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  const pilot = normalizeName(person.nome)==='natiruts';
  let cities = [...eventMapPilot], shapes = [], rows = [], state = '', metric = 'seguidores', loadError = false;
  const cityName = id => cities.find(c=>String(c.id)===String(id))?.nome || 'Município '+id;
  const link = (url,label) => '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
  const amount = v => v == null ? 'Sem dados' : eventMapNumber(v);
  const header = 'codigo;rede;metrica;valor;inicio;fim;publico;parcial;fonte';
  panel.innerHTML = `<h3>Mapa de audiência e potencial de eventos</h3><p>Onde vale estudar a próxima data de <strong>${esc(person.nome)}</strong>?</p>
  <p id="emapStatus" role="status">Carregando dados do perfil…</p><div id="emapSummary"></div>
  <details class="map-box">
    <summary>Relatório de audiência estimada</summary>
    <h4>Audiência estimada · ${esc(person.nome)}</h4>
    <p>Estimativas por cidade aguardando dados de um fornecedor.</p>
    ${pilot?'<ul><li>Curitiba, PR · aguardando amostra</li><li>São Paulo, SP · aguardando amostra</li><li>Porto Alegre, RS · aguardando amostra</li></ul>':''}
    <p class="small">A ficha será preenchida com a métrica, a fonte e a data do relatório. Uma estimativa de audiência engajada deve aparecer com essa descrição.</p>
    <p class="small">Fontes em avaliação · ${link('https://hypeauditor.com/pt/api-integration/instagram-api/','HypeAuditor')} · ${link('https://help.modash.io/en/articles/13715083-understanding-audience-demographics-and-insights','Modash')}</p>
  </details>
  <h4>Mapa do Brasil por estado</h4><label>Métrica do mapa <select id="emapMetric"><option value="seguidores">Instagram · seguidores</option><option value="visualizacoes">YouTube · visualizações</option><option value="minutos_assistidos">YouTube · minutos assistidos</option></select></label>
  <p class="small">Tons mais escuros indicam maior audiência registrada. Cinza indica falta de dados. Selecione um estado para abrir o relatório.</p>
  <div class="map-grid"><div class="map-box"><svg id="emapSvg" viewBox="0 0 370 350" aria-label="Mapa do Brasil por estado"></svg></div><div id="emapStates" class="map-box"></div></div>
  <section id="emapReport" aria-live="polite"></section>
  <details><summary>Importar relatório oficial de audiência</summary><p>Use o modelo CSV com código municipal, métrica, período e fonte. Use todos ou inscritos em publico e sim ou nao em parcial.</p><button type="button" id="emapTemplate">Baixar modelo CSV</button><input type="file" id="emapFile" accept=".csv,text/csv" aria-label="Relatório oficial"><button type="button" id="emapImport">Importar para este talento</button><p id="emapImportStatus" role="status"></p></details>`;
  const el = id => panel.querySelector('#emap'+id);
  const totals = (records,key) => {
    const same = records.filter(r=>r.metrica===key && r.publico==='todos');
    const periods = [...new Set(same.map(r=>r.fim+'|'+r.inicio))].sort();
    return same.filter(r=>r.fim+'|'+r.inicio===periods.at(-1));
  };
  const sum = records => records.length ? records.reduce((n,r)=>n+r.valor,0) : null;
  const metrics = Object.keys(eventMapMetrics);
  const stateRows = uf => rows.filter(r=>eventMapUfFor(r.codigo)===uf);
  function scores(ufs) {
    return Object.fromEntries(metrics.map(key=>[key,totals(rows,key).filter(r=>ufs.includes(eventMapUfFor(r.codigo)))]));
  }
  function numbers(data, details=false) {
    return metrics.map(key=>{
      const list=data[key], first=list[0];
      const sources=[...new Set(list.map(r=>r.fonte))].join(', ');
      return '<p><strong>'+esc(eventMapMetrics[key])+': '+amount(sum(list))+'</strong>'+
        (first?'<small> · '+list.length+' município(s)'+(details?' · '+esc(first.inicio+' a '+first.fim+' · '+sources):'')+' · cobertura parcial</small>':'')+'</p>';
    }).join('');
  }
  function render() {
    const ufs=Object.values(eventMapRegions).flat();
    const ranked=ufs.map(uf=>({uf,data:scores([uf])})).filter(s=>s.data[metric].length).sort((a,b)=>sum(b.data[metric])-sum(a.data[metric]));
    el('Summary').innerHTML='<h4>Prioridades para pesquisa comercial</h4>'+(ranked.length?'<ol>'+ranked.slice(0,3).map(s=>{
      const top=[...s.data[metric]].sort((a,b)=>b.valor-a.valor)[0];
      return '<li><strong>'+s.uf+'</strong> · '+amount(sum(s.data[metric]))+' '+esc(eventMapMetrics[metric].toLowerCase())+' registrados. Maior valor disponível em '+esc(cityName(top.codigo))+' ('+amount(top.valor)+'). Confira a cobertura e a demanda de bilheteria antes de decidir.</li>';
    }).join('')+'</ol>':'<p>Faltam dados oficiais por município para recomendar um mercado com base na audiência. '+(pilot?'São Paulo tem uma apresentação realizada documentada e pode servir como ponto de partida para a pesquisa.':'')+'</p>')+
      (rows.length?'<div class="map-grid">'+Object.entries(eventMapRegions).map(([region,states])=>'<article class="map-box"><strong>'+esc(region)+'</strong>'+numbers(scores(states),true)+(ranked.some(s=>states.includes(s.uf))?'<small>Destaques: '+ranked.filter(s=>states.includes(s.uf)).slice(0,3).map(s=>s.uf).join(', ')+'</small>':'')+'</article>').join('')+'</div>':'');
    el('Svg').innerHTML=eventMapShapeMarkup(shapes,'');
    const max=Math.max(1,...ranked.map(s=>sum(s.data[metric])));
    el('Svg').querySelectorAll('[data-uf]').forEach(path=>{
      const uf=path.dataset.uf, value=sum(scores([uf])[metric]);
      path.setAttribute('fill',value==null?'#aabcc7':'hsl(201 65% '+(65-36*value/max)+'%)');
      path.setAttribute('aria-label',uf+' · '+amount(value));
      if(path.querySelector('title'))path.querySelector('title').textContent=uf+' · '+amount(value);
      path.onclick=()=>openState(uf);
      path.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openState(uf);}};
    });
    el('States').innerHTML='<h4>Relatórios por estado</h4><div class="map-state-buttons">'+ufs.map(uf=>'<button type="button" data-state="'+uf+'">'+uf+' <small>'+amount(sum(scores([uf])[metric]))+'</small></button>').join('')+'</div>';
    el('States').querySelectorAll('[data-state]').forEach(b=>b.onclick=()=>openState(b.dataset.state));
    if(state)renderState();
  }
  function openState(uf) {
    state=uf;
    renderState();
    el('Report').querySelector('h4')?.focus();
  }
  function renderState() {
    const stateData=stateRows(state);
    const ids=[...new Set([...stateData.map(r=>String(r.codigo)),...(pilot?eventMapPilot.filter(c=>eventMapUfFor(c.id)===state).map(c=>String(c.id)):[])])];
    const chosen=totals(rows,metric);
    const cityMetric=id=>chosen.find(r=>String(r.codigo)===id)?.valor;
    ids.sort((a,b)=>(cityMetric(b)??-1)-(cityMetric(a)??-1));
    const stateSummary=scores([state]);
    const leads=metrics.slice(0,2).map(key=>[...stateSummary[key]].sort((a,b)=>b.valor-a.valor)[0]);
    const differs=leads.every(Boolean)&&String(leads[0].codigo)!==String(leads[1].codigo);
    el('Report').innerHTML='<h4 tabindex="-1">Relatório do estado · '+state+'</h4>'+(Object.values(stateSummary).some(list=>list.length)?numbers(stateSummary,true):'<p>Audiência por cidade depende de um relatório oficial do Instagram ou do YouTube para este artista.</p>')+
      (differs?'<p>O Instagram lidera em '+esc(cityName(leads[0].codigo))+' e o YouTube em '+esc(cityName(leads[1].codigo))+'.</p>':'')+
      '<div id="emapCityMap"></div>'+
      (ids.length?'<div class="map-grid emap-city-cards">'+ids.map(id=>{
        const c=eventMapPilot.find(c=>String(c.id)===id);
        const entries=stateData.filter(r=>String(r.codigo)===id);
        const available=metrics.flatMap(key=>totals(rows,key).filter(r=>String(r.codigo)===id));
        const subscribed=metrics.flatMap(key=>totals(entries.filter(r=>r.publico==='inscritos').map(r=>({...r,publico:'todos'})),key));
        const audience=[...available,...subscribed].map(r=>'<div><dt>'+esc(r.rede+' · '+eventMapMetrics[r.metrica]+(subscribed.includes(r)?' de inscritos':''))+'</dt><dd>'+amount(r.valor)+'<small>'+esc(r.inicio+' a '+r.fim+' · '+r.fonte)+(r.parcial?' · Parcial':'')+'</small></dd></div>').join('');
        const history=(pilot?c?.events:[])||[];
        return '<article class="map-box" id="emap-city-'+id+'"><h5>'+esc(cityName(id))+'</h5><small>Código municipal '+id+'</small>'+
          '<h6>Audiência</h6>'+(audience?'<dl>'+audience+'</dl>':'<p>Aguardando relatório oficial de audiência por cidade.</p>')+
          '<h6>Economia e população</h6><div data-city-economy="'+id+'">'+(c?'<p>População: '+amount(c.population)+' (2022)</p>':'')+'</div>'+
          '<h6>Histórico do artista</h6><p>'+(history.map(e=>esc(e.status+' · '+e.date+' · '+e.title+' · '+e.venue+' · atração principal')+(e.attendance?' · Público informado: '+amount(e.attendance):'')+' · '+link(e.url,'Fonte')).join('<br>')||'Nenhuma apresentação confirmada nas fontes cadastradas.')+'</p></article>';
      }).join('')+'</div>':'<p>Sem audiência por município ou apresentações cadastradas neste estado.</p>');
    loadStateDetails(state,ids);
  }
  async function loadStateDetails(uf, ids) {
    const map=el('CityMap');
    const [geo, ...economic]=await Promise.allSettled([
      eventMapFetch('/api/event-map-geo?kind=municipal&uf='+uf),
      ...ids.slice(0,5).map(id=>eventMapEconomy(id))
    ]);
    if(!map.isConnected)return;
    if(geo.status==='fulfilled'&&geo.value.features?.length){
      const features=geo.value.features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type));
      const polygons=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
      const coords=features.flatMap(f=>polygons(f).flat(2));
      if(coords.length){
        const bounds=coords.reduce(([minX,minY,maxX,maxY],[x,y])=>[Math.min(x,minX),Math.min(y,minY),Math.max(x,maxX),Math.max(y,maxY)],[Infinity,Infinity,-Infinity,-Infinity]);
        const [minX,minY,maxX,maxY]=bounds, scale=Math.min(340/(maxX-minX),245/(maxY-minY));
        map.innerHTML='<svg viewBox="0 0 370 275" aria-label="Mapa dos municípios">'+features.map(f=>{
          const id=String(f.properties?.codarea||f.id||''), value=totals(rows,metric).find(r=>String(r.codigo)===id)?.valor;
          const d=polygons(f).flatMap(p=>p.map(r=>'M'+r.map(([x,y])=>((x-minX)*scale+12).toFixed(1)+','+((maxY-y)*scale+12).toFixed(1)).join('L')+'Z')).join('');
          return '<path fill="'+(value==null?'#aabcc7':'#267ca8')+'" d="'+d+'"><title>'+esc(cityName(id)+' · '+amount(value))+'</title></path>';
        }).join('')+'</svg>';
      }
    }
    if(!map.innerHTML)map.textContent='Malha municipal indisponível. Consulte os dados na tabela.';
    economic.forEach((result,i)=>{
      const id=ids[i], target=el('Report').querySelector('[data-city-economy="'+id+'"]');
      const data=result.status==='fulfilled'?result.value:{};
      const city=eventMapPilot.find(item=>String(item.id)===id);
      if(!target)return;
      const indicators=[];
      if(!target.innerHTML&&data[93]?.value!=null)indicators.push('População ('+esc(data[93].year)+'): '+amount(data[93].value));
      if(data[37]?.value!=null)indicators.push('PIB ('+esc(data[37].year)+'): '+eventMapMoney(data[37].value*1000));
      if(data[513]?.value!=null)indicators.push('PIB por habitante ('+esc(data[513].year)+'): '+eventMapMoney(data[513].value));
      else if(city?.pibPerCapita2023!=null)indicators.push('PIB por habitante (2023): '+city.pibPerCapita2023.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
      target.insertAdjacentHTML('beforeend',indicators.map(value=>'<p>'+value+'</p>').join(''));
      if(!target.innerHTML)target.textContent='Indicadores municipais indisponíveis.';
      else if(indicators.length)target.insertAdjacentHTML('beforeend','<small>O PIB mede a produção local. A renda das famílias precisa de um indicador próprio.</small>');
    });
  }
  el('Metric').onchange=()=>{metric=el('Metric').value;render();};
  el('Template').onclick=()=>download(header+'\n','mapa-audiencia-modelo.csv');
  el('Import').onclick=async()=>{
    const file=el('File').files[0];
    if(!file||file.size>1000000){el('ImportStatus').textContent='Selecione um CSV de até 1 MB.';return;}
    el('Import').disabled=true;
    try{
      const lines=(await file.text()).replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(l=>l.trim());
      if(lines.shift()?.trim()!==header)throw Error('Use as colunas do modelo CSV.');
      const batch=lines.map(line=>{
        const [codigo,rede,metrica,valor,inicio,fim,publico,parcial,...fonte]=line.split(';').map(v=>v.trim());
        if(!/^\d{7}$/.test(codigo)||!eventMapUfFor(codigo)||!/^\d+$/.test(valor)||!['sim','nao','não'].includes(parcial))throw Error('Confira código municipal, valor e coluna parcial.');
        return {codigo,rede,metrica,valor:Number(valor),inicio,fim,publico,parcial:parcial==='sim',fonte:fonte.join(';')};
      });
      const result=await realRequest(endpoint,{rows:batch});
      rows=result.rows;render();
      el('ImportStatus').textContent=batch.length+' linhas processadas. '+rows.length+' registros no perfil.';
    }catch(error){el('ImportStatus').textContent=error.message;}finally{el('Import').disabled=false;}
  };
  render();
  const results=await Promise.allSettled([
    eventMapCitiesRequest ||= eventMapFetch('/api/event-map-geo?kind=cities').catch(e=>{eventMapCitiesRequest=null;throw e;}),
    eventMapShapesRequest ||= eventMapFetch('/api/event-map-geo?kind=shapes').catch(e=>{eventMapShapesRequest=null;throw e;}),
    realRequest(endpoint)
  ]);
  if(!panel.isConnected)return;
  if(results[0].status==='fulfilled')cities=results[0].value;
  if(results[1].status==='fulfilled')shapes=results[1].value.features||[];
  if(results[2].status==='fulfilled')rows=results[2].value.rows||[];
  else loadError=true;
  el('Status').textContent=(loadError?'Não foi possível consultar os relatórios salvos. ':'')+
    (shapes.length?'Malha estadual oficial. ':'Visão esquemática das 27 UFs. ')+
    (rows.length?'Última data de referência de audiência: '+rows.map(r=>r.fim).sort().at(-1)+'.':'Para preencher o mapa, importe um relatório oficial de audiência por cidade. O histórico de evolução usa as coletas gerais do perfil.');
  render();
}
